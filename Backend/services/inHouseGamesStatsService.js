const { getModels } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const moment = require('moment-timezone');

/**
 * Get date range based on period type
 * @param {string} period - 'today', 'yesterday', 'this_week', 'this_month'
 * @returns {Object} - Start and end dates
 */
const getDateRange = (period) => {
    const now = moment();
    let startDate, endDate;

    switch (period) {
        case 'today':
            startDate = now.startOf('day').toDate();
            endDate = now.endOf('day').toDate();
            break;
        case 'yesterday':
            startDate = now.subtract(1, 'day').startOf('day').toDate();
            endDate = now.endOf('day').toDate();
            break;
        case 'this_week':
            startDate = now.startOf('week').toDate();
            endDate = now.endOf('week').toDate();
            break;
        case 'this_month':
            startDate = now.startOf('month').toDate();
            endDate = now.endOf('month').toDate();
            break;
        default:
            startDate = now.startOf('day').toDate();
            endDate = now.endOf('day').toDate();
    }

    return { startDate, endDate };
};

/**
 * Get in-house games statistics for a user
 * @param {number} userId - User ID
 * @param {string} period - Time period ('today', 'yesterday', 'this_week', 'this_month')
 * @returns {Object} - Statistics data
 */
const getInHouseGamesStats = async (userId, period = 'today') => {
    try {
        console.log(`📊 Getting in-house games stats for user ${userId}, period: ${period}`);

        // Get initialized models
        const models = await getModels();
        const { BetRecordWingo, BetRecord5D, BetRecordK3, BetRecordTrxWix } = models;

        // Get date range
        const { startDate, endDate } = getDateRange(period);

        // Common where clause for date filtering
        const dateFilter = {
            user_id: userId,
            created_at: {
                [Op.between]: [startDate, endDate]
            }
        };

        // Get statistics for each game type
        const gameStats = {};

        // Wingo Statistics
        const wingoStats = await BetRecordWingo.findAll({
            where: dateFilter,
            attributes: [
                [fn('COUNT', col('bet_id')), 'total_bets'],
                [fn('SUM', col('bet_amount')), 'total_bet_amount'],
                [fn('SUM', col('win_amount')), 'total_win_amount'],
                [fn('SUM', literal('CASE WHEN status = "won" THEN 1 ELSE 0 END')), 'winning_bets'],
                [fn('SUM', literal('CASE WHEN status = "lost" THEN 1 ELSE 0 END')), 'losing_bets'],
                [fn('SUM', literal('CASE WHEN status = "pending" THEN 1 ELSE 0 END')), 'pending_bets']
            ],
            raw: true
        });

        gameStats.wingo = {
            total_bets: parseInt(wingoStats[0]?.total_bets || 0),
            total_bet_amount: parseFloat(wingoStats[0]?.total_bet_amount || 0),
            total_win_amount: parseFloat(wingoStats[0]?.total_win_amount || 0),
            winning_bets: parseInt(wingoStats[0]?.winning_bets || 0),
            losing_bets: parseInt(wingoStats[0]?.losing_bets || 0),
            pending_bets: parseInt(wingoStats[0]?.pending_bets || 0),
            net_profit: parseFloat(wingoStats[0]?.total_win_amount || 0) - parseFloat(wingoStats[0]?.total_bet_amount || 0)
        };

        // 5D Statistics
        const fiveDStats = await BetRecord5D.findAll({
            where: dateFilter,
            attributes: [
                [fn('COUNT', col('bet_id')), 'total_bets'],
                [fn('SUM', col('bet_amount')), 'total_bet_amount'],
                [fn('SUM', col('win_amount')), 'total_win_amount'],
                [fn('SUM', literal('CASE WHEN status = "won" THEN 1 ELSE 0 END')), 'winning_bets'],
                [fn('SUM', literal('CASE WHEN status = "lost" THEN 1 ELSE 0 END')), 'losing_bets'],
                [fn('SUM', literal('CASE WHEN status = "pending" THEN 1 ELSE 0 END')), 'pending_bets']
            ],
            raw: true
        });

        gameStats.fiveD = {
            total_bets: parseInt(fiveDStats[0]?.total_bets || 0),
            total_bet_amount: parseFloat(fiveDStats[0]?.total_bet_amount || 0),
            total_win_amount: parseFloat(fiveDStats[0]?.total_win_amount || 0),
            winning_bets: parseInt(fiveDStats[0]?.winning_bets || 0),
            losing_bets: parseInt(fiveDStats[0]?.losing_bets || 0),
            pending_bets: parseInt(fiveDStats[0]?.pending_bets || 0),
            net_profit: parseFloat(fiveDStats[0]?.total_win_amount || 0) - parseFloat(fiveDStats[0]?.total_bet_amount || 0)
        };

        // K3 Statistics
        const k3Stats = await BetRecordK3.findAll({
            where: dateFilter,
            attributes: [
                [fn('COUNT', col('bet_id')), 'total_bets'],
                [fn('SUM', col('bet_amount')), 'total_bet_amount'],
                [fn('SUM', col('win_amount')), 'total_win_amount'],
                [fn('SUM', literal('CASE WHEN status = "won" THEN 1 ELSE 0 END')), 'winning_bets'],
                [fn('SUM', literal('CASE WHEN status = "lost" THEN 1 ELSE 0 END')), 'losing_bets'],
                [fn('SUM', literal('CASE WHEN status = "pending" THEN 1 ELSE 0 END')), 'pending_bets']
            ],
            raw: true
        });

        gameStats.k3 = {
            total_bets: parseInt(k3Stats[0]?.total_bets || 0),
            total_bet_amount: parseFloat(k3Stats[0]?.total_bet_amount || 0),
            total_win_amount: parseFloat(k3Stats[0]?.total_win_amount || 0),
            winning_bets: parseInt(k3Stats[0]?.winning_bets || 0),
            losing_bets: parseInt(k3Stats[0]?.losing_bets || 0),
            pending_bets: parseInt(k3Stats[0]?.pending_bets || 0),
            net_profit: parseFloat(k3Stats[0]?.total_win_amount || 0) - parseFloat(k3Stats[0]?.total_bet_amount || 0)
        };

        // TRX_Wix Statistics
        const trxWixStats = await BetRecordTrxWix.findAll({
            where: dateFilter,
            attributes: [
                [fn('COUNT', col('bet_id')), 'total_bets'],
                [fn('SUM', col('bet_amount')), 'total_bet_amount'],
                [fn('SUM', col('win_amount')), 'total_win_amount'],
                [fn('SUM', literal('CASE WHEN status = "won" THEN 1 ELSE 0 END')), 'winning_bets'],
                [fn('SUM', literal('CASE WHEN status = "lost" THEN 1 ELSE 0 END')), 'losing_bets'],
                [fn('SUM', literal('CASE WHEN status = "pending" THEN 1 ELSE 0 END')), 'pending_bets']
            ],
            raw: true
        });

        gameStats.trxWix = {
            total_bets: parseInt(trxWixStats[0]?.total_bets || 0),
            total_bet_amount: parseFloat(trxWixStats[0]?.total_bet_amount || 0),
            total_win_amount: parseFloat(trxWixStats[0]?.total_win_amount || 0),
            winning_bets: parseInt(trxWixStats[0]?.winning_bets || 0),
            losing_bets: parseInt(trxWixStats[0]?.losing_bets || 0),
            pending_bets: parseInt(trxWixStats[0]?.pending_bets || 0),
            net_profit: parseFloat(trxWixStats[0]?.total_win_amount || 0) - parseFloat(trxWixStats[0]?.total_bet_amount || 0)
        };

        // Calculate overall statistics
        const overallStats = {
            total_bets: gameStats.wingo.total_bets + gameStats.fiveD.total_bets + gameStats.k3.total_bets + gameStats.trxWix.total_bets,
            total_bet_amount: gameStats.wingo.total_bet_amount + gameStats.fiveD.total_bet_amount + gameStats.k3.total_bet_amount + gameStats.trxWix.total_bet_amount,
            total_win_amount: gameStats.wingo.total_win_amount + gameStats.fiveD.total_win_amount + gameStats.k3.total_win_amount + gameStats.trxWix.total_win_amount,
            winning_bets: gameStats.wingo.winning_bets + gameStats.fiveD.winning_bets + gameStats.k3.winning_bets + gameStats.trxWix.winning_bets,
            losing_bets: gameStats.wingo.losing_bets + gameStats.fiveD.losing_bets + gameStats.k3.losing_bets + gameStats.trxWix.losing_bets,
            pending_bets: gameStats.wingo.pending_bets + gameStats.fiveD.pending_bets + gameStats.k3.pending_bets + gameStats.trxWix.pending_bets,
            net_profit: gameStats.wingo.net_profit + gameStats.fiveD.net_profit + gameStats.k3.net_profit + gameStats.trxWix.net_profit
        };

        // Calculate win rate
        const totalCompletedBets = overallStats.winning_bets + overallStats.losing_bets;
        overallStats.win_rate = totalCompletedBets > 0 ? (overallStats.winning_bets / totalCompletedBets * 100).toFixed(2) : 0;

        // Format response
        const response = {
            success: true,
            period: period,
            date_range: {
                start_date: startDate,
                end_date: endDate
            },
            overall_stats: {
                ...overallStats,
                win_rate: parseFloat(overallStats.win_rate)
            },
            game_stats: {
                wingo: {
                    ...gameStats.wingo,
                    win_rate: gameStats.wingo.winning_bets + gameStats.wingo.losing_bets > 0 
                        ? parseFloat(((gameStats.wingo.winning_bets / (gameStats.wingo.winning_bets + gameStats.wingo.losing_bets)) * 100).toFixed(2))
                        : 0
                },
                fiveD: {
                    ...gameStats.fiveD,
                    win_rate: gameStats.fiveD.winning_bets + gameStats.fiveD.losing_bets > 0 
                        ? parseFloat(((gameStats.fiveD.winning_bets / (gameStats.fiveD.winning_bets + gameStats.fiveD.losing_bets)) * 100).toFixed(2))
                        : 0
                },
                k3: {
                    ...gameStats.k3,
                    win_rate: gameStats.k3.winning_bets + gameStats.k3.losing_bets > 0 
                        ? parseFloat(((gameStats.k3.winning_bets / (gameStats.k3.winning_bets + gameStats.k3.losing_bets)) * 100).toFixed(2))
                        : 0
                },
                trxWix: {
                    ...gameStats.trxWix,
                    win_rate: gameStats.trxWix.winning_bets + gameStats.trxWix.losing_bets > 0 
                        ? parseFloat(((gameStats.trxWix.winning_bets / (gameStats.trxWix.winning_bets + gameStats.trxWix.losing_bets)) * 100).toFixed(2))
                        : 0
                }
            }
        };

        console.log(`✅ In-house games stats retrieved successfully for user ${userId}`);
        return response;

    } catch (error) {
        console.error('❌ Error getting in-house games stats:', error);
        return {
            success: false,
            message: 'Error retrieving in-house games statistics: ' + error.message
        };
    }
};

