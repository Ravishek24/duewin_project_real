const {
    getSlotsStats,
    getLiveCasinoStats,
    getSportsBettingStats,
    getSeamlessGameHistory
} = require('../services/seamlessGamesStatsService');

/**
 * Get slots games statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getSlotsStatsController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { period = 'today' } = req.query;

        // Validate period
        const validPeriods = ['today', 'yesterday', 'this_week', 'this_month'];
        if (!validPeriods.includes(period)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid period. Valid periods: today, yesterday, this_week, this_month'
            });
        }

        console.log(`🎰 Getting slots stats for user ${userId}, period: ${period}`);

        const result = await getSlotsStats(userId, period);

        if (!result.success) {
            return res.status(500).json(result);
        }

        res.json(result);

    } catch (error) {
        console.error('❌ Error in getSlotsStatsController:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while retrieving slots statistics'
        });
    }
};

/**
 * Get live casino games statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getLiveCasinoStatsController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { period = 'today' } = req.query;

        // Validate period
        const validPeriods = ['today', 'yesterday', 'this_week', 'this_month'];
        if (!validPeriods.includes(period)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid period. Valid periods: today, yesterday, this_week, this_month'
            });
        }

        console.log(`🎲 Getting live casino stats for user ${userId}, period: ${period}`);

        const result = await getLiveCasinoStats(userId, period);

        if (!result.success) {
            return res.status(500).json(result);
        }

        res.json(result);

    } catch (error) {
        console.error('❌ Error in getLiveCasinoStatsController:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while retrieving live casino statistics'
        });
    }
};

/**
 * Get sports betting statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getSportsBettingStatsController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { period = 'today' } = req.query;

        // Validate period
        const validPeriods = ['today', 'yesterday', 'this_week', 'this_month'];
        if (!validPeriods.includes(period)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid period. Valid periods: today, yesterday, this_week, this_month'
            });
        }

        console.log(`⚽ Getting sports betting stats for user ${userId}, period: ${period}`);

        const result = await getSportsBettingStats(userId, period);

        if (!result.success) {
            return res.status(500).json(result);
        }

        res.json(result);

    } catch (error) {
        console.error('❌ Error in getSportsBettingStatsController:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while retrieving sports betting statistics'
        });
    }
};

/**
 * Get detailed transaction history for a specific game type
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getSeamlessGameHistoryController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { gameType } = req.params;
        const { period = 'today', page = 1, limit = 20, provider } = req.query;

        // Validate game type
        const validGameTypes = ['slots', 'live_casino', 'sports_betting'];
        if (!validGameTypes.includes(gameType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid game type. Valid types: slots, live_casino, sports_betting'
            });
        }

        // Validate period
        const validPeriods = ['today', 'yesterday', 'this_week', 'this_month'];
        if (!validPeriods.includes(period)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid period. Valid periods: today, yesterday, this_week, this_month'
            });
        }

        console.log(`📊 Getting ${gameType} history for user ${userId}, period: ${period}`);

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            provider: provider || null
        };

        const result = await getSeamlessGameHistory(userId, gameType, period, options);

        if (!result.success) {
            return res.status(500).json(result);
        }

        res.json(result);

    } catch (error) {
        console.error('❌ Error in getSeamlessGameHistoryController:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while retrieving game history'
        });
    }
};

/**
 * Get all seamless games statistics (combined)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllSeamlessGamesStatsController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { period = 'today' } = req.query;

        // Validate period
        const validPeriods = ['today', 'yesterday', 'this_week', 'this_month'];
        if (!validPeriods.includes(period)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid period. Valid periods: today, yesterday, this_week, this_month'
            });
        }

        console.log(`📊 Getting all seamless games stats for user ${userId}, period: ${period}`);

        // Get stats for all game types
        const [slotsStats, liveCasinoStats, sportsStats] = await Promise.all([
            getSlotsStats(userId, period),
            getLiveCasinoStats(userId, period),
            getSportsBettingStats(userId, period)
        ]);

        // Calculate combined statistics
        const combinedStats = {
            total_transactions: 0,
            total_bet_amount: 0,
            total_win_amount: 0,
            total_bets: 0,
            total_wins: 0,
            net_profit: 0
        };

        // Aggregate slots stats
        if (slotsStats.success && slotsStats.overall_stats) {
            const stats = slotsStats.overall_stats;
            combinedStats.total_transactions += stats.total_transactions || 0;
            combinedStats.total_bet_amount += stats.total_bet_amount || 0;
            combinedStats.total_win_amount += stats.total_win_amount || 0;
            combinedStats.total_bets += stats.total_bets || 0;
            combinedStats.total_wins += stats.total_wins || 0;
            combinedStats.net_profit += stats.net_profit || 0;
        }

        // Aggregate live casino stats
        if (liveCasinoStats.success && liveCasinoStats.overall_stats) {
            const stats = liveCasinoStats.overall_stats;
            combinedStats.total_transactions += stats.total_transactions || 0;
            combinedStats.total_bet_amount += stats.total_bet_amount || 0;
            combinedStats.total_win_amount += stats.total_win_amount || 0;
            combinedStats.total_bets += stats.total_bets || 0;
            combinedStats.total_wins += stats.total_wins || 0;
            combinedStats.net_profit += stats.net_profit || 0;
        }

        // Aggregate sports stats
        if (sportsStats.success && sportsStats.overall_stats) {
            const stats = sportsStats.overall_stats;
            combinedStats.total_transactions += stats.total_transactions || 0;
            combinedStats.total_bet_amount += stats.total_bet_amount || 0;
            combinedStats.total_win_amount += stats.total_win_amount || 0;
            combinedStats.total_bets += stats.total_bets || 0;
            combinedStats.total_wins += stats.total_wins || 0;
            combinedStats.net_profit += stats.net_profit || 0;
        }

        // Calculate overall win rate
        combinedStats.win_rate = combinedStats.total_bets > 0 
            ? parseFloat(((combinedStats.total_wins / combinedStats.total_bets) * 100).toFixed(2)) 
            : 0;

        const response = {
            success: true,
            period: period,
            combined_stats: combinedStats,
            game_types: {
                slots: slotsStats.success ? slotsStats : { success: false, message: 'Error retrieving slots stats' },
                live_casino: liveCasinoStats.success ? liveCasinoStats : { success: false, message: 'Error retrieving live casino stats' },
                sports_betting: sportsStats.success ? sportsStats : { success: false, message: 'Error retrieving sports betting stats' }
            }
        };

        res.json(response);

    } catch (error) {
        console.error('❌ Error in getAllSeamlessGamesStatsController:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while retrieving all seamless games statistics'
        });
    }
};

module.exports = {
    getSlotsStatsController,
    getLiveCasinoStatsController,
    getSportsBettingStatsController,
    getSeamlessGameHistoryController,
    getAllSeamlessGamesStatsController
}; 