// Backend/services/activityRewardService.js
const db = require('../config/db');
const { Op } = require('sequelize');
const moment = require('moment-timezone');

// Import models
const User = require('../models/User');
const ActivityReward = require('../models/ActivityReward');
const Transaction = require('../models/Transaction');

// Import wallet service
const { updateWalletBalance } = require('./walletBalanceUtils');

/**
 * Activity reward milestones configuration
 */
const ACTIVITY_MILESTONES = {
    lottery: {
        50000: { amount: 200, description: '50K Lottery Betting Milestone' },
        100000: { amount: 500, description: '100K Lottery Betting Milestone' }
    },
    all_games: {
        500: { amount: 10, description: '500 All Games Betting Milestone' }
    }
};

/**
 * Process bet for activity rewards
 */
const processBetForActivityReward = async (userId, betAmount, gameType, transaction = null) => {
    try {
        // Ensure database is initialized
        if (!db.sequelize) {
            console.log('🔄 [ACTIVITY_REWARD] Database not initialized, attempting to connect...');
            await db.initializeDatabase();
        }

        const t = transaction || await db.sequelize.transaction();
        const shouldCommit = !transaction;

        try {
            console.log(`🎯 Processing activity reward for user ${userId}: ${betAmount} in ${gameType}`);

            const today = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
            const betAmountFloat = parseFloat(betAmount);

            // Get or create today's activity record
            let activityRecord = await ActivityReward.findOne({
                where: {
                    user_id: userId,
                    date: today
                },
                transaction: t
            });

            if (!activityRecord) {
                activityRecord = await ActivityReward.create({
                    user_id: userId,
                    date: today,
                    lottery_bet_amount: 0,
                    all_games_bet_amount: 0,
                    claimed_milestones: {},
                    total_rewards: 0
                }, { transaction: t });
            }

            // Determine if this is a lottery game
            const isLotteryGame = ['wingo', '5d', 'k3', 'trx_wix'].includes(gameType.toLowerCase());

            // Update bet amounts
            const updateData = {
                all_games_bet_amount: parseFloat(activityRecord.all_games_bet_amount) + betAmountFloat
            };

            if (isLotteryGame) {
                updateData.lottery_bet_amount = parseFloat(activityRecord.lottery_bet_amount) + betAmountFloat;
            }

            await activityRecord.update(updateData, { transaction: t });

            // REMOVED: Automatic milestone processing
            // Milestones will now only be claimed manually via API

            if (shouldCommit) await t.commit();

            return {
                success: true,
                message: 'Activity reward processed (manual claiming only)',
                rewardsEarned: [], // No automatic rewards
                updatedBetAmounts: {
                    lottery: parseFloat(activityRecord.lottery_bet_amount),
                    allGames: parseFloat(activityRecord.all_games_bet_amount)
                }
            };

        } catch (error) {
            if (shouldCommit) await t.rollback();
            console.error('❌ Error processing activity reward:', error);
            return {
                success: false,
                message: 'Error processing activity reward: ' + error.message
            };
        }
    } catch (error) {
        console.error('❌ Error in processBetForActivityReward:', error);
        return {
            success: false,
            message: 'Error processing activity reward: ' + error.message
        };
    }
};

/**
 * Process reward claim - credit to wallet and create transaction
 */
const processRewardClaim = async (userId, amount, rewardType, description, transaction) => {
    try {
        // Credit to wallet
        await updateWalletBalance(userId, amount, 'add', transaction);

        // Create transaction record
        await Transaction.create({
            user_id: userId,
            type: 'activity_reward',
            amount: amount,
            status: 'completed',
            description: description,
            reference_id: `activity_${rewardType}_${userId}_${Date.now()}`,
            metadata: {
                reward_type: rewardType,
                auto_credited: false // Changed to false since it's manual claiming
            }
        }, { transaction });

        console.log(`✅ Activity reward credited: ${amount} to user ${userId} for ${description}`);

    } catch (error) {
        console.error('❌ Error processing reward claim:', error);
        throw error;
    }
};

