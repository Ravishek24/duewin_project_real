// Backend/services/selfRebateService.js
const { getSequelizeInstance } = require('../config/db');
const { Op, fn, col, Transaction: SequelizeTransaction } = require('sequelize');

// Import models
const User = require('../models/User');
const SelfRebate = require('../models/SelfRebate');
const VipLevel = require('../models/VipLevel');
const Transaction = require('../models/Transaction');

// Import wallet service
const { updateWalletBalance } = require('./walletBalanceUtils');

// 🎯 Import CreditService for wagering system integration
const CreditService = require('./creditService');

/**
 * House games list - only these games qualify for self rebate
 */
const HOUSE_GAMES = ['wingo', '5d', 'k3', 'trx_wix'];

/**
 * Queue to prevent concurrent processing of rebates for the same user
 */
const userRebateQueue = new Map();

/**
 * Get or create queue for a specific user
 */
const getUserQueue = (userId) => {
    if (!userRebateQueue.has(userId)) {
        userRebateQueue.set(userId, []);
    }
    return userRebateQueue.get(userId);
};

/**
 * Process queue for a specific user
 */
const processUserQueue = async (userId) => {
    const queue = getUserQueue(userId);
    
    while (queue.length > 0) {
        const { resolve, reject, params } = queue.shift();
        
        try {
            const result = await processSelfRebateInternal(...params);
            resolve(result);
        } catch (error) {
            reject(error);
        }
    }
    
    // Clean up empty queue
    if (queue.length === 0) {
        userRebateQueue.delete(userId);
    }
};

/**
 * Queue rebate processing for a user
 */
const queueRebateProcessing = async (userId, betAmount, gameType, gameId, betReferenceId, transaction) => {
    return new Promise((resolve, reject) => {
        const queue = getUserQueue(userId);
        queue.push({ resolve, reject, params: [userId, betAmount, gameType, gameId, betReferenceId, transaction] });
        
        // Process queue if this is the first item
        if (queue.length === 1) {
            processUserQueue(userId);
        }
    });
};

/**
 * Retry configuration for deadlock handling
 */
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 100, // ms
    maxDelay: 2000, // ms
    backoffMultiplier: 2
};

/**
 * Exponential backoff delay
 */
const getBackoffDelay = (attempt) => {
    const delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt);
    return Math.min(delay, RETRY_CONFIG.maxDelay);
};

/**
 * Process self rebate for a house game bet with deadlock prevention
 */
const processSelfRebate = async (userId, betAmount, gameType, gameId = null, betReferenceId = null, transaction = null) => {
    // Use queue to prevent concurrent processing for the same user
    return await queueRebateProcessing(userId, betAmount, gameType, gameId, betReferenceId, transaction);
};

/**
 * Internal function to process self rebate (called by queue)
 */
