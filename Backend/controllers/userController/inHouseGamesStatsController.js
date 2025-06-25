const { getInHouseGamesStats, getGameBetHistory } = require('../../services/inHouseGamesStatsService');

/**
 * Get in-house games statistics for the authenticated user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getInHouseGamesStatsController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { period = 'today' } = req.query;

        // Validate period parameter
        const validPeriods = ['today', 'yesterday', 'this_week', 'this_month'];
        if (!validPeriods.includes(period)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid period. Valid periods are: today, yesterday, this_week, this_month'
            });
        }

        console.log(`📊 [API] Getting in-house games stats for user ${userId}, period: ${period}`);

        const result = await getInHouseGamesStats(userId, period);

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(500).json(result);
        }

    } catch (error) {
        console.error('❌ Error in getInHouseGamesStatsController:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while retrieving in-house games statistics'
        });
    }
};

/**
 * Get detailed bet history for a specific game type
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getGameBetHistoryController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { gameType } = req.params;
        const { period = 'today', page = 1, limit = 20 } = req.query;

        // Validate game type
        const validGameTypes = ['wingo', 'fiveD', 'k3', 'trxWix'];
        if (!validGameTypes.includes(gameType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid game type. Valid game types are: wingo, fiveD, k3, trxWix'
            });
        }

        // Validate period parameter
        const validPeriods = ['today', 'yesterday', 'this_week', 'this_month'];
        if (!validPeriods.includes(period)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid period. Valid periods are: today, yesterday, this_week, this_month'
            });
        }

        console.log(`📊 [API] Getting bet history for user ${userId}, game: ${gameType}, period: ${period}`);

        const result = await getGameBetHistory(userId, gameType, period, {
            page: parseInt(page),
            limit: parseInt(limit)
        });

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(500).json(result);
        }

    } catch (error) {
        console.error('❌ Error in getGameBetHistoryController:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while retrieving bet history'
        });
    }
};

module.exports = {
    getInHouseGamesStatsController,
    getGameBetHistoryController
}; 