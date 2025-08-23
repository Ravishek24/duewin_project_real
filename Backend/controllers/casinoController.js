const casinoService = require('../services/casinoService');
const thirdPartyWalletService = require('../services/thirdPartyWalletService');

/**
 * Launch a casino game
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
      
      // Auto-transfer all funds from main wallet to third-party wallet
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

    // Launch game
    const result = await casinoService.getGameUrl(userId, gameUid, {
      currency,
      language,
      platform,
      ipAddress: req.ip || req.connection.remoteAddress
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
    console.error('❌ Casino game launch error:', error);
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
 * Get casino game list
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getGameList = async (req, res) => {
  try {
    console.log('🎮 === GETTING CASINO GAME LIST ===');
    
    // Extract query parameters
    const { category, provider, search } = req.query;
    
    // Call casino service to get game list
    const result = await casinoService.getGameList({
      category,
      provider,
      search
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
    console.error('❌ Error getting game list:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get game list',
      error: error.message
    });
  }
};

/**
 * Get list of all available casino providers
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProviderList = async (req, res) => {
  try {
    console.log('🏢 === GETTING CASINO PROVIDER LIST ===');
    
    // Call casino service to get provider list
    const result = await casinoService.getProviderList();

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

module.exports = {
  launchGame,
  getUserSessions,
  getUserTransactions,
  closeGameSession,
  getGameList,
  getProviderList,
  getUserStats
};
