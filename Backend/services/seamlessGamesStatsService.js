const { Op, fn, col, literal } = require('sequelize');
const moment = require('moment-timezone');
const SeamlessTransaction = require('../models/SeamlessTransaction');

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
 * Get slots games statistics for a user
 * @param {number} userId - User ID
 * @param {string} period - Time period ('today', 'yesterday', 'this_week', 'this_month')
 * @returns {Object} - Statistics data
 */
const getSlotsStats = async (userId, period = 'today') => {
    try {
        console.log(`🎰 Getting slots stats for user ${userId}, period: ${period}`);

        // Get date range
        const { startDate, endDate } = getDateRange(period);

        // Slot game providers
        const slotProviders = ['pf', 'pg', 'bp', 'bs', 'ss', 'ep', 'g24'];

        // Get statistics for slots
        const slotsStats = await SeamlessTransaction.findAll({
            where: {
                user_id: userId,
                provider: { [Op.in]: slotProviders },
                created_at: {
                    [Op.between]: [startDate, endDate]
                }
            },
            attributes: [
                [fn('COUNT', col('id')), 'total_transactions'],
                [fn('SUM', literal('CASE WHEN type = "debit" THEN amount ELSE 0 END')), 'total_bet_amount'],
                [fn('SUM', literal('CASE WHEN type = "credit" THEN amount ELSE 0 END')), 'total_win_amount'],
                [fn('SUM', literal('CASE WHEN type = "debit" THEN 1 ELSE 0 END')), 'total_bets'],
                [fn('SUM', literal('CASE WHEN type = "credit" THEN 1 ELSE 0 END')), 'total_wins'],
                [fn('COUNT', literal('CASE WHEN is_jackpot_win = true THEN 1 END')), 'jackpot_wins'],
                [fn('SUM', literal('CASE WHEN is_jackpot_win = true THEN amount ELSE 0 END')), 'jackpot_amount']
            ],
            raw: true
        });

        const stats = slotsStats[0] || {};
        const totalBetAmount = parseFloat(stats.total_bet_amount || 0);
        const totalWinAmount = parseFloat(stats.total_win_amount || 0);
        const totalBets = parseInt(stats.total_bets || 0);
        const totalWins = parseInt(stats.total_wins || 0);
        const jackpotWins = parseInt(stats.jackpot_wins || 0);
        const jackpotAmount = parseFloat(stats.jackpot_amount || 0);

        // Get provider breakdown
        const providerStats = await SeamlessTransaction.findAll({
            where: {
                user_id: userId,
                provider: { [Op.in]: slotProviders },
                created_at: {
                    [Op.between]: [startDate, endDate]
                }
            },
            attributes: [
                'provider',
                [fn('COUNT', col('id')), 'total_transactions'],
                [fn('SUM', literal('CASE WHEN type = "debit" THEN amount ELSE 0 END')), 'total_bet_amount'],
                [fn('SUM', literal('CASE WHEN type = "credit" THEN amount ELSE 0 END')), 'total_win_amount'],
                [fn('SUM', literal('CASE WHEN type = "debit" THEN 1 ELSE 0 END')), 'total_bets'],
                [fn('SUM', literal('CASE WHEN type = "credit" THEN 1 ELSE 0 END')), 'total_wins']
            ],
            group: ['provider'],
            raw: true
        });

        const providerBreakdown = {};
        providerStats.forEach(stat => {
            const provider = stat.provider;
            const betAmount = parseFloat(stat.total_bet_amount || 0);
            const winAmount = parseFloat(stat.total_win_amount || 0);
            const bets = parseInt(stat.total_bets || 0);
            const wins = parseInt(stat.total_wins || 0);

            providerBreakdown[provider] = {
                total_transactions: parseInt(stat.total_transactions || 0),
                total_bet_amount: betAmount,
                total_win_amount: winAmount,
                total_bets: bets,
                total_wins: wins,
                net_profit: winAmount - betAmount,
                win_rate: bets > 0 ? parseFloat(((wins / bets) * 100).toFixed(2)) : 0
            };
        });

        const response = {
            success: true,
            game_type: 'slots',
            period: period,
            date_range: {
                start_date: startDate,
                end_date: endDate
            },
            overall_stats: {
                total_transactions: parseInt(stats.total_transactions || 0),
                total_bet_amount: totalBetAmount,
                total_win_amount: totalWinAmount,
                total_bets: totalBets,
                total_wins: totalWins,
                net_profit: totalWinAmount - totalBetAmount,
                win_rate: totalBets > 0 ? parseFloat(((totalWins / totalBets) * 100).toFixed(2)) : 0,
                jackpot_wins: jackpotWins,
                jackpot_amount: jackpotAmount
            },
            provider_stats: providerBreakdown
        };

        console.log(`✅ Slots stats retrieved successfully for user ${userId}`);
        return response;

    } catch (error) {
        console.error('❌ Error getting slots stats:', error);
        return {
            success: false,
            message: 'Error retrieving slots statistics: ' + error.message
        };
    }
};

