// Backend/services/autoVipService.js - Auto VIP Processing Service
const { getSequelizeInstance } = require('../config/db');
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const logger = require('../utils/logger');

// Import models
const User = require('../models/User');
const VipLevel = require('../models/VipLevel');
const VipReward = require('../models/VipReward');
const Transaction = require('../models/Transaction');
const UserVault = require('../models/UserVault');

// Import referral service for wallet updates
const { updateWalletBalance } = require('./referralService');

/**
 * Record VIP experience automatically when user places a bet
 * @param {number} userId - User ID
 * @param {number} betAmount - Bet amount
 * @param {string} gameType - Type of game (wingo, k3, 5d, trx_wix, casino)
 * @param {string} gameId - Specific game identifier
 * @param {Object} transaction - Database transaction (optional)
 * @returns {Object} - Operation result
 */
const recordVipExperience = async (userId, betAmount, gameType = 'unknown', gameId = null, transaction = null) => {
    const sequelize = await getSequelizeInstance();
    const t = transaction || await sequelize.transaction();
    const shouldCommit = !transaction; // Only commit if we created the transaction

    try {
        console.log(`🎮 [VIP_EXP] Starting VIP experience recording for user ${userId}`);
        console.log(`🎮 [VIP_EXP] Parameters: betAmount=${betAmount}, gameType=${gameType}, gameId=${gameId}`);

        // Get user current VIP status
        const user = await User.findByPk(userId, {
            attributes: ['user_id', 'user_name', 'vip_exp', 'vip_level'],
            transaction: t
        });

        if (!user) {
            console.error(`❌ [VIP_EXP] User ${userId} not found`);
            if (shouldCommit) await t.rollback();
            return {
                success: false,
                message: 'User not found'
            };
        }

        console.log(`🎮 [VIP_EXP] Found user: ${user.user_name}, current VIP level: ${user.vip_level}, current EXP: ${user.vip_exp}`);

        // Calculate EXP to add (1 EXP per 1 unit of bet amount)
        const expToAdd = Math.floor(parseFloat(betAmount));
        const currentExp = parseInt(user.vip_exp) || 0;
        const newExp = currentExp + expToAdd;

        console.log(`📈 [VIP_EXP] User ${userId}: Current EXP: ${currentExp}, Adding: ${expToAdd}, New Total: ${newExp}`);

        // Update user's VIP experience
        await user.update({ 
            vip_exp: newExp 
        }, { transaction: t });

        // Log after update
        const updatedUser = await User.findByPk(userId, { attributes: ['vip_exp'], transaction: t });
        console.log(`✅ [VIP_EXP] After update, user ${userId} VIP EXP is now: ${updatedUser.vip_exp}`);

        // Create VIP experience history record
        let historyRecord = null;
        try {
            historyRecord = await sequelize.models.VipExperienceHistory.create({
                user_id: userId,
                exp_gained: expToAdd,
                bet_amount: parseFloat(betAmount),
                game_type: gameType,
                game_id: gameId,
                exp_before: currentExp,
                exp_after: newExp,
                created_at: new Date()
            }, { transaction: t });
            console.log(`✅ [VIP_EXP] Created history record with ID: ${historyRecord.id}`);
        } catch (historyError) {
            console.error('❌ [VIP_EXP] Could not create VIP experience history:', historyError);
            console.error('❌ [VIP_EXP] Error details:', historyError.message);
            console.error('❌ [VIP_EXP] Error stack:', historyError.stack);
        }

        // Check for VIP level upgrades
        const levelUpResult = await checkVipLevelUp(userId, newExp, user.vip_level, t);

        if (shouldCommit) {
            await t.commit();
            console.log(`✅ [VIP_EXP] Transaction committed successfully`);
        }

        const result = {
            success: true,
            expGained: expToAdd,
            newTotalExp: newExp,
            oldLevel: user.vip_level,
            newLevel: levelUpResult.newLevel,
            leveledUp: levelUpResult.leveledUp,
            levelUpReward: levelUpResult.leveledUp ? levelUpResult.rewardAmount : null,
            nextLevelExp: levelUpResult.nextLevelExp,
            historyRecorded: !!historyRecord
        };

        if (levelUpResult.leveledUp) {
            console.log(`🎉 [VIP_EXP] User ${userId} leveled up from VIP ${user.vip_level} to VIP ${levelUpResult.newLevel}! Reward: ${levelUpResult.rewardAmount}`);
        }

        console.log(`🎉 [VIP_EXP] recordVipExperience result:`, result);
        return result;

    } catch (error) {
        if (shouldCommit) await t.rollback();
        console.error('❌ [VIP_EXP] Error recording VIP experience:', error);
        console.error('❌ [VIP_EXP] Error details:', error.message);
        console.error('❌ [VIP_EXP] Error stack:', error.stack);
        logger.error('Error recording VIP experience:', {
            userId,
            betAmount,
            gameType,
            error: error.message,
            stack: error.stack
        });
        return {
            success: false,
            message: 'Error recording VIP experience: ' + error.message
        };
    }
};

