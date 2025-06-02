// Backend/services/selfRebateService.js
const { sequelize } = require('../config/db');
const { Op } = require('sequelize');

// Import models
const User = require('../models/User');
const SelfRebate = require('../models/SelfRebate');
const VipLevel = require('../models/VipLevel');
const Transaction = require('../models/Transaction');

// Import wallet service
const { updateWalletBalance } = require('./referralService');

/**
 * House games list - only these games qualify for self rebate
 */
const HOUSE_GAMES = ['wingo', '5d', 'k3', 'trx_wix'];

/**
 * Process self rebate for a house game bet
 */
const processSelfRebate = async (userId, betAmount, gameType, gameId = null, betReferenceId = null, transaction = null) => {
    const t = transaction || await sequelize.transaction();
    const shouldCommit = !transaction;

    try {
        console.log(`💰 Processing self rebate for user ${userId}: ${betAmount} in ${gameType}`);

        // Check if it's a house game
        if (!HOUSE_GAMES.includes(gameType.toLowerCase())) {
            console.log(`⚠️ Game ${gameType} is not a house game, skipping self rebate`);
            if (shouldCommit) await t.commit();
            return {
                success: true,
                message: 'Not a house game, no self rebate applicable',
                rebateAmount: 0
            };
        }

        // Get user with VIP level details
        const user = await User.findByPk(userId, {
            attributes: ['user_id', 'user_name', 'vip_level', 'wallet_balance'],
            include: [{
                model: VipLevel,
                foreignKey: 'vip_level',
                targetKey: 'level',
                as: 'vipuser',
                attributes: ['rebate_rate'],
                required: false
            }],
            transaction: t
        });

        if (!user) {
            if (shouldCommit) await t.rollback();
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Get rebate rate from VIP level
        const rebateRate = user.vipuser?.rebate_rate || 0.00;
        const rebateRateDecimal = parseFloat(rebateRate) / 100; // Convert percentage to decimal

        if (rebateRateDecimal <= 0) {
            console.log(`⚠️ User ${userId} has no rebate rate (VIP level ${user.vip_level})`);
            if (shouldCommit) await t.commit();
            return {
                success: true,
                message: 'No rebate rate configured for user VIP level',
                rebateAmount: 0
            };
        }

        // Calculate rebate amount
        const betAmountFloat = parseFloat(betAmount);
        const rebateAmount = betAmountFloat * rebateRateDecimal;

        if (rebateAmount <= 0) {
            if (shouldCommit) await t.commit();
            return {
                success: true,
                message: 'Rebate amount too small',
                rebateAmount: 0
            };
        }

        // Credit rebate to wallet
        await updateWalletBalance(userId, rebateAmount, 'add', t);

        // Create self rebate record
        await SelfRebate.create({
            user_id: userId,
            bet_amount: betAmountFloat,
            rebate_rate: rebateRateDecimal,
            rebate_amount: rebateAmount,
            game_type: gameType.toLowerCase(),
            game_id: gameId,
            vip_level: user.vip_level,
            bet_reference_id: betReferenceId,
            status: 'credited',
            credited_at: new Date(),
            batch_id: `self_rebate_${Date.now()}`
        }, { transaction: t });

        // Create transaction record
        await Transaction.create({
            user_id: userId,
            type: 'rebate',
            amount: rebateAmount,
            status: 'completed',
            description: `Self rebate for ${gameType} bet - ${(parseFloat(rebateRate)).toFixed(2)}% cashback`,
            reference_id: `self_rebate_${userId}_${Date.now()}`,
            game_type: gameType,
            game_id: gameId,
            metadata: {
                rebate_type: 'self_rebate',
                original_bet_amount: betAmountFloat,
                rebate_rate: parseFloat(rebateRate),
                vip_level: user.vip_level,
                bet_reference_id: betReferenceId
            }
        }, { transaction: t });

        if (shouldCommit) await t.commit();

        console.log(`✅ Self rebate credited: ${rebateAmount} to user ${userId} (${parseFloat(rebateRate).toFixed(2)}% of ${betAmountFloat})`);

        return {
            success: true,
            message: 'Self rebate processed successfully',
            rebateAmount: parseFloat(rebateAmount),
            rebateRate: parseFloat(rebateRate),
            originalBetAmount: betAmountFloat,
            gameType
        };

    } catch (error) {
        if (shouldCommit) await t.rollback();
        console.error('❌ Error processing self rebate:', error);
        return {
            success: false,
            message: 'Error processing self rebate: ' + error.message
        };
    }
};

/**
 * Get user's self rebate history with pagination
 */
const getSelfRebateHistory = async (userId, page = 1, limit = 20) => {
    try {
        const offset = (parseInt(page) - 1) * parseInt(limit);

        const { count, rows } = await SelfRebate.findAndCountAll({
            where: { user_id: userId },
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: offset,
            attributes: [
                'id', 'bet_amount', 'rebate_rate', 'rebate_amount',
                'game_type', 'game_id', 'vip_level', 'status',
                'credited_at', 'created_at'
            ]
        });

        const totalPages = Math.ceil(count / parseInt(limit));

        return {
            success: true,
            history: rows.map(rebate => ({
                id: rebate.id,
                betAmount: parseFloat(rebate.bet_amount),
                rebateRate: parseFloat(rebate.rebate_rate) * 100, // Convert back to percentage
                rebateAmount: parseFloat(rebate.rebate_amount),
                gameType: rebate.game_type,
                gameId: rebate.game_id,
                vipLevel: rebate.vip_level,
                status: rebate.status,
                creditedAt: rebate.credited_at,
                createdAt: rebate.created_at
            })),
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalRecords: count,
                hasNextPage: parseInt(page) < totalPages,
                hasPrevPage: parseInt(page) > 1,
                limit: parseInt(limit)
            }
        };

    } catch (error) {
        console.error('❌ Error getting self rebate history:', error);
        return {
            success: false,
            message: 'Error getting self rebate history: ' + error.message
        };
    }
};