const processSelfRebateInternal = async (userId, betAmount, gameType, gameId = null, betReferenceId = null, transaction = null) => {
    let attempt = 0;
    
    while (attempt < RETRY_CONFIG.maxRetries) {
        try {
            // Check if game type is eligible
            if (!HOUSE_GAMES.includes(gameType.toLowerCase())) {
                console.log(`Game type ${gameType} is not eligible for self rebate`);
                return null;
            }

            // Use provided transaction or create new one
            const sequelize = await getSequelizeInstance();
            const t = transaction || await sequelize.transaction({
                isolationLevel: SequelizeTransaction.ISOLATION_LEVELS.READ_COMMITTED
            });

            try {
                // Get user details with VIP level using FOR UPDATE to prevent race conditions
                const user = await User.findByPk(userId, {
                    include: [{
                        model: VipLevel,
                        foreignKey: 'vip_level',
                        targetKey: 'level',
                        as: 'vipuser',
                        attributes: ['rebate_rate'],
                        required: false
                    }],
                    lock: true,
                    transaction: t
                });

                if (!user) {
                    console.log(`User ${userId} not found`);
                    if (!transaction) await t.rollback();
                    return null;
                }

                // Get rebate rate from VIP level (stored as percentage, e.g., 0.05 for 5%)
                // If user's VIP level is 0, use level 1's rebate rate, otherwise use their current level's rate
                const effectiveVipLevel = user.vip_level === 0 ? 1 : user.vip_level;
                const vipLevel = await VipLevel.findOne({
                    where: { level: effectiveVipLevel },
                    attributes: ['rebate_rate'],
                    transaction: t
                });

                const rebateRate = vipLevel ? vipLevel.rebate_rate : 0;
                console.log(`User VIP level: ${user.vip_level}, effective level: ${effectiveVipLevel}, rebate rate: ${rebateRate}`);

                // Always treat rebate_rate as a decimal (e.g., 0.005 means 0.5%)
                const effectiveRate = parseFloat(rebateRate); // Use decimal directly
                const rebateAmount = parseFloat(betAmount) * effectiveRate;
                console.log(`Calculated rebate amount: ${rebateAmount}`);

                if (rebateAmount <= 0) {
                    console.log('Rebate amount is 0 or negative, skipping');
                    if (!transaction) await t.rollback();
                    return null;
                }

                // Get current balance before increment
                const currentBalance = parseFloat(user.wallet_balance);
                const newBalance = currentBalance + rebateAmount;

                // Update user's wallet balance using atomic increment
                await user.increment('wallet_balance', {
                    by: rebateAmount,
                    transaction: t
                });

                // Create rebate record first
                const rebate = await SelfRebate.create({
                    user_id: userId,
                    bet_amount: betAmount,
                    rebate_rate: rebateRate, // Store as decimal (e.g., 0.05 for 5%)
                    rebate_amount: rebateAmount,
                    game_type: gameType.toLowerCase(),
                    game_id: gameId,
                    vip_level: user.vip_level,
                    bet_reference_id: betReferenceId,
                    status: 'credited'
                }, { transaction: t });

                // Create transaction record
                await Transaction.create({
                    user_id: userId,
                    type: 'self_rebate',
                    amount: rebateAmount,
                    previous_balance: currentBalance,
                    new_balance: newBalance,
                    reference_id: `self_rebate_${rebate.id}`,
                    status: 'completed',
                    description: `Self rebate for ${gameType} game`,
                    game_type: gameType,
                    game_id: gameId,
                    metadata: {
                        rebate_id: rebate.id,
                        bet_amount: betAmount,
                        rebate_rate: rebateRate,
                        vip_level: user.vip_level,
                        bet_reference_id: betReferenceId
                    }
                }, { transaction: t });

                // 🎯 Create credit transaction for wagering tracking - pass the transaction
                await CreditService.addCreditWithTransaction(
                    userId,
                    rebateAmount,
                    'betting_rebate',
                    'self',
                    `self_rebate_${Date.now()}_${userId}`,
                    `Self rebate for ${gameType} game (VIP Level ${user.vip_level})`,
                    t
                );

                // Only commit if we created a new transaction
                if (!transaction) {
                    await t.commit();
                }
                console.log(`Self rebate processed successfully for user ${userId}, amount ${rebateAmount}`);
                return rebate;

            } catch (error) {
                // Only rollback if we created a new transaction
                if (!transaction) {
                    await t.rollback();
                }
                throw error;
            }

        } catch (error) {
            attempt++;
            
            // Check if it's a deadlock error
            if (error.code === 'ER_LOCK_WAIT_TIMEOUT' || 
                error.code === 'ER_LOCK_DEADLOCK' ||
                error.message.includes('Lock wait timeout exceeded') ||
                error.message.includes('Deadlock found')) {
                
                console.warn(`⚠️ Deadlock detected on attempt ${attempt} for user ${userId}, retrying...`);
                
                if (attempt >= RETRY_CONFIG.maxRetries) {
                    console.error(`❌ Max retries exceeded for user ${userId}, giving up`);
                    throw error;
                }
                
                // Wait before retry with exponential backoff
                const delay = getBackoffDelay(attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            
            // For non-deadlock errors, don't retry
            console.error('Error in processSelfRebate:', error);
            throw error;
        }
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
                'game_type', 'vip_level', 'status', 'created_at'
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
                vipLevel: rebate.vip_level,
                status: rebate.status,
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

        // Get today's date (start of day)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const stats = await SelfRebate.findAll({
            where: {
                user_id: userId,
                created_at: { [Op.gte]: startDate }
            },
            attributes: [
                [fn('COUNT', col('id')), 'total_rebates'],
                [fn('SUM', col('bet_amount')), 'total_bet_amount'],
                [fn('SUM', col('rebate_amount')), 'total_rebate_amount'],
                [fn('AVG', col('rebate_rate')), 'avg_rebate_rate']
            ],
            raw: true
        });

        // Get today's rebate amount specifically
        const todayStats = await SelfRebate.findAll({
            where: {
                user_id: userId,
                created_at: { [Op.gte]: todayStart }
            },
            attributes: [
                [fn('SUM', col('rebate_amount')), 'today_rebate_amount']
            ],
            raw: true
        });

        // Get breakdown by game type
        const gameBreakdown = await SelfRebate.findAll({
            where: {
                user_id: userId,
                created_at: { [Op.gte]: startDate }
            },
            attributes: [
                'game_type',
                [fn('COUNT', col('id')), 'count'],
                [fn('SUM', col('bet_amount')), 'total_bet'],
                [fn('SUM', col('rebate_amount')), 'total_rebate']
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

        const todayRebateAmount = parseFloat(todayStats[0]?.today_rebate_amount || 0);

        return {
            success: true,
            period: `Last ${days} days`,
            summary: {
                totalRebates: parseInt(totalStats.total_rebates) || 0,
                totalBetAmount: parseFloat(totalStats.total_bet_amount) || 0,
                totalRebateAmount: parseFloat(totalStats.total_rebate_amount) || 0,
                todayRebateAmount: todayRebateAmount,
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
            const sequelize = await getSequelizeInstance();
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
