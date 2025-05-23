// controllers/gameController.js
const { 
  getGameList,
  placeCrashBet,
  placeDiceBet,
  getGameHistory,
  getGameStats 
} = require('../services/gameServices');
const seamlessWalletService = require('../services/seamlessWalletService');
const { endGameSession } = require('../services/gameTransactionService');
const thirdPartyWalletService = require('../services/thirdPartyWalletService');
const User = require('../models/User');

const fetchGameList = async (req, res) => {
  try {
    const { currency } = req.query; // Get currency from query parameters
    const games = await getGameList(currency);
    res.status(200).json(games);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch game list' });
  }
};

/**
 * Handle callback when user exits a game to transfer funds from third-party wallet back to main wallet
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const handleGameExit = async (req, res) => {
  try {
    const { userId, sessionToken, provider } = req.body;
    
    if (!userId || !sessionToken) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }
    
    let result;
    
    // Handle based on provider
    if (provider === 'seamless') {
      // Close seamless game session
      result = await seamlessWalletService.closeGameSession(sessionToken);
    } else if (provider === 'spribe') {
      // Close spribe game session
      result = await endGameSession(sessionToken);
      
      // Transfer funds back to main wallet
      if (result.success) {
        const transferResult = await thirdPartyWalletService.transferToMainWallet(userId);
        
        if (!transferResult.success) {
          return res.status(500).json({
            success: false,
            message: `Game session closed but failed to transfer balance: ${transferResult.message}`
          });
        }
      }
    } else {
      // Generic handling for other providers
      // Just transfer funds back to main wallet without specific session handling
      result = await thirdPartyWalletService.transferToMainWallet(userId);
    }
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Game session closed and funds transferred successfully'
    });
  } catch (error) {
    console.error('Error handling game exit:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to handle game exit'
    });
  }
};

/**
 * Check if user has enough balance to play games
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const checkGameBalance = async (req, res) => {
  try {
    const userId = req.user.user_id; // Assuming authentication middleware sets req.user
    
    // First check third-party wallet balance
    const thirdPartyWalletResult = await thirdPartyWalletService.getBalance(userId);
    
    // If third-party wallet has balance, user can play
    if (thirdPartyWalletResult.success && thirdPartyWalletResult.balance > 0) {
      return res.status(200).json({
        hasBalance: true,
        walletType: 'third-party',
        balance: thirdPartyWalletResult.balance,
        currency: thirdPartyWalletResult.currency
      });
    }
    
    // If no third-party balance, check main wallet
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    const mainWalletBalance = parseFloat(user.wallet_balance);
    
    return res.status(200).json({
      hasBalance: mainWalletBalance > 0,
      walletType: 'main',
      balance: mainWalletBalance,
      currency: 'INR' // Use user's preferred currency in production
    });
  } catch (error) {
    console.error('Error checking game balance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check game balance'
    });
  }
};

/**
 * Transfer funds from third-party wallet to main wallet for withdrawal
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const transferForWithdrawal = async (req, res) => {
  try {
    const userId = req.user.user_id; // Assuming authentication middleware sets req.user
    
    // Check if there are funds in the third-party wallet
    const walletResult = await thirdPartyWalletService.getBalance(userId);
    
    if (!walletResult.success) {
      return res.status(404).json({
        success: false,
        message: 'Third-party wallet not found'
      });
    }
    
    // If no balance to transfer, return early
    if (walletResult.balance <= 0) {
      return res.status(400).json({
        success: false,
        message: 'No funds available in third-party wallet for transfer'
      });
    }
    
    // Transfer funds to main wallet
    const transferResult = await thirdPartyWalletService.transferToMainWallet(userId);
    
    if (!transferResult.success) {
      return res.status(500).json({
        success: false,
        message: transferResult.message || 'Failed to transfer funds'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Funds transferred to main wallet for withdrawal',
      amountTransferred: transferResult.thirdPartyWalletBalanceBefore,
      mainWalletBalance: transferResult.mainWalletBalanceAfter
    });
  } catch (error) {
    console.error('Error transferring funds for withdrawal:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to transfer funds for withdrawal'
    });
  }
};

/**
 * Place a bet in a game
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const placeBetController = async (req, res) => {
  try {
    const { gameType, amount, betType, target } = req.body;
    const userId = req.user.user_id;

    // Validate input
    if (!gameType || !amount || !betType) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters'
      });
    }

    // Place bet based on game type
    let result;
    if (gameType === 'crash') {
      result = await placeCrashBet(userId, amount, betType, target);
    } else if (gameType === 'dice') {
      result = await placeDiceBet(userId, amount, betType, target);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid game type'
      });
    }

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error placing bet:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to place bet'
    });
  }
};

/**
 * Get game history for a user
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getGameHistoryController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { gameType, page = 1, limit = 10 } = req.query;

    const result = await getGameHistory(userId, gameType, page, limit);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting game history:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get game history'
    });
  }
};

/**
 * Get game statistics for a user
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getGameStatsController = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { gameType, period } = req.query;

    const result = await getGameStats(userId, gameType, period);

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting game stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get game stats'
    });
  }
};

module.exports = {
  fetchGameList,
  handleGameExit,
  checkGameBalance,
  transferForWithdrawal,
  placeBetController,
  getGameHistoryController,
  getGameStatsController
};

