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
                reward_date: today
            },
            transaction: t
        });

        if (!activityRecord) {
            activityRecord = await ActivityReward.create({
                user_id: userId,
                reward_date: today,
                lottery_bet_amount: 0,
                all_games_bet_amount: 0,
                lottery_milestone_50k_claimed: false,
                lottery_milestone_100k_claimed: false,
                all_games_milestone_500_claimed: false,
                lottery_reward_earned: 0,
                all_games_reward_earned: 0,
                total_reward_earned: 0
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

        // Check lottery milestones
        if (lotteryAmount >= 50000 && !activityRecord.lottery_milestone_50k_claimed) {
            const reward = ACTIVITY_MILESTONES.lottery[50000];
            await processRewardClaim(userId, reward.amount, 'lottery_50k', reward.description, transaction);
            
            await activityRecord.update({
                lottery_milestone_50k_claimed: true,
                lottery_reward_earned: parseFloat(activityRecord.lottery_reward_earned) + reward.amount,
                total_reward_earned: parseFloat(activityRecord.total_reward_earned) + reward.amount
            }, { transaction });

            rewardsEarned.push({
                type: 'lottery',
                milestone: '50K',
                amount: reward.amount,
                description: reward.description
            });
        }

        if (lotteryAmount >= 100000 && !activityRecord.lottery_milestone_100k_claimed) {
            const reward = ACTIVITY_MILESTONES.lottery[100000];
            await processRewardClaim(userId, reward.amount, 'lottery_100k', reward.description, transaction);
            
            await activityRecord.update({
                lottery_milestone_100k_claimed: true,
                lottery_reward_earned: parseFloat(activityRecord.lottery_reward_earned) + reward.amount,
                total_reward_earned: parseFloat(activityRecord.total_reward_earned) + reward.amount
            }, { transaction });

            rewardsEarned.push({
                type: 'lottery',
                milestone: '100K',
                amount: reward.amount,
                description: reward.description
            });
        }

        // Check all games milestone
        if (allGamesAmount >= 500 && !activityRecord.all_games_milestone_500_claimed) {
            const reward = ACTIVITY_MILESTONES.all_games[500];
            await processRewardClaim(userId, reward.amount, 'all_games_500', reward.description, transaction);
            
            await activityRecord.update({
                all_games_milestone_500_claimed: true,
                all_games_reward_earned: parseFloat(activityRecord.all_games_reward_earned) + reward.amount,
                total_reward_earned: parseFloat(activityRecord.total_reward_earned) + reward.amount
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
                reward_date: today
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
                        claimed: activityRecord.lottery_milestone_50k_claimed
                    },
                    '100K': {
                        target: 100000,
                        achieved: lotteryAmount >= 100000,
                        reward: 500,
                        claimed: activityRecord.lottery_milestone_100k_claimed
                    }
                },
                totalRewards: parseFloat(activityRecord.lottery_reward_earned)
            },
            allGames: {
                betAmount: allGamesAmount,
                milestones: {
                    '500': {
                        target: 500,
                        achieved: allGamesAmount >= 500,
                        reward: 2,
                        claimed: activityRecord.all_games_milestone_500_claimed
                    }
                },
                totalRewards: parseFloat(activityRecord.all_games_reward_earned)
            },
            totalRewardsEarned: parseFloat(activityRecord.total_reward_earned)
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
 * Get user's activity reward history
 */
const getActivityRewardHistory = async (userId, days = 30) => {
    try {
        const startDate = moment.tz('Asia/Kolkata').subtract(days, 'days').format('YYYY-MM-DD');
        const endDate = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');

        const activities = await ActivityReward.findAll({
            where: {
                user_id: userId,
                reward_date: {
                    [Op.between]: [startDate, endDate]
                }
            },
            order: [['reward_date', 'DESC']],
            attributes: [
                'reward_date', 'lottery_bet_amount', 'all_games_bet_amount',
                'lottery_milestone_50k_claimed', 'lottery_milestone_100k_claimed',
                'all_games_milestone_500_claimed', 'lottery_reward_earned',
                'all_games_reward_earned', 'total_reward_earned'
            ]
        });

        const totalStats = activities.reduce((acc, activity) => {
            acc.totalLotteryBets += parseFloat(activity.lottery_bet_amount);
            acc.totalAllGamesBets += parseFloat(activity.all_games_bet_amount);
            acc.totalRewards += parseFloat(activity.total_reward_earned);
            acc.milestonesAchieved += (
                (activity.lottery_milestone_50k_claimed ? 1 : 0) +
                (activity.lottery_milestone_100k_claimed ? 1 : 0) +
                (activity.all_games_milestone_500_claimed ? 1 : 0)
            );
            return acc;
        }, {
            totalLotteryBets: 0,
            totalAllGamesBets: 0,
            totalRewards: 0,
            milestonesAchieved: 0
        });

        return {
            success: true,
            history: activities.map(activity => ({
                date: activity.reward_date,
                lotteryBetAmount: parseFloat(activity.lottery_bet_amount),
                allGamesBetAmount: parseFloat(activity.all_games_bet_amount),
                milestones: {
                    lottery50k: activity.lottery_milestone_50k_claimed,
                    lottery100k: activity.lottery_milestone_100k_claimed,
                    allGames500: activity.all_games_milestone_500_claimed
                },
                rewards: {
                    lottery: parseFloat(activity.lottery_reward_earned),
                    allGames: parseFloat(activity.all_games_reward_earned),
                    total: parseFloat(activity.total_reward_earned)
                }
            })),
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

module.exports = {
    processBetForActivityReward,
    getTodayActivityStatus,
    getActivityRewardHistory,
    checkAndProcessMilestones,
    ACTIVITY_MILESTONES
};