/**
 * Get user's activity reward status for today
 */
const getTodayActivityStatus = async (userId) => {
    try {
        const today = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
        console.log(`🔍 [ACTIVITY_STATUS] Getting status for user ${userId} on ${today}`);

        const activityRecord = await ActivityReward.findOne({
            where: {
                user_id: userId,
                date: today
            }
        });

        if (!activityRecord) {
            console.log(`📝 [ACTIVITY_STATUS] No activity record found for user ${userId} on ${today}`);
            return {
                success: true,
                date: today,
                lottery: {
                    betAmount: 0,
                    milestones: {
                        '50K': { target: 50000, achieved: false, reward: 200, claimed: false },
                        '100K': { target: 100000, achieved: false, reward: 500, claimed: false }
                    },
                    totalRewards: 0
                },
                allGames: {
                    betAmount: 0,
                    milestones: {
                        '500': { target: 500, achieved: false, reward: 10, claimed: false }
                    },
                    totalRewards: 0
                },
                totalRewardsEarned: 0
            };
        }

        const lotteryAmount = parseFloat(activityRecord.lottery_bet_amount);
        const allGamesAmount = parseFloat(activityRecord.all_games_bet_amount);
        const claimedMilestones = activityRecord.claimed_milestones || {};

        console.log(`📊 [ACTIVITY_STATUS] User ${userId} activity data:`, {
            lotteryAmount,
            allGamesAmount,
            claimedMilestones: JSON.stringify(claimedMilestones),
            claimedMilestonesType: typeof claimedMilestones,
            totalRewards: activityRecord.total_rewards
        });

        // Debug: Log the raw database record
        console.log(`🗄️ [ACTIVITY_STATUS] Raw database record:`, {
            id: activityRecord.id,
            user_id: activityRecord.user_id,
            date: activityRecord.date,
            claimed_milestones_raw: activityRecord.claimed_milestones,
            claimed_milestones_raw_type: typeof activityRecord.claimed_milestones,
            total_rewards: activityRecord.total_rewards
        });

        const response = {
            success: true,
            date: today,
            lottery: {
                betAmount: lotteryAmount,
                milestones: {
                    '50K': {
                        target: 50000,
                        achieved: lotteryAmount >= 50000,
                        reward: 200,
                        claimed: claimedMilestones.lottery_50k || false
                    },
                    '100K': {
                        target: 100000,
                        achieved: lotteryAmount >= 100000,
                        reward: 500,
                        claimed: claimedMilestones.lottery_100k || false
                    }
                },
                totalRewards: parseFloat(activityRecord.total_rewards)
            },
            allGames: {
                betAmount: allGamesAmount,
                milestones: {
                    '500': {
                        target: 500,
                        achieved: allGamesAmount >= 500,
                        reward: 10,
                        claimed: claimedMilestones.all_games_500 || false
                    }
                },
                totalRewards: parseFloat(activityRecord.total_rewards)
            },
            totalRewardsEarned: parseFloat(activityRecord.total_rewards)
        };

        console.log(`✅ [ACTIVITY_STATUS] Response for user ${userId}:`, {
            lotteryMilestones: response.lottery.milestones,
            allGamesMilestones: response.allGames.milestones
        });

        return response;

    } catch (error) {
        console.error('❌ Error getting activity status:', error);
        return {
            success: false,
            message: 'Error getting activity status: ' + error.message
        };
    }
};

/**
 * Get activity reward history
 */
