// services/spribeService.js - Updated
import axios from 'axios';
import { spribeConfig } from '../config/spribeConfig.js';
import { 
  generateGameLaunchUrl, 
  generateSecurityHeaders, 
  formatAmount, 
  parseAmount 
} from '../utils/spribeUtils.js';
import User from '../models/User.js';
import { 
  createGameSession, 
  updateGameSession,
  endGameSession,
  processBetTransaction,
  processWinTransaction,
  processRollbackTransaction,
  findTransactionByProviderTxId
} from './gameTransactionService.js';

/**
 * Get game launch URL
 * @param {string} gameId - SPRIBE game ID
 * @param {number} userId - User ID
 * @param {Object} req - Request object with IP address
 * @returns {Object} Response with URL and status
 */
export const getGameLaunchUrl = async (gameId, userId, req) => {
  try {
    // Validate game ID
    if (!spribeConfig.providers[gameId]) {
      return {
        success: false,
        message: 'Invalid game ID'
      };
    }
    
    // Get user information
    const user = await User.findByPk(userId);
    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }
    
    // Generate frontend return URL
    const returnUrl = `${process.env.FRONTEND_URL}/games`;
    const accountHistoryUrl = `${process.env.FRONTEND_URL}/account/history`;
    
    // Generate one-time token
    const token = generateOneTimeToken();
    
    // Create a game session in the database
    await createGameSession(
      userId, 
      gameId, 
      spribeConfig.providers[gameId], 
      token, 
      'INR', // Use user's preferred currency in production
      req.headers['x-forwarded-for'] || req.connection.remoteAddress
    );
    
    // Generate launch URL
    const launchUrl = generateGameLaunchUrl(gameId, user, {
      currency: 'INR', // Use user's preferred currency in production
      token,
      returnUrl,
      accountHistoryUrl,
      ircDuration: 3600, // 1 hour reality check
    });
    
    return {
      success: true,
      url: launchUrl
    };
  } catch (error) {
    console.error('Error generating game launch URL:', error);
    return {
      success: false,
      message: 'Failed to generate game launch URL'
    };
  }
};

/**
 * Handle auth request from SPRIBE
 * @param {Object} authData - Auth request data
 * @returns {Object} Auth response
 */
export const handleAuth = async (authData) => {
  const { user_token, session_token, platform, currency } = authData;
  
  try {
    // Find the game session by launch token
    const sessionResult = await updateGameSession(user_token, session_token, platform);
    
    if (!sessionResult.success) {
      return {
        code: 401,
        message: 'User token is invalid'
      };
    }
    
    // Get user ID from the session
    const userId = sessionResult.session.user_id;
    
    // Get user from database
    const user = await User.findByPk(userId);
    if (!user) {
      return {
        code: 401,
        message: 'User not found'
      };
    }
    
    // Return successful auth response
    return {
      code: 200,
      message: 'Authentication successful',
      data: {
        user_id: user.user_id.toString(),
        username: user.user_name,
        balance: formatAmount(user.wallet_balance, currency),
        currency: currency
      }
    };
  } catch (error) {
    console.error('Error handling auth request:', error);
    return {
      code: 500,
      message: 'Internal server error'
    };
  }
};

/**
 * Handle player info request from SPRIBE
 * @param {Object} infoData - Info request data
 * @returns {Object} Player info response
 */
export const handlePlayerInfo = async (infoData) => {
  const { user_id, session_token, currency } = infoData;
  
  try {
    // Get user from database
    const user = await User.findByPk(user_id);
    if (!user) {
      return {
        code: 401,
        message: 'User not found'
      };
    }
    
    // Return player info
    return {
      code: 200,
      message: 'Player info retrieved successfully',
      data: {
        user_id: user.user_id.toString(),
        username: user.user_name,
        balance: formatAmount(user.wallet_balance, currency),
        currency: currency
      }
    };
  } catch (error) {
    console.error('Error handling player info request:', error);
    return {
      code: 500,
      message: 'Internal server error'
    };
  }
};