/**
 * Update vault interest rate when VIP level changes
 * @param {number} userId - User ID
 * @param {number} newLevel - New VIP level
 * @param {Object} transaction - Database transaction
 */
const updateVaultInterestRate = async (userId, newLevel, transaction) => {
    try {
        // Get the new VIP level details
        const vipLevel = await VipLevel.findOne({
            where: { level: newLevel },
            transaction
        });

        if (!vipLevel) {
            console.log(`⚠️ VIP level ${newLevel} not found for user ${userId}`);
            return;
        }

        // Get user's vault
        const vault = await UserVault.findOne({
            where: { user_id: userId },
            transaction
        });

        if (!vault) {
            console.log(`⚠️ Vault not found for user ${userId}`);
            return;
        }

        // Update vault interest rate
        await vault.update({
            interest_rate: vipLevel.vault_interest_rate
        }, { transaction });

        console.log(`✅ Updated vault interest rate for user ${userId} to ${vipLevel.vault_interest_rate}% (VIP ${newLevel})`);

    } catch (error) {
        console.error(`❌ Error updating vault interest rate for user ${userId}:`, error);
        throw error;
    }
};

/**
 * Check and process VIP level upgrades
 * @param {number} userId - User ID
 * @param {number} currentExp - Current experience points
 * @param {number} currentLevel - Current VIP level
 * @param {Object} transaction - Database transaction
 * @returns {Object} - Level up result
 */
const checkVipLevelUp = async (userId, currentExp, currentLevel, transaction) => {
    try {
        // Get all VIP levels
        const vipLevels = await VipLevel.findAll({
            order: [['level', 'ASC']],
            transaction
        });

        if (!vipLevels || vipLevels.length === 0) {
            return {
                leveledUp: false,
                newLevel: currentLevel,
                nextLevelExp: null
            };
        }

        // Find the highest level user qualifies for
        let newLevel = 0;
        let levelUpReward = null;
        let nextLevelExp = null;

        for (const vipLevel of vipLevels) {
            if (currentExp >= parseInt(vipLevel.required_exp)) {
                newLevel = vipLevel.level;
            } else {
                nextLevelExp = parseInt(vipLevel.required_exp);
                break;
            }
        }

        // Check if user actually leveled up
        if (newLevel > currentLevel) {
            console.log(`🆙 User ${userId} qualified for VIP level upgrade: ${currentLevel} -> ${newLevel}`);

            // Update user's VIP level
            await User.update(
                { vip_level: newLevel },
                { where: { user_id: userId }, transaction }
            );

            // Update vault interest rate
            await updateVaultInterestRate(userId, newLevel, transaction);

            // Get the new level details for reward
            const newLevelDetails = vipLevels.find(l => l.level === newLevel);
            levelUpReward = newLevelDetails ? parseFloat(newLevelDetails.bonus_amount) : 0;

            // Create pending VIP reward (will be processed at 12:30 AM)
            if (levelUpReward > 0) {
                // Check if reward already exists for this level
                const existingReward = await VipReward.findOne({
                    where: {
                        user_id: userId,
                        level: newLevel,
                        reward_type: 'level_up'
                    },
                    transaction
                });

                if (!existingReward) {
                    await VipReward.create({
                        user_id: userId,
                        level: newLevel,
                        reward_type: 'level_up',
                        amount: levelUpReward, // FIXED: was reward_amount
                        status: 'pending' // Will be processed by cron job
                    }, { transaction });

                    console.log(`🎁 Created pending VIP reward for user ${userId}: Level ${newLevel}, Amount: ${levelUpReward}`);
                }
            }

            return {
                leveledUp: true,
                newLevel,
                rewardAmount: levelUpReward,
                nextLevelExp
            };
        }

        return {
            leveledUp: false,
            newLevel: currentLevel,
            nextLevelExp
        };

    } catch (error) {
        console.error(`❌ Error in VIP level check for user ${userId}:`, error);
        throw error;
    }
};

/**
 * Get user's VIP status and progress
 * @param {number} userId - User ID
 * @returns {Object} - VIP status information
 */