const getActivityRewardHistory = async (userId, days = 30) => {
    try {
        const startDate = moment.tz('Asia/Kolkata').subtract(days, 'days').format('YYYY-MM-DD');
        const endDate = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');

        const activities = await ActivityReward.findAll({
            where: {
                user_id: userId,
                date: {
                    [Op.between]: [startDate, endDate]
                }
            },
            order: [['date', 'DESC']],
            attributes: [
                'date', 'lottery_bet_amount', 'all_games_bet_amount',
                'claimed_milestones', 'total_rewards'
            ]
        });

        const totalStats = activities.reduce((acc, activity) => {
            acc.totalLotteryBets += parseFloat(activity.lottery_bet_amount);
            acc.totalAllGamesBets += parseFloat(activity.all_games_bet_amount);
            acc.totalRewards += parseFloat(activity.total_rewards);
            
            // Count claimed milestones from JSON field
            const claimedMilestones = activity.claimed_milestones || {};
            acc.milestonesAchieved += Object.keys(claimedMilestones).length;
            
            return acc;
        }, {
            totalLotteryBets: 0,
            totalAllGamesBets: 0,
            totalRewards: 0,
            milestonesAchieved: 0
        });

        return {
            success: true,
            history: activities.map(activity => {
                const claimedMilestones = activity.claimed_milestones || {};
                return {
                    date: activity.date,
                    lotteryBetAmount: parseFloat(activity.lottery_bet_amount),
                    allGamesBetAmount: parseFloat(activity.all_games_bet_amount),
                    milestones: {
                        lottery50k: claimedMilestones.lottery_50k || false,
                        lottery100k: claimedMilestones.lottery_100k || false,
                        allGames500: claimedMilestones.all_games_500 || false
                    },
                    totalRewards: parseFloat(activity.total_rewards)
                };
            }),
            statistics: totalStats
        };

    } catch (error) {
        console.error('❌ Error getting activity history:', error);
        return {
            success: false,
            message: 'Error getting activity history: ' + error.message
        };
    }
};

/**
 * Claim a milestone reward manually
 */