/**
 * Handle withdraw request from SPRIBE (betting)
 * @param {Object} withdrawData - Withdraw request data
 * @returns {Object} Withdraw response
 */
export const handleWithdraw = async (withdrawData) => {
  const {
    user_id,
    currency,
    amount,
    provider,
    provider_tx_id,
    game,
    action,
    action_id,
    session_token,
    platform
  } = withdrawData;
  
  try {
    // Check for duplicate transaction
    const existingTx = await findTransactionByProviderTxId(provider_tx_id);
    
    if (existingTx.success) {
      // Return the duplicate transaction details
      return {
        code: 409,
        message: 'Duplicate transaction',
        data: {
          user_id: existingTx.transaction.user_id.toString(),
          operator_tx_id: existingTx.transaction.operator_tx_id,
          provider: existingTx.transaction.provider,
          provider_tx_id: existingTx.transaction.provider_tx_id,
          old_balance: formatAmount(existingTx.transaction.old_balance, currency),
          new_balance: formatAmount(existingTx.transaction.new_balance, currency),
          currency: currency
        }
      };
    }
    
    // Parse amount from SPRIBE format
    const parsedAmount = parseAmount(amount, currency);
    
    // Process the bet transaction
    const result = await processBetTransaction({
      user_id,
      provider,
      game_id: game,
      provider_tx_id,
      amount: parsedAmount,
      currency,
      action_id,
      platform,
      ip_address: null // We don't get this from SPRIBE
    });
    
    if (!result.success) {
      // Handle insufficient funds case
      if (result.code === 402) {
        return {
          code: 402,
          message: 'Insufficient funds'
        };
      }
      
      // Generic error
      return {
        code: 500,
        message: result.message || 'Transaction processing failed'
      };
    }
    
    // Return successful withdraw response
    return {
      code: 200,
      message: 'Withdrawal successful',
      data: {
        user_id: user_id.toString(),
        operator_tx_id: result.operator_tx_id,
        provider: provider,
        provider_tx_id: provider_tx_id,
        old_balance: formatAmount(result.oldBalance, currency),
        new_balance: formatAmount(result.newBalance, currency),
        currency: currency
      }
    };
  } catch (error) {
    console.error('Error handling withdraw request:', error);
    
    return {
      code: 500,
      message: 'Internal server error'
    };
  }
};

/**
 * Handle deposit request from SPRIBE (winning)
 * @param {Object} depositData - Deposit request data
 * @returns {Object} Deposit response
 */
export const handleDeposit = async (depositData) => {
  const {
    user_id,
    currency,
    amount,
    provider,
    provider_tx_id,
    game,
    action,
    action_id,
    session_token,
    platform,
    withdraw_provider_tx_id
  } = depositData;
  
  try {
    // Check for duplicate transaction
    const existingTx = await findTransactionByProviderTxId(provider_tx_id);
    
    if (existingTx.success) {
      // Return the duplicate transaction details
      return {
        code: 409,
        message: 'Duplicate transaction',
        data: {
          user_id: existingTx.transaction.user_id.toString(),
          operator_tx_id: existingTx.transaction.operator_tx_id,
          provider: existingTx.transaction.provider,
          provider_tx_id: existingTx.transaction.provider_tx_id,
          old_balance: formatAmount(existingTx.transaction.old_balance, currency),
          new_balance: formatAmount(existingTx.transaction.new_balance, currency),
          currency: currency
        }
      };
    }
    
    // Parse amount from SPRIBE format
    const parsedAmount = parseAmount(amount, currency);
    
    // Process the win transaction
    const result = await processWinTransaction({
      user_id,
      provider,
      game_id: game,
      provider_tx_id,
      amount: parsedAmount,
      currency,
      action_id,
      platform,
      ip_address: null,
      withdraw_provider_tx_id
    });
    
    if (!result.success) {
      return {
        code: 500,
        message: result.message || 'Transaction processing failed'
      };
    }
    
    // Return successful deposit response
    return {
      code: 200,
      message: 'Deposit successful',
      data: {
        user_id: user_id.toString(),
        operator_tx_id: result.operator_tx_id,
        provider: provider,
        provider_tx_id: provider_tx_id,
        old_balance: formatAmount(result.oldBalance, currency),
        new_balance: formatAmount(result.newBalance, currency),
        currency: currency
      }
    };
  } catch (error) {
    console.error('Error handling deposit request:', error);
    
    return {
      code: 500,
      message: 'Internal server error'
    };
  }
};