/**
 * Get detailed bet history for a specific game type
 * @param {number} userId - User ID
 * @param {string} gameType - Game type ('wingo', 'fiveD', 'k3', 'trxWix')
 * @param {string} period - Time period
 * @param {Object} options - Pagination options
 * @returns {Object} - Detailed bet history
 */
const getGameBetHistory = async (userId, gameType, period = 'today', options = {}) => {
    try {
        const { page = 1, limit = 20 } = options;
        const offset = (page - 1) * limit;

        // Get initialized models
        const models = await getModels();
        let BetModel;

        switch (gameType) {
            case 'wingo':
                BetModel = models.BetRecordWingo;
                break;
            case 'fiveD':
                BetModel = models.BetRecord5D;
                break;
            case 'k3':
                BetModel = models.BetRecordK3;
                break;
            case 'trxWix':
                BetModel = models.BetRecordTrxWix;
                break;
            default:
                return {
                    success: false,
                    message: 'Invalid game type'
                };
        }

        // Get date range
        const { startDate, endDate } = getDateRange(period);

        // Get bets with pagination
        const bets = await BetModel.findAll({
            where: {
                user_id: userId,
                created_at: {
                    [Op.between]: [startDate, endDate]
                }
            },
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: offset,
            attributes: [
                'bet_id', 'bet_number', 'bet_type', 'bet_amount', 
                'win_amount', 'status', 'odds', 'created_at'
            ]
        });

        // Get total count
        const totalCount = await BetModel.count({
            where: {
                user_id: userId,
                created_at: {
                    [Op.between]: [startDate, endDate]
                }
            }
        });

        return {
            success: true,
            game_type: gameType,
            period: period,
            bets: bets.map(bet => ({
                bet_id: bet.bet_id,
                bet_number: bet.bet_number,
                bet_type: bet.bet_type,
                bet_amount: parseFloat(bet.bet_amount),
                win_amount: parseFloat(bet.win_amount || 0),
                status: bet.status,
                odds: parseFloat(bet.odds),
                created_at: bet.created_at,
                net_profit: parseFloat(bet.win_amount || 0) - parseFloat(bet.bet_amount)
            })),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                total_pages: Math.ceil(totalCount / limit)
            }
        };

    } catch (error) {
        console.error('❌ Error getting game bet history:', error);
        return {
            success: false,
            message: 'Error retrieving bet history: ' + error.message
        };
    }
};

module.exports = {
    getInHouseGamesStats,
    getGameBetHistory,
    getDateRange
}; 
