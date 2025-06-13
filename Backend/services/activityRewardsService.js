// Backend/services/activityRewardService.js
const { sequelize } = require('../config/db');
const { Op } = require('sequelize');
const moment = require('moment-timezone');

// Import models
const User = require('../models/User');
const ActivityReward = require('../models/ActivityReward');
const Transaction = require('../models/Transaction');

// Import wallet service
const { updateWalletBalance } = require('./referralService');

/**
 * Activity reward milestones configuration
 */
const ACTIVITY_MILESTONES = {
    lottery: {
        50000: { amount: 200, description: '50K Lottery Betting Milestone' },
        100000: { amount: 500, description: '100K Lottery Betting Milestone' }
    },
    all_games: {
        500: { amount: 2, description: '500 All Games Betting Milestone' }
    }
};

/**
 * Process bet for activity rewards
 */
const processBetForActivityReward = async (userId, betAmount, gameType, transaction = null) => {
    const t = transaction || await sequelize.transaction();
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

        // Check and process milestones
        const rewardsEarned = await checkAndProcessMilestones(activityRecord, t);

        if (shouldCommit) await t.commit();

        return {
            success: true,
            message: 'Activity reward processed',
            rewardsEarned,
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
};

/**
 * Check and process milestones for activity rewards
 */
const checkAndProcessMilestones = async (activityRecord, transaction) => {
    const rewardsEarned = [];

    try {
        const userId = activityRecord.user_id;
        const lotteryAmount = parseFloat(activityRecord.lottery_bet_amount);
        const allGamesAmount = parseFloat(activityRecord.all_games_bet_amount);
        const claimedMilestones = activityRecord.claimed_milestones || {};

        // Check lottery milestones
        if (lotteryAmount >= 50000 && !claimedMilestones.lottery_50k) {
            const reward = ACTIVITY_MILESTONES.lottery[50000];
            await processRewardClaim(userId, reward.amount, 'lottery_50k', reward.description, transaction);
            
            claimedMilestones.lottery_50k = true;
            await activityRecord.update({
                claimed_milestones: claimedMilestones,
                total_rewards: parseFloat(activityRecord.total_rewards) + reward.amount
            }, { transaction });

            rewardsEarned.push({
                type: 'lottery',
                milestone: '50K',
                amount: reward.amount,
                description: reward.description
            });
        }

        if (lotteryAmount >= 100000 && !claimedMilestones.lottery_100k) {
            const reward = ACTIVITY_MILESTONES.lottery[100000];
            await processRewardClaim(userId, reward.amount, 'lottery_100k', reward.description, transaction);
            
            claimedMilestones.lottery_100k = true;
            await activityRecord.update({
                claimed_milestones: claimedMilestones,
                total_rewards: parseFloat(activityRecord.total_rewards) + reward.amount
            }, { transaction });

            rewardsEarned.push({
                type: 'lottery',
                milestone: '100K',
                amount: reward.amount,
                description: reward.description
            });
        }

        // Check all games milestone
        if (allGamesAmount >= 500 && !claimedMilestones.all_games_500) {
            const reward = ACTIVITY_MILESTONES.all_games[500];
            await processRewardClaim(userId, reward.amount, 'all_games_500', reward.description, transaction);
            
            claimedMilestones.all_games_500 = true;
            await activityRecord.update({
                claimed_milestones: claimedMilestones,
                total_rewards: parseFloat(activityRecord.total_rewards) + reward.amount
            }, { transaction });

            rewardsEarned.push({
                type: 'all_games',
                milestone: '500',
                amount: reward.amount,
                description: reward.description
            });
        }

        return rewardsEarned;

    } catch (error) {
        console.error('❌ Error checking milestones:', error);
        throw error;
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
                auto_credited: true
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

        const activityRecord = await ActivityReward.findOne({
            where: {
                user_id: userId,
                date: today
            }
        });

        if (!activityRecord) {
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
                        '500': { target: 500, achieved: false, reward: 2, claimed: false }
                    },
                    totalRewards: 0
                },
                totalRewardsEarned: 0
            };
        }

        const lotteryAmount = parseFloat(activityRecord.lottery_bet_amount);
        const allGamesAmount = parseFloat(activityRecord.all_games_bet_amount);
        const claimedMilestones = activityRecord.claimed_milestones || {};

        return {
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
                        reward: 2,
                        claimed: claimedMilestones.all_games_500 || false
                    }
                },
                totalRewards: parseFloat(activityRecord.total_rewards)
            },
            totalRewardsEarned: parseFloat(activityRecord.total_rewards)
        };

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
    const t = await sequelize.transaction();
    
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
            return {
                success: false,
                message: 'No activity record found for today'
            };
        }

        const claimedMilestones = activityRecord.claimed_milestones || {};
        const milestoneKeyInDb = `${milestoneType}_${milestoneKey}`;

        // Check if already claimed
        if (claimedMilestones[milestoneKeyInDb]) {
            await t.rollback();
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
            if (milestoneKey === '50K' && lotteryAmount >= 50000) {
                isAchieved = true;
                rewardAmount = ACTIVITY_MILESTONES.lottery[50000].amount;
            } else if (milestoneKey === '100K' && lotteryAmount >= 100000) {
                isAchieved = true;
                rewardAmount = ACTIVITY_MILESTONES.lottery[100000].amount;
            }
        } else if (milestoneType === 'all_games') {
            const allGamesAmount = parseFloat(activityRecord.all_games_bet_amount);
            if (milestoneKey === '500' && allGamesAmount >= 500) {
                isAchieved = true;
                rewardAmount = ACTIVITY_MILESTONES.all_games[500].amount;
            }
        }

        if (!isAchieved) {
            await t.rollback();
            return {
                success: false,
                message: 'Milestone not yet achieved'
            };
        }

        // Process the reward
        await processRewardClaim(
            userId,
            rewardAmount,
            milestoneKeyInDb,
            `${milestoneType.toUpperCase()} ${milestoneKey} Milestone Reward`,
            t
        );

        // Update claimed milestones
        claimedMilestones[milestoneKeyInDb] = true;
        await activityRecord.update({
            claimed_milestones: claimedMilestones,
            total_rewards: parseFloat(activityRecord.total_rewards) + rewardAmount
        }, { transaction: t });

        await t.commit();

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
        console.error('❌ Error claiming milestone reward:', error);
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
    checkAndProcessMilestones,
    ACTIVITY_MILESTONES
};