const claimMilestoneReward = async (userId, milestoneType, milestoneKey) => {
    try {
        // Ensure database is initialized
        if (!db.sequelize) {
            console.log('🔄 [CLAIM_MILESTONE] Database not initialized, attempting to connect...');
            await db.initializeDatabase();
        }

        // Check if sequelize is available
        if (!db.sequelize) {
            console.error('❌ [CLAIM_MILESTONE] Sequelize is not available');
            return {
                success: false,
                message: 'Database connection not available'
            };
        }

        console.log(`🎯 [CLAIM_MILESTONE] Starting claim for user ${userId}: ${milestoneType} ${milestoneKey}`);
        
        const t = await db.sequelize.transaction();
        
        try {
            const today = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
            
            // Get today's activity record
            const activityRecord = await ActivityReward.findOne({
                where: {
                    user_id: userId,
                    date: today
                },
                transaction: t
            });

            if (!activityRecord) {
                await t.rollback();
                console.log(`📝 [CLAIM_MILESTONE] No activity record found for user ${userId} on ${today}`);
                return {
                    success: false,
                    message: 'No activity record found for today'
                };
            }

            const claimedMilestones = activityRecord.claimed_milestones || {};
            const milestoneKeyInDb = `${milestoneType}_${milestoneKey}`;

            console.log(`🔍 [CLAIM_MILESTONE] Checking milestone: ${milestoneKeyInDb}`);
            console.log(`📊 [CLAIM_MILESTONE] Current claimed milestones:`, JSON.stringify(claimedMilestones));

            // Check if already claimed
            if (claimedMilestones[milestoneKeyInDb]) {
                await t.rollback();
                console.log(`⚠️ [CLAIM_MILESTONE] Milestone ${milestoneKeyInDb} already claimed for user ${userId}`);
                return {
                    success: false,
                    message: 'This milestone reward has already been claimed'
                };
            }

            // Validate milestone achievement
            let isAchieved = false;
            let rewardAmount = 0;

            if (milestoneType === 'lottery') {
                const lotteryAmount = parseFloat(activityRecord.lottery_bet_amount);
                console.log(`🎲 [CLAIM_MILESTONE] Lottery amount for user ${userId}: ${lotteryAmount}`);
                
                if (milestoneKey === '50K' && lotteryAmount >= 50000) {
                    isAchieved = true;
                    rewardAmount = ACTIVITY_MILESTONES.lottery[50000].amount;
                } else if (milestoneKey === '100K' && lotteryAmount >= 100000) {
                    isAchieved = true;
                    rewardAmount = ACTIVITY_MILESTONES.lottery[100000].amount;
                }
            } else if (milestoneType === 'all_games') {
                const allGamesAmount = parseFloat(activityRecord.all_games_bet_amount);
                console.log(`🎮 [CLAIM_MILESTONE] All games amount for user ${userId}: ${allGamesAmount}`);
                
                if (milestoneKey === '500' && allGamesAmount >= 500) {
                    isAchieved = true;
                    rewardAmount = ACTIVITY_MILESTONES.all_games[500].amount;
                }
            }

            console.log(`✅ [CLAIM_MILESTONE] Milestone achievement check: ${isAchieved}, reward amount: ${rewardAmount}`);

            if (!isAchieved) {
                await t.rollback();
                console.log(`❌ [CLAIM_MILESTONE] Milestone not yet achieved for user ${userId}`);
                return {
                    success: false,
                    message: 'Milestone not yet achieved'
                };
            }

            // Process the reward
            console.log(`💰 [CLAIM_MILESTONE] Processing reward: ${rewardAmount} for user ${userId}`);
            await processRewardClaim(
                userId,
                rewardAmount,
                milestoneKeyInDb,
                `${milestoneType.toUpperCase()} ${milestoneKey} Milestone Reward`,
                t
            );

            // Update claimed milestones
            claimedMilestones[milestoneKeyInDb] = true;
            console.log(`📝 [CLAIM_MILESTONE] Updating claimed milestones:`, JSON.stringify(claimedMilestones));
            
            // Debug: Log the exact data being sent to update
            const updateData = {
                claimed_milestones: claimedMilestones,
                total_rewards: parseFloat(activityRecord.total_rewards) + rewardAmount
            };
            console.log(`🔧 [CLAIM_MILESTONE] Update data being sent:`, JSON.stringify(updateData));
            
            const updateResult = await activityRecord.update(updateData, { transaction: t });

            console.log(`💾 [CLAIM_MILESTONE] Update result:`, {
                claimed_milestones: updateResult.claimed_milestones,
                claimed_milestones_type: typeof updateResult.claimed_milestones,
                total_rewards: updateResult.total_rewards
            });

            // Debug: Verify the data was stored correctly by re-fetching
            await t.commit();
            
            // Re-fetch the record to verify storage
            const verifyRecord = await ActivityReward.findOne({
                where: {
                    user_id: userId,
                    date: today
                }
            });
            
            console.log(`🔍 [CLAIM_MILESTONE] Verification after commit:`, {
                claimed_milestones: verifyRecord.claimed_milestones,
                claimed_milestones_type: typeof verifyRecord.claimed_milestones,
                total_rewards: verifyRecord.total_rewards
            });

            return {
                success: true,
                message: 'Reward claimed successfully',
                reward: {
                    type: milestoneType,
                    milestone: milestoneKey,
                    amount: rewardAmount
                }
            };

        } catch (error) {
            await t.rollback();
            console.error('❌ [CLAIM_MILESTONE] Error in transaction:', error);
            throw error;
        }

    } catch (error) {
        console.error('❌ [CLAIM_MILESTONE] Error claiming milestone reward:', error);
        return {
            success: false,
            message: 'Error claiming reward: ' + error.message
        };
    }
};

module.exports = {
    processBetForActivityReward,
    getTodayActivityStatus,
    getActivityRewardHistory,
    claimMilestoneReward,
    ACTIVITY_MILESTONES
};