/**
 * Get live casino games statistics for a user
 * @param {number} userId - User ID
 * @param {string} period - Time period ('today', 'yesterday', 'this_week', 'this_month')
 * @returns {Object} - Statistics data
 */
const getLiveCasinoStats = async (userId, period = 'today') => {
    try {
        console.log(`🎲 Getting live casino stats for user ${userId}, period: ${period}`);

        // Get date range
        const { startDate, endDate } = getDateRange(period);

        // Live casino providers
        const liveCasinoProviders = ['BombayLive', 'es', 'ev', 'ag', 'vg', 'ez', 'ol', 'bl'];

        // Get statistics for live casino
        const liveCasinoStats = await SeamlessTransaction.findAll({
            where: {
                user_id: userId,
                provider: { [Op.in]: liveCasinoProviders },
                created_at: {
                    [Op.between]: [startDate, endDate]
                }
            },
            attributes: [
                [fn('COUNT', col('id')), 'total_transactions'],
                [fn('SUM', literal('CASE WHEN type = "debit" THEN amount ELSE 0 END')), 'total_bet_amount'],
                [fn('SUM', literal('CASE WHEN type = "credit" THEN amount ELSE 0 END')), 'total_win_amount'],
                [fn('SUM', literal('CASE WHEN type = "debit" THEN 1 ELSE 0 END')), 'total_bets'],
                [fn('SUM', literal('CASE WHEN type = "credit" THEN 1 ELSE 0 END')), 'total_wins']
            ],
            raw: true
        });

        const stats = liveCasinoStats[0] || {};
        const totalBetAmount = parseFloat(stats.total_bet_amount || 0);
        const totalWinAmount = parseFloat(stats.total_win_amount || 0);
        const totalBets = parseInt(stats.total_bets || 0);
        const totalWins = parseInt(stats.total_wins || 0);

        // Get provider breakdown
        const providerStats = await SeamlessTransaction.findAll({
            where: {
                user_id: userId,
                provider: { [Op.in]: liveCasinoProviders },
                created_at: {
                    [Op.between]: [startDate, endDate]
                }
            },
            attributes: [
                'provider',
                [fn('COUNT', col('id')), 'total_transactions'],
                [fn('SUM', literal('CASE WHEN type = "debit" THEN amount ELSE 0 END')), 'total_bet_amount'],
                [fn('SUM', literal('CASE WHEN type = "credit" THEN amount ELSE 0 END')), 'total_win_amount'],
                [fn('SUM', literal('CASE WHEN type = "debit" THEN 1 ELSE 0 END')), 'total_bets'],
                [fn('SUM', literal('CASE WHEN type = "credit" THEN 1 ELSE 0 END')), 'total_wins']
            ],
            group: ['provider'],
            raw: true
        });

        const providerBreakdown = {};
        providerStats.forEach(stat => {
            const provider = stat.provider;
            const betAmount = parseFloat(stat.total_bet_amount || 0);
            const winAmount = parseFloat(stat.total_win_amount || 0);
            const bets = parseInt(stat.total_bets || 0);
            const wins = parseInt(stat.total_wins || 0);

            providerBreakdown[provider] = {
                total_transactions: parseInt(stat.total_transactions || 0),
                total_bet_amount: betAmount,
                total_win_amount: winAmount,
                total_bets: bets,
                total_wins: wins,
                net_profit: winAmount - betAmount,
                win_rate: bets > 0 ? parseFloat(((wins / bets) * 100).toFixed(2)) : 0
            };
        });

        const response = {
            success: true,
            game_type: 'live_casino',
            period: period,
            date_range: {
                start_date: startDate,
                end_date: endDate
            },
            overall_stats: {
                total_transactions: parseInt(stats.total_transactions || 0),
                total_bet_amount: totalBetAmount,
                total_win_amount: totalWinAmount,
                total_bets: totalBets,
                total_wins: totalWins,
                net_profit: totalWinAmount - totalBetAmount,
                win_rate: totalBets > 0 ? parseFloat(((totalWins / totalBets) * 100).toFixed(2)) : 0
            },
            provider_stats: providerBreakdown
        };

        console.log(`✅ Live casino stats retrieved successfully for user ${userId}`);
        return response;

    } catch (error) {
        console.error('❌ Error getting live casino stats:', error);
        return {
            success: false,
            message: 'Error retrieving live casino statistics: ' + error.message
        };
    }
};