/**
 * Get user's self rebate statistics
 */
const getSelfRebateStats = async (userId, days = 30) => {
    try {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const stats = await SelfRebate.findAll({
            where: {
                user_id: userId,
                created_at: { [Op.gte]: startDate },
                status: 'credited'
            },
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('id')), 'total_rebates'],
                [sequelize.fn('SUM', sequelize.col('bet_amount')), 'total_bet_amount'],
                [sequelize.fn('SUM', sequelize.col('rebate_amount')), 'total_rebate_amount'],
                [sequelize.fn('AVG', sequelize.col('rebate_rate')), 'avg_rebate_rate']
            ],
            raw: true
        });

        // Get breakdown by game type
        const gameBreakdown = await SelfRebate.findAll({
            where: {
                user_id: userId,
                created_at: { [Op.gte]: startDate },
                status: 'credited'
            },
            attributes: [
                'game_type',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                [sequelize.fn('SUM', sequelize.col('bet_amount')), 'total_bet'],
                [sequelize.fn('SUM', sequelize.col('rebate_amount')), 'total_rebate']
            ],
            group: ['game_type'],
            raw: true
        });

        const totalStats = stats[0] || {
            total_rebates: 0,
            total_bet_amount: 0,
            total_rebate_amount: 0,
            avg_rebate_rate: 0
        };

        return {
            success: true,
            period: `Last ${days} days`,
            summary: {
                totalRebates: parseInt(totalStats.total_rebates) || 0,
                totalBetAmount: parseFloat(totalStats.total_bet_amount) || 0,
                totalRebateAmount: parseFloat(totalStats.total_rebate_amount) || 0,
                avgRebateRate: parseFloat(totalStats.avg_rebate_rate) * 100 || 0 // Convert to percentage
            },
            gameBreakdown: gameBreakdown.map(game => ({
                gameType: game.game_type,
                count: parseInt(game.count),
                totalBet: parseFloat(game.total_bet),
                totalRebate: parseFloat(game.total_rebate)
            }))
        };

    } catch (error) {
        console.error('❌ Error getting self rebate stats:', error);
        return {
            success: false,
            message: 'Error getting self rebate stats: ' + error.message
        };
    }
};

/**
 * Process bulk self rebates (for cron job if needed)
 */
const processBulkSelfRebates = async (batchSize = 100) => {
    try {
        console.log('🔄 Processing bulk self rebates...');
        
        // Get pending rebates (if you want to implement batch processing)
        const pendingRebates = await SelfRebate.findAll({
            where: { status: 'pending' },
            limit: batchSize,
            include: [{
                model: User,
                as: 'selfrebateuser',
                attributes: ['user_id', 'wallet_balance']
            }]
        });

        let processedCount = 0;
        let errorCount = 0;

        for (const rebate of pendingRebates) {
            const t = await sequelize.transaction();
            
            try {
                // Credit to wallet
                await updateWalletBalance(rebate.user_id, rebate.rebate_amount, 'add', t);
                
                // Update rebate status
                await rebate.update({
                    status: 'credited',
                    credited_at: new Date()
                }, { transaction: t });

                await t.commit();
                processedCount++;

            } catch (error) {
                await t.rollback();
                console.error(`❌ Error processing rebate ${rebate.id}:`, error);
                errorCount++;
            }
        }

        console.log(`✅ Bulk self rebate processing completed: ${processedCount} processed, ${errorCount} errors`);

        return {
            success: true,
            processed: processedCount,
            errors: errorCount
        };

    } catch (error) {
        console.error('❌ Error in bulk self rebate processing:', error);
        return {
            success: false,
            message: 'Error in bulk processing: ' + error.message
        };
    }
};

module.exports = {
    processSelfRebate,
    getSelfRebateHistory,
    getSelfRebateStats,
    processBulkSelfRebates,
    HOUSE_GAMES
};