/**
 * Handle rollback request from SPRIBE
 * @param {Object} rollbackData - Rollback request data
 * @returns {Object} Rollback response
 */
export const handleRollback = async (rollbackData) => {
  const {
    user_id,
    amount,
    provider,
    rollback_provider_tx_id,
    provider_tx_id,
    game,
    session_token,
    action,
    action_id
  } = rollbackData;
  
  try {
    // Check for duplicate transaction
    const existingTx = await findTransactionByProviderTxId(provider_tx_id);
    
    if (existingTx.success) {
      // Return the duplicate transaction details
      return {
        code: 409,
        message: 'Duplicate transaction',
        data: {
          user_id: existingTx.transaction.user_id.toString(),
          currency: existingTx.transaction.currency,
          operator_tx_id: existingTx.transaction.operator_tx_id,
          provider: existingTx.transaction.provider,
          provider_tx_id: existingTx.transaction.provider_tx_id,
          old_balance: formatAmount(existingTx.transaction.old_balance, existingTx.transaction.currency),
          new_balance: formatAmount(existingTx.transaction.new_balance, existingTx.transaction.currency)
        }
      };
    }
    
    // Get currency from transaction or user 
    // (In production, always fetch from the original transaction)
    const currency = 'INR';
    
    // Parse amount from SPRIBE format
    const parsedAmount = parseAmount(amount, currency);
    
    // Process the rollback transaction
    const result = await processRollbackTransaction({
      user_id,
      provider,
      game_id: game,
      provider_tx_id,
      rollback_provider_tx_id,
      amount: parsedAmount,
      currency,
      action_id,
      platform: null, // Might not be available in rollback
      ip_address: null
    });
    
    if (!result.success) {
      // Handle transaction not found
      if (result.code === 408) {
        return {
          code: 408,
          message: 'Transaction does not found'
        };
      }
      
      // Generic error
      return {
        code: 500,
        message: result.message || 'Rollback processing failed'
      };
    }
    
    // Return successful rollback response
    return {
      code: 200,
      message: 'Rollback successful',
      data: {
        user_id: user_id.toString(),
        currency: currency,
        operator_tx_id: result.operator_tx_id,
        provider: provider,
        provider_tx_id: provider_tx_id,
        old_balance: formatAmount(result.oldBalance, currency),
        new_balance: formatAmount(result.newBalance, currency)
      }
    };
  } catch (error) {
    console.error('Error handling rollback request:', error);
    
    return {
      code: 500,
      message: 'Internal server error'
    };
  }
};

/**
 * List available games
 * @returns {Array} List of available games
 */
export const listGames = async () => {
  try {
    // Convert the spribeConfig.providers object to an array of game objects
    const games = Object.entries(spribeConfig.providers).map(([id, provider]) => ({
      id,
      provider,
      name: id
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' '),
      type: provider.split('_')[1] || 'game',
      thumbnailUrl: `/assets/game-thumbnails/${id}.jpg`, // This would be the path to game thumbnails
      description: `Play ${id
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')} from SPRIBE`,
      isActive: true,
      category: provider.split('_')[1] || 'other'
    }));
    
    return {
      success: true,
      games
    };
  } catch (error) {
    console.error('Error listing games:', error);
    return {
      success: false,
      message: 'Failed to list games'
    };
  }
};

// Helper to generate one-time token
const generateOneTimeToken = () => {
  return require('crypto').randomBytes(32).toString('hex');
};

export default {
  getGameLaunchUrl,
  handleAuth,
  handlePlayerInfo,
  handleWithdraw,
  handleDeposit,
  handleRollback,
  listGames
};