/**
 * Get sports betting statistics for a user
 * @param {number} userId - User ID
 * @param {string} period - Time period ('today', 'yesterday', 'this_week', 'this_month')
 * @returns {Object} - Statistics data
 */
const getSportsBettingStats = async (userId, period = 'today') => {
    try {
        console.log(`⚽ Getting sports betting stats for user ${userId}, period: ${period}`);

        // Get date range
        const { startDate, endDate } = getDateRange(period);

        // Sports betting providers
        const sportsProviders = ['ds', 'dt', 'g24'];

        // Get statistics for sports betting
        const sportsStats = await SeamlessTransaction.findAll({
            where: {
                user_id: userId,
                provider: { [Op.in]: sportsProviders },
                created_at: {
                    [Op.between]: [startDate, endDate]
                }
            },
            attributes: [
                [fn('COUNT', col('id')), 'total_transactions'],
                [fn('SUM', literal('CASE WHEN type = "debit" THEN amount ELSE 0 END')), 'total_bet_amount'],
                [fn('SUM', literal('CASE WHEN type = "credit" THEN amount ELSE 0 END')), 'total_win_amount'],
                [fn('SUM', literal('CASE WHEN type = "debit" THEN 1 ELSE 0 END')), 'total_bets'],
                [fn('SUM', literal('CASE WHEN type = "credit" THEN 1 ELSE 0 END')), 'total_wins']
            ],
            raw: true
        });

        const stats = sportsStats[0] || {};
        const totalBetAmount = parseFloat(stats.total_bet_amount || 0);
        const totalWinAmount = parseFloat(stats.total_win_amount || 0);
        const totalBets = parseInt(stats.total_bets || 0);
        const totalWins = parseInt(stats.total_wins || 0);

        // Get provider breakdown
        const providerStats = await SeamlessTransaction.findAll({
            where: {
                user_id: userId,
                provider: { [Op.in]: sportsProviders },
                created_at: {
                    [Op.between]: [startDate, endDate]
                }
            },
            attributes: [
                'provider',
                [fn('COUNT', col('id')), 'total_transactions'],
                [fn('SUM', literal('CASE WHEN type = "debit" THEN amount ELSE 0 END')), 'total_bet_amount'],
                [fn('SUM', literal('CASE WHEN type = "credit" THEN amount ELSE 0 END')), 'total_win_amount'],
                [fn('SUM', literal('CASE WHEN type = "debit" THEN 1 ELSE 0 END')), 'total_bets'],
                [fn('SUM', literal('CASE WHEN type = "credit" THEN 1 ELSE 0 END')), 'total_wins']
            ],
            group: ['provider'],
            raw: true
        });

        const providerBreakdown = {};
        providerStats.forEach(stat => {
            const provider = stat.provider;
            const betAmount = parseFloat(stat.total_bet_amount || 0);
            const winAmount = parseFloat(stat.total_win_amount || 0);
            const bets = parseInt(stat.total_bets || 0);
            const wins = parseInt(stat.total_wins || 0);

            providerBreakdown[provider] = {
                total_transactions: parseInt(stat.total_transactions || 0),
                total_bet_amount: betAmount,
                total_win_amount: winAmount,
                total_bets: bets,
                total_wins: wins,
                net_profit: winAmount - betAmount,
                win_rate: bets > 0 ? parseFloat(((wins / bets) * 100).toFixed(2)) : 0
            };
        });

        const response = {
            success: true,
            game_type: 'sports_betting',
            period: period,
            date_range: {
                start_date: startDate,
                end_date: endDate
            },
            overall_stats: {
                total_transactions: parseInt(stats.total_transactions || 0),
                total_bet_amount: totalBetAmount,
                total_win_amount: totalWinAmount,
                total_bets: totalBets,
                total_wins: totalWins,
                net_profit: totalWinAmount - totalBetAmount,
                win_rate: totalBets > 0 ? parseFloat(((totalWins / totalBets) * 100).toFixed(2)) : 0
            },
            provider_stats: providerBreakdown
        };

        console.log(`✅ Sports betting stats retrieved successfully for user ${userId}`);
        return response;

    } catch (error) {
        console.error('❌ Error getting sports betting stats:', error);
        return {
            success: false,
            message: 'Error retrieving sports betting statistics: ' + error.message
        };
    }
};

