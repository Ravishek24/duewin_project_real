const User = require('../models/User');
const UserVipLevel = require('../models/UserVipLevel');
const UserExperience = require('../models/UserExperience');
const UserLoginHistory = require('../models/UserLoginHistory');
const BetRecordWingo = require('../models/BetRecordWingo');
const BetRecord5D = require('../models/BetRecord5D');
const BetRecordK3 = require('../models/BetRecordK3');
const BetRecordTrxWix = require('../models/BetRecordTrxWix');
const { Op } = require('sequelize');
const { logger } = require('../utils/logger');

/**
 * Get comprehensive user details
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getUserDetails = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get user basic info
        const user = await User.findByPk(userId, {
            attributes: [
                'id', 'username', 'email', 'balance', 
                'created_at', 'last_login', 'status'
            ]
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get VIP level info
        const vipInfo = await UserVipLevel.findOne({
            where: { user_id: userId },
            attributes: ['level', 'points', 'next_level_points', 'benefits']
        });

        // Get experience info
        const expInfo = await UserExperience.findOne({
            where: { user_id: userId },
            attributes: ['current_level', 'current_exp', 'total_exp', 'next_level_exp']
        });

        // Get last 5 login history
        const loginHistory = await UserLoginHistory.findAll({
            where: { user_id: userId },
            order: [['login_time', 'DESC']],
            limit: 5,
            attributes: ['login_time', 'ip_address', 'device_info']
        });

        // Get internal game stats
        const internalGameStats = await getInternalGameStats(userId);

        // Get external game stats
        const externalGameStats = await getExternalGameStats(userId);

        // Compile response
        const response = {
            success: true,
            data: {
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    balance: user.balance,
                    created_at: user.created_at,
                    last_login: user.last_login,
                    status: user.status
                },
                vip: vipInfo || {
                    level: 0,
                    points: 0,
                    next_level_points: 0,
                    benefits: []
                },
                experience: expInfo || {
                    current_level: 1,
                    current_exp: 0,
                    total_exp: 0,
                    next_level_exp: 100
                },
                login_history: loginHistory,
                game_stats: {
                    internal: internalGameStats,
                    external: externalGameStats
                }
            }
        };

        res.json(response);

    } catch (error) {
        logger.error('Error in getUserDetails:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};

/**
 * Get internal game statistics
 * @param {number} userId - User ID
 * @returns {Object} Game statistics
 */
const getInternalGameStats = async (userId) => {
    try {
        // Get last 30 days date
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const limit = 50;

        // Helper to format bet records
        const formatBets = (bets) => bets.map(bet => ({
            bet_amount: bet.bet_amount,
            win_amount: bet.win_amount,
            profit_loss: (bet.win_amount || 0) - (bet.bet_amount || 0),
            period_id: bet.period || bet.period_id,
            bet_type: bet.bet_type,
            bet_value: bet.bet_value,
            created_at: bet.created_at
        }));

        // Fetch all bet types in parallel to avoid N+1 query pattern
        const [wingoBets, fiveDBets, k3Bets, trxWixBets] = await Promise.all([
            BetRecordWingo.findAll({ where: { user_id: userId } }),
            BetRecord5D.findAll({ where: { user_id: userId } }),
            BetRecordK3.findAll({ where: { user_id: userId } }),
            BetRecordTrxWix.findAll({ where: { user_id: userId } })
        ]);

        return {
            wingo: formatBets(wingoBets),
            fiveD: formatBets(fiveDBets),
            k3: formatBets(k3Bets),
            trx_wix: formatBets(trxWixBets)
        };
    } catch (error) {
        logger.error('Error in getInternalGameStats:', error);
        return {
            wingo: [],
            fiveD: [],
            k3: [],
            trx_wix: []
        };
    }
};

/**
 * Get external game statistics
 * @param {number} userId - User ID
 * @returns {Object} Game statistics
 */
const getExternalGameStats = async (userId) => {
    try {
        // Get last 30 days date
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Get external game stats from seamless integration
        const externalStats = await ExternalGameRecord.findAll({
            where: {
                user_id: userId,
                created_at: { [Op.gte]: thirtyDaysAgo }
            },
            attributes: [
                'game_provider',
                [sequelize.fn('COUNT', sequelize.col('id')), 'total_bets'],
                [sequelize.fn('SUM', sequelize.col('bet_amount')), 'total_bet_amount'],
                [sequelize.fn('SUM', sequelize.col('win_amount')), 'total_win_amount']
            ],
            group: ['game_provider']
        });

        // Format the response with win/loss calculation
        const formattedStats = {};
        externalStats.forEach(stat => {
            const totalBetAmount = parseFloat(stat.get('total_bet_amount')) || 0;
            const totalWinAmount = parseFloat(stat.get('total_win_amount')) || 0;
            const profitLoss = totalWinAmount - totalBetAmount;

            formattedStats[stat.game_provider] = {
                total_bets: parseInt(stat.get('total_bets')) || 0,
                total_bet_amount: totalBetAmount,
                total_win_amount: totalWinAmount,
                profit_loss: profitLoss,
                win_rate: totalBetAmount > 0 ? ((totalWinAmount / totalBetAmount) * 100).toFixed(2) : 0
            };
        });

        return formattedStats;

    } catch (error) {
        logger.error('Error in getExternalGameStats:', error);
        return {};
    }
};

module.exports = {
    getUserDetails
}; 