const getUserVipStatus = async (userId) => {
    try {
        const user = await User.findByPk(userId, {
            attributes: ['user_id', 'user_name', 'vip_exp', 'vip_level']
        });

        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Get current level details
        const currentLevelDetails = await VipLevel.findOne({
            where: { level: user.vip_level }
        });

        // Get next level details
        const nextLevelDetails = await VipLevel.findOne({
            where: { level: user.vip_level + 1 }
        });

        // Get VIP experience history (last 10 records)
        let recentExpHistory = [];
        if (sequelize.models.VipExperienceHistory) {
            try {
                recentExpHistory = await sequelize.models.VipExperienceHistory.findAll({
                    where: { user_id: userId },
                    order: [['created_at', 'DESC']],
                    limit: 10,
                    attributes: ['exp_gained', 'bet_amount', 'game_type', 'created_at']
                });
            } catch (historyError) {
                console.warn('Could not fetch VIP history:', historyError.message);
            }
        }

        const result = {
            success: true,
            currentLevel: user.vip_level,
            currentExp: user.vip_exp,
            currentLevelReward: currentLevelDetails ? parseFloat(currentLevelDetails.bonus_amount) : 0,
            currentMonthlyReward: currentLevelDetails ? parseFloat(currentLevelDetails.monthly_reward) : 0,
            nextLevel: nextLevelDetails ? nextLevelDetails.level : null,
            nextLevelRequiredExp: nextLevelDetails ? parseInt(nextLevelDetails.required_exp) : null,
            expToNextLevel: nextLevelDetails ? Math.max(0, parseInt(nextLevelDetails.required_exp) - user.vip_exp) : 0,
            recentExpHistory: recentExpHistory.map(record => ({
                expGained: record.exp_gained,
                betAmount: record.bet_amount,
                gameType: record.game_type,
                date: record.created_at
            }))
        };

        return result;

    } catch (error) {
        console.error('❌ Error getting VIP status:', error);
        return {
            success: false,
            message: 'Error getting VIP status: ' + error.message
        };
    }
};

/**
 * Get user's VIP rewards history
 * @param {number} userId - User ID
 * @param {number} limit - Number of records to return
 * @returns {Object} - VIP rewards history
 */
const getUserVipRewardsHistory = async (userId, limit = 20) => {
    try {
        const rewards = await VipReward.findAll({
            where: { user_id: userId },
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            attributes: ['level', 'reward_type', 'reward_amount', 'status', 'created_at']
        });

        return {
            success: true,
            rewards: rewards.map(reward => ({
                level: reward.level,
                type: reward.reward_type,
                amount: parseFloat(reward.reward_amount),
                status: reward.status,
                date: reward.created_at
            }))
        };

    } catch (error) {
        console.error('❌ Error getting VIP rewards history:', error);
        return {
            success: false,
            message: 'Error getting VIP rewards history: ' + error.message
        };
    }
};

/**
 * Get VIP statistics for admin dashboard
 * @returns {Object} - VIP system statistics
 */
const getVipStatistics = async () => {
    try {
        // Get VIP level distribution
        const levelDistribution = await sequelize.query(`
            SELECT 
                vip_level,
                COUNT(*) as user_count,
                AVG(vip_exp) as avg_exp,
                SUM(vip_exp) as total_exp
            FROM users 
            WHERE vip_level >= 0
            GROUP BY vip_level
            ORDER BY vip_level ASC
        `, {
            type: sequelize.QueryTypes.SELECT
        });

        // Get recent level ups (last 30 days)
        const thirtyDaysAgo = moment().subtract(30, 'days').toDate();
        const recentLevelUps = await VipReward.count({
            where: {
                reward_type: 'level_up',
                created_at: { [Op.gte]: thirtyDaysAgo }
            }
        });

        // Get total rewards distributed this month
        const startOfMonth = moment().startOf('month').toDate();
        const monthlyRewardsData = await VipReward.findAll({
            where: {
                status: 'completed',
                created_at: { [Op.gte]: startOfMonth }
            },
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                [sequelize.fn('SUM', sequelize.col('reward_amount')), 'total_amount']
            ],
            group: ['reward_type'],
            raw: true
        });

        return {
            success: true,
            statistics: {
                levelDistribution,
                recentLevelUps,
                monthlyRewards: monthlyRewardsData,
                lastUpdated: new Date()
            }
        };

    } catch (error) {
        console.error('❌ Error getting VIP statistics:', error);
        return {
            success: false,
            message: 'Error getting VIP statistics: ' + error.message
        };
    }
};

module.exports = {
    recordVipExperience,
    checkVipLevelUp,
    getUserVipStatus,
    getUserVipRewardsHistory,
    getVipStatistics
};
