// controllers/adminController/gameTransactionStatsController.js
const {
  getSpribeTransactionStats,
  getSeamlessTransactionStats
} = require('../../services/paymentService');

/**
 * Get Spribe transaction statistics by provider
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getSpribeTransactionStatsController = async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    
    // Validate period parameter
    if (!['today', 'week', 'month'].includes(period)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid period. Must be "today", "week", or "month"'
      });
    }
    
    const result = await getSpribeTransactionStats(period);
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error fetching Spribe transaction stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching Spribe transaction statistics'
    });
  }
};

/**
 * Get Seamless transaction statistics by provider
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getSeamlessTransactionStatsController = async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    
    // Validate period parameter
    if (!['today', 'week', 'month'].includes(period)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid period. Must be "today", "week", or "month"'
      });
    }
    
    const result = await getSeamlessTransactionStats(period);
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error fetching Seamless transaction stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching Seamless transaction statistics'
    });
  }
};

/**
 * Get combined transaction statistics for both Spribe and Seamless
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getCombinedTransactionStatsController = async (req, res) => {
  try {
    const { period = 'today' } = req.query;
    
    // Validate period parameter
    if (!['today', 'week', 'month'].includes(period)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid period. Must be "today", "week", or "month"'
      });
    }
    
    // Get both Spribe and Seamless stats
    const [spribeResult, seamlessResult] = await Promise.all([
      getSpribeTransactionStats(period),
      getSeamlessTransactionStats(period)
    ]);
    
    if (!spribeResult.success || !seamlessResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Error fetching transaction statistics',
        spribe_error: spribeResult.message,
        seamless_error: seamlessResult.message
      });
    }
    
    // Combine the results
    const combinedResult = {
      success: true,
      period,
      start_date: spribeResult.start_date,
      end_date: spribeResult.end_date,
      spribe: {
        providers: spribeResult.providers,
        totals: spribeResult.totals
      },
      seamless: {
        providers: seamlessResult.providers,
        totals: seamlessResult.totals
      },
      combined_totals: {
        total_bet_amount: spribeResult.totals.total_bet_amount + seamlessResult.totals.total_bet_amount,
        total_bet_count: spribeResult.totals.total_bet_count + seamlessResult.totals.total_bet_count,
        total_win_amount: spribeResult.totals.total_win_amount + seamlessResult.totals.total_win_amount,
        total_win_count: spribeResult.totals.total_win_count + seamlessResult.totals.total_win_count,
        net_profit: spribeResult.totals.net_profit + seamlessResult.totals.net_profit
      }
    };
    
    return res.status(200).json(combinedResult);
  } catch (error) {
    console.error('Error fetching combined transaction stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching combined transaction statistics'
    });
  }
};

module.exports = {
  getSpribeTransactionStatsController,
  getSeamlessTransactionStatsController,
  getCombinedTransactionStatsController
}; 