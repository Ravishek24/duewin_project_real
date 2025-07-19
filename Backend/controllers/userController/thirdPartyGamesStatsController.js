const { getThirdPartyGamesStats, getThirdPartyGameHistory } = require('../../services/thirdPartyGamesStatsService');

/**
 * Get third-party games statistics for the authenticated user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getThirdPartyGamesStatsController = async (req, res) => {
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

        console.log(`📊 [API] Getting third-party games stats for user ${userId}, period: ${period}`);

        const result = await getThirdPartyGamesStats(userId, period);

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(500).json(result);
        }

    } catch (error) {
        console.error('❌ Error in getThirdPartyGamesStatsController:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while retrieving third-party games statistics'
        });
    }
};

/**
 * Get detailed transaction history for a specific third-party game type
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getThirdPartyGameHistoryController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { gameType } = req.params;
        const { period = 'today', page = 1, limit = 20 } = req.query;

        // Validate game type
        const validGameTypes = ['spribe', 'seamless'];
        if (!validGameTypes.includes(gameType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid game type. Valid game types are: spribe, seamless'
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

        // Validate pagination parameters
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        
        if (isNaN(pageNum) || pageNum < 1) {
            return res.status(400).json({
                success: false,
                message: 'Invalid page number. Must be a positive integer'
            });
        }

        if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
            return res.status(400).json({
                success: false,
                message: 'Invalid limit. Must be between 1 and 100'
            });
        }

        console.log(`📊 [API] Getting transaction history for user ${userId}, game: ${gameType}, period: ${period}`);

        const result = await getThirdPartyGameHistory(userId, gameType, period, pageNum, limitNum);

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(500).json(result);
        }

    } catch (error) {
        console.error('❌ Error in getThirdPartyGameHistoryController:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error while retrieving transaction history'
        });
    }
};

module.exports = {
    getThirdPartyGamesStatsController,
    getThirdPartyGameHistoryController
}; 