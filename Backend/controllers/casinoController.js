const casinoService = require('../services/casinoService');
const thirdPartyWalletService = require('../services/thirdPartyWalletService');

/**
 * Launch a casino game - PRODUCTION READY
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const launchGame = async (req, res) => {
  try {
    const { gameUid } = req.params;
    const { currency, language, platform } = req.query;
    const userId = req.user.user_id;
    
    console.log('🎮 === CASINO GAME LAUNCH REQUEST ===');
    console.log('🎮 User ID:', userId);
    console.log('🎮 Game UID:', gameUid);
    console.log('🎮 Options:', { currency, language, platform });

    if (!gameUid) {
      return res.status(400).json({
        success: false,
        message: 'Game UID is required'
      });
    }

    // Check if user has balance in third-party wallet
    let balanceResult = await thirdPartyWalletService.getBalance(userId);
    
    // If no balance in third-party wallet, auto-transfer from main wallet
    if (!balanceResult.success || balanceResult.balance <= 0) {
      console.log('💰 === AUTO-TRANSFER FROM MAIN WALLET ===');
      console.log('💰 User ID:', userId);
      console.log('💰 Main wallet balance:', req.user.wallet_balance);
      
      // Get main wallet balance
      const mainWalletBalance = parseFloat(req.user.wallet_balance || 0);
      
      if (mainWalletBalance <= 0) {
        return res.status(400).json({
          success: false,
          message: 'No balance available in main wallet',
          mainWalletBalance: 0
        });
      }
      
      // Auto-transfer funds from main wallet to third-party wallet
      console.log('🔄 Transferring ₹' + mainWalletBalance + ' to third-party wallet...');
      
      const transferResult = await thirdPartyWalletService.transferFromMainWallet(
        userId, 
        mainWalletBalance
      );
      
      if (!transferResult.success) {
        console.error('❌ Auto-transfer failed:', transferResult.message);
        return res.status(400).json({
          success: false,
          message: 'Failed to transfer funds to third-party wallet',
          error: transferResult.message,
          mainWalletBalance: mainWalletBalance
        });
      }
      
      console.log('✅ Auto-transfer successful:', transferResult.message);
      console.log('💰 New third-party wallet balance:', transferResult.balance);
      
      // Update balance result after transfer
      balanceResult = {
        success: true,
        balance: transferResult.balance
      };
    }

    // Launch game using confirmed working service method
    const result = await casinoService.getGameUrl(userId, gameUid, {
      currency,
      language,
      platform: platform ? parseInt(platform) : undefined, // Convert to integer if provided
      ipAddress: req.ip || req.connection.remoteAddress
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error_code: result.error_code,
        suggestion: result.suggestion,
        error: result.error
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Game launched successfully',
      data: {
        gameUrl: result.gameUrl,
        sessionId: result.sessionId,
        memberAccount: result.memberAccount,
        balance: result.balance,
        currency: result.currency
      }
    });

  } catch (error) {
    console.error('❌ Casino game launch controller error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to launch game',
      error: error.message
    });
  }
};

/**
 * Get user's casino game sessions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserSessions = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { status, limit = 10, offset = 0 } = req.query;

    console.log('📋 === GETTING USER CASINO SESSIONS ===');
    console.log('📋 User ID:', userId);

    const CasinoGameSession = require('../models/CasinoGameSession');
    
    const whereClause = { user_id: userId };
    if (status) {
      whereClause.is_active = status === 'active';
    }

    const sessions = await CasinoGameSession.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const totalCount = await CasinoGameSession.count({ where: whereClause });

    return res.status(200).json({
      success: true,
      data: {
        sessions,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: offset + sessions.length < totalCount
        }
      }
    });

  } catch (error) {
    console.error('❌ Error getting user sessions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user sessions',
      error: error.message
    });
  }
};

/**
 * Get user's casino transaction history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserTransactions = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { type, limit = 20, offset = 0, fromDate, toDate } = req.query;

    console.log('📊 === GETTING USER CASINO TRANSACTIONS ===');
    console.log('📊 User ID:', userId);

    const CasinoTransaction = require('../models/CasinoTransaction');
    
    const whereClause = { user_id: userId };
    if (type) {
      whereClause.transaction_type = type;
    }

    if (fromDate || toDate) {
      whereClause.created_at = {};
      if (fromDate) whereClause.created_at.$gte = new Date(fromDate);
      if (toDate) whereClause.created_at.$lte = new Date(toDate);
    }

    const transactions = await CasinoTransaction.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const totalCount = await CasinoTransaction.count({ where: whereClause });

    return res.status(200).json({
      success: true,
      data: {
        transactions,
        pagination: {
          total: totalCount,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: offset + transactions.length < totalCount
        }
      }
    });

  } catch (error) {
    console.error('❌ Error getting user transactions:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user transactions',
      error: error.message
    });
  }
};

/**
 * Close a casino game session
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const closeGameSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.user_id;

    console.log('🔒 === CLOSING CASINO GAME SESSION ===');
    console.log('🔒 Session ID:', sessionId);
    console.log('🔒 User ID:', userId);

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    // Verify session belongs to user
    const CasinoGameSession = require('../models/CasinoGameSession');
    const session = await CasinoGameSession.findOne({
      where: { session_id: sessionId, user_id: userId }
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found or access denied'
      });
    }

    // Close session
    const result = await casinoService.closeGameSession(sessionId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Game session closed successfully'
    });

  } catch (error) {
    console.error('❌ Error closing game session:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to close game session',
      error: error.message
    });
  }
};

/**
 * Get casino game list - RAW RESPONSE FROM PROVIDER
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getGameList = async (req, res) => {
  try {
    console.log('🎮 === GETTING RAW CASINO GAME LIST ===');
    
    // Call casino service to get RAW game list from provider
    const result = await casinoService.getGameList();

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error_code: result.error_code,
        error: result.error,
        error_details: result.error_details
      });
    }

    // Return completely raw response from casino provider
    return res.status(200).json({
      success: true,
      data: result.data,
      raw_response: result.raw_response,
      source: result.source,
      message: 'Raw game list from casino provider - no modifications applied'
    });

  } catch (error) {
    console.error('❌ Error getting game list:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get game list',
      error: error.message
    });
  }
};

/**
 * Get list of all available casino providers - RAW RESPONSE
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProviderList = async (req, res) => {
  try {
    console.log('🏢 === GETTING RAW CASINO PROVIDER LIST ===');
    
    // Call casino service to get RAW provider list from provider
    const result = await casinoService.getProviderList();

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error_code: result.error_code,
        error: result.error,
        error_details: result.error_details
      });
    }

    // Return completely raw response from casino provider
    return res.status(200).json({
      success: true,
      data: result.data,
      raw_response: result.raw_response,
      source: result.source,
      message: 'Raw provider list from casino provider - no modifications applied'
    });

  } catch (error) {
    console.error('❌ Error getting provider list:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get provider list',
      error: error.message
    });
  }
};

/**
 * Get casino statistics for user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getUserStats = async (req, res) => {
  try {
    const userId = req.user.user_id;

    console.log('📈 === GETTING USER CASINO STATS ===');
    console.log('📈 User ID:', userId);

    const CasinoTransaction = require('../models/CasinoTransaction');
    const CasinoGameSession = require('../models/CasinoGameSession');

    // Get transaction statistics
    const betTransactions = await CasinoTransaction.findAll({
      where: { user_id: userId, transaction_type: 'bet', status: 'completed' }
    });

    const winTransactions = await CasinoTransaction.findAll({
      where: { user_id: userId, transaction_type: 'win', status: 'completed' }
    });

    // Calculate totals
    const totalBets = betTransactions.reduce((sum, tx) => sum + parseFloat(tx.bet_amount || 0), 0);
    const totalWins = winTransactions.reduce((sum, tx) => sum + parseFloat(tx.win_amount || 0), 0);
    const netProfit = totalWins - totalBets;

    // Get session statistics
    const totalSessions = await CasinoGameSession.count({ where: { user_id: userId } });
    const activeSessions = await CasinoGameSession.count({ where: { user_id: userId, is_active: true } });

    // Get recent activity
    const recentTransactions = await CasinoTransaction.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit: 5
    });

    return res.status(200).json({
      success: true,
      data: {
        statistics: {
          totalBets: parseFloat(totalBets.toFixed(2)),
          totalWins: parseFloat(totalWins.toFixed(2)),
          netProfit: parseFloat(netProfit.toFixed(2)),
          totalSessions,
          activeSessions
        },
        recentActivity: recentTransactions
      }
    });

  } catch (error) {
    console.error('❌ Error getting user stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user statistics',
      error: error.message
    });
  }
};

/**
 * Get transaction history from casino provider
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { fromDate, toDate, pageNo = 1, pageSize = 30 } = req.query;

    console.log('📊 === GETTING CASINO TRANSACTION HISTORY FROM PROVIDER ===');
    console.log('📊 User ID:', userId);
    console.log('📊 Filters:', { fromDate, toDate, pageNo, pageSize });

    // Only admin users can access this endpoint (if you want to restrict it)
    // Uncomment the following lines if you want admin-only access:
    // if (!req.user.is_admin) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Admin access required'
    //   });
    // }

    const result = await casinoService.getTransactionHistory({
      fromDate,
      toDate,
      pageNo: parseInt(pageNo),
      pageSize: parseInt(pageSize)
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message,
        error: result.error
      });
    }

    return res.status(200).json({
      success: true,
      data: result.data
    });

  } catch (error) {
    console.error('❌ Error getting transaction history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get transaction history',
      error: error.message
    });
  }
};

/**
 * Process casino callback - CONFIRMED WORKING
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const processCallback = async (req, res) => {
  try {
    console.log('📞 === CASINO CALLBACK RECEIVED ===');
    console.log('📞 Headers:', req.headers);
    console.log('📞 Body:', req.body);

    // Process the callback using confirmed working service method
    const result = await casinoService.processCallback(req.body);

    console.log('📞 === CASINO CALLBACK RESPONSE ===');
    console.log('📞 Response:', result);

    // Return the encrypted response
    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ Casino callback processing error:', error);
    
    // Return error response
    return res.status(500).json({
      code: 1,
      msg: 'Internal server error',
      payload: ''
    });
  }
};

/**
 * Health check endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const healthCheck = (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Casino API is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    encryption_method: 'UTF-8 String Key AES-256-ECB',
    features: [
      'Game Launch',
      'Session Management', 
      'Transaction Processing',
      'Callback Processing',
      'Raw Game List',
      'Raw Provider List',
      'User Statistics',
      'Auto Wallet Transfer'
    ]
  });
};

module.exports = {
  launchGame,
  getUserSessions,
  getUserTransactions,
  closeGameSession,
  getGameList,
  getProviderList,
  getUserStats,
  getTransactionHistory,
  processCallback,
  healthCheck
};