/**
 * Get detailed transaction history for a specific game type
 * @param {number} userId - User ID
 * @param {string} gameType - Game type ('slots', 'live_casino', 'sports_betting')
 * @param {string} period - Time period
 * @param {Object} options - Pagination options
 * @returns {Object} - Detailed transaction history
 */
const getSeamlessGameHistory = async (userId, gameType, period = 'today', options = {}) => {
    try {
        const { page = 1, limit = 20, provider } = options;
        const offset = (page - 1) * limit;

        // Get date range
        const { startDate, endDate } = getDateRange(period);

        // Define providers for each game type
        let providers = [];
        switch (gameType) {
            case 'slots':
                providers = ['pf', 'pg', 'bp', 'bs', 'ss', 'ep', 'g24'];
                break;
            case 'live_casino':
                providers = ['BombayLive', 'es', 'ev', 'ag', 'vg', 'ez', 'ol', 'bl'];
                break;
            case 'sports_betting':
                providers = ['ds', 'dt', 'g24'];
                break;
            default:
                return {
                    success: false,
                    message: 'Invalid game type'
                };
        }

        // Build where clause
        let whereClause = {
            user_id: userId,
            created_at: {
                [Op.between]: [startDate, endDate]
            }
        };

        if (provider) {
            whereClause.provider = provider;
        } else {
            whereClause.provider = { [Op.in]: providers };
        }

        // Get transactions with pagination
        const transactions = await SeamlessTransaction.findAll({
            where: whereClause,
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: offset,
            attributes: [
                'transaction_id', 'provider', 'game_id', 'game_id_hash', 'round_id',
                'type', 'amount', 'wallet_balance_before', 'wallet_balance_after',
                'is_freeround_bet', 'is_freeround_win', 'is_jackpot_win',
                'jackpot_contribution_in_amount', 'status', 'created_at'
            ]
        });

        // Get total count
        const totalCount = await SeamlessTransaction.count({
            where: whereClause
        });

        // Process transactions
        const processedTransactions = transactions.map(transaction => {
            const amount = parseFloat(transaction.amount);
            const isBet = transaction.type === 'debit';
            const isWin = transaction.type === 'credit';
            
            let profitLoss = 0;
            if (isBet) {
                profitLoss = -amount;
            } else if (isWin) {
                profitLoss = amount;
            }

            return {
                order_no: transaction.transaction_id,
                provider: transaction.provider,
                game_id: transaction.game_id,
                game_id_hash: transaction.game_id_hash,
                round_id: transaction.round_id,
                type: transaction.type,
                total_bet: isBet ? amount : 0,
                winnings: isWin ? amount : 0,
                profit_loss: profitLoss,
                profit_loss_formatted: profitLoss >= 0 ? `+${profitLoss.toFixed(2)}` : `${profitLoss.toFixed(2)}`,
                balance_before: parseFloat(transaction.wallet_balance_before || 0),
                balance_after: parseFloat(transaction.wallet_balance_after || 0),
                is_freeround_bet: transaction.is_freeround_bet,
                is_freeround_win: transaction.is_freeround_win,
                is_jackpot_win: transaction.is_jackpot_win,
                jackpot_contribution: parseFloat(transaction.jackpot_contribution_in_amount || 0),
                status: transaction.status,
                created_at: transaction.created_at
            };
        });

        return {
            success: true,
            game_type: gameType,
            period: period,
            transactions: processedTransactions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                total_pages: Math.ceil(totalCount / limit)
            }
        };

    } catch (error) {
        console.error('❌ Error getting seamless game history:', error);
        return {
            success: false,
            message: 'Error retrieving game history: ' + error.message
        };
    }
};

module.exports = {
    getSlotsStats,
    getLiveCasinoStats,
    getSportsBettingStats,
    getSeamlessGameHistory,
    getDateRange
}; 