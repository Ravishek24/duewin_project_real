// services/playwin6Service.js - PlayWin6 Provider Service
const axios = require('axios');
const crypto = require('crypto');
const { Op } = require('sequelize');
const playwin6Config = require('../config/playwin6Config');
const {
  generateAESHash,
  decryptAESHash,
  generatePlayerCredentials,
  generateTimestamp,
  formatAmount,
  parseAmount,
  getUserCurrency,
  validateIPAddress,
  makePlayWin6Request,
  validateGameType,
  validateProvider,
  generateSessionToken,
  validateCallbackData,
  formatGameLaunchUrl,
  formatProviderGameUrl
} = require('../utils/playwin6Utils');

// Import models - these will be loaded after models are initialized
let User, PlayWin6GameSession, PlayWin6Transaction, Transaction, GameHistory;

// Initialize models when service is used
const initializeModels = async () => {
  if (!User) {
    try {
      const { getModels } = require('../models');
      const models = await getModels();
      
      User = models.User;
      PlayWin6GameSession = models.PlayWin6GameSession;
      PlayWin6Transaction = models.PlayWin6Transaction;
      Transaction = models.Transaction;
      GameHistory = models.GameHistory;
      
      if (!User) {
        throw new Error('Required PlayWin6 models not loaded');
      }
      
      console.log('✅ PlayWin6 service models initialized');
    } catch (error) {
      console.error('❌ Error initializing PlayWin6 service models:', error);
      throw error;
    }
  }
};

/**
 * Get provider game list
 * @param {string} provider - Provider name (e.g., 'JiliGaming')
 * @param {number} count - Number of games to return
 * @param {string} type - Game type (e.g., 'Slot Game')
 * @returns {Promise<Object>} - Provider games list
 */
const getProviderGameList = async (provider = 'JiliGaming', count = 12, type = 'Slot Game') => {
  try {
    console.log('🎮 Getting PlayWin6 provider game list:', { provider, count, type });

    // Validate provider
    if (!validateProvider(provider)) {
      throw new Error(`Invalid provider: ${provider}`);
    }

    // Validate game type
    if (!validateGameType(type)) {
      throw new Error(`Invalid game type: ${type}`);
    }

    // Validate count
    if (count < 1 || count > 100) {
      throw new Error('Count must be between 1 and 100');
    }

    const params = {
      provider,
      count: count.toString(),
      type
    };

    const url = formatProviderGameUrl(params);
    
    const response = await makePlayWin6Request(url);
    
    console.log('✅ PlayWin6 provider game list retrieved successfully');
    
    return {
      success: true,
      data: response,
      provider,
      count,
      type
    };
  } catch (error) {
    console.error('❌ Error getting PlayWin6 provider game list:', error);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
};

/**
 * Get all available providers
 * @returns {Promise<Object>} - Available providers
 */
const getProviders = async () => {
  try {
    console.log('🎮 Getting PlayWin6 providers');

    const response = await makePlayWin6Request(playwin6Config.getProviderUrl);
    
    console.log('✅ PlayWin6 providers retrieved successfully');
    
    return {
      success: true,
      data: response,
      providers: playwin6Config.supportedProviders
    };
  } catch (error) {
    console.error('❌ Error getting PlayWin6 providers:', error);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
};

/**
 * Launch a game
 * @param {number} userId - User ID
 * @param {string} gameUid - Game UID/Provider name
 * @param {number} walletAmount - User wallet amount
 * @param {string} token - API token
 * @param {Object} additionalData - Additional data for payload
 * @returns {Promise<Object>} - Game launch result
 */
const launchGame = async (userId, gameUid, walletAmount, token = null, additionalData = {}) => {
  try {
    console.log('🎮 Launching PlayWin6 game:', { userId, gameUid, walletAmount });

    // Initialize models
    await initializeModels();

    // Get user
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate player credentials
    const credentials = generatePlayerCredentials(user);
    
    // Generate timestamp
    const timestamp = generateTimestamp();
    
    // Use provided token or config token
    const apiToken = token || playwin6Config.apiToken;
    if (!apiToken) {
      throw new Error('API token is required');
    }

    // Prepare payload data
    const payloadData = {
      user_id: credentials.username,
      wallet_amount: formatAmount(walletAmount),
      game_uid: gameUid,
      timestamp: timestamp,
      ...additionalData
    };

    // Generate AES encrypted payload
    const payload = generateAESHash(payloadData);

    // Prepare launch parameters
    const launchParams = {
      user_id: credentials.username,
      wallet_amount: formatAmount(walletAmount),
      game_uid: gameUid,
      token: apiToken,
      timestamp: timestamp.toString(),
      payload: payload
    };

    // Format launch URL
    const launchUrl = formatGameLaunchUrl(launchParams);
    
    console.log('🎮 Launch URL generated:', launchUrl);

    // Create game session
    const sessionToken = generateSessionToken();
    const sessionData = {
      userId: userId,
      gameUid: gameUid,
      sessionToken: sessionToken,
      launchUrl: launchUrl,
      walletAmount: walletAmount,
      timestamp: timestamp,
      status: 'launched'
    };

    // Store session in database if model exists
    if (PlayWin6GameSession) {
      await PlayWin6GameSession.create(sessionData);
    }

    console.log('✅ PlayWin6 game launched successfully');
    
    return {
      success: true,
      launchUrl: launchUrl,
      sessionToken: sessionToken,
      userId: userId,
      gameUid: gameUid,
      timestamp: timestamp
    };
  } catch (error) {
    console.error('❌ Error launching PlayWin6 game:', error);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
};

/**
 * Handle callback from PlayWin6
 * @param {Object} callbackData - Callback data
 * @param {string} ipAddress - IP address of the callback
 * @returns {Promise<Object>} - Callback processing result
 */
const handleCallback = async (callbackData, ipAddress) => {
  try {
    console.log('🎮 Processing PlayWin6 callback:', { callbackData, ipAddress });

    // Initialize models
    await initializeModels();

    // Validate IP address
    if (!validateIPAddress(ipAddress)) {
      throw new Error(`Unauthorized IP address: ${ipAddress}`);
    }

    // Validate callback data
    const validation = validateCallbackData(callbackData);
    if (!validation.valid) {
      throw new Error(`Invalid callback data: ${validation.message}`);
    }

    // Extract data from callback
    const {
      user_id,
      wallet_amount,
      game_uid,
      token,
      timestamp,
      payload,
      transaction_id,
      bet_amount,
      win_amount,
      game_result,
      session_id,
      game_id,
      provider,
      action,
      action_id,
      old_balance,
      new_balance,
      platform
    } = callbackData;

    // Decrypt payload if provided
    let decryptedPayload = {};
    if (payload) {
      try {
        decryptedPayload = decryptAESHash(payload);
      } catch (error) {
        console.warn('⚠️ Could not decrypt payload:', error.message);
      }
    }

    // Find user by credentials
    const credentials = generatePlayerCredentials({ user_id: user_id.replace(playwin6Config.playerPrefix, '') });
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { user_id: credentials.userId },
          { username: credentials.username }
        ]
      }
    });

    if (!user) {
      throw new Error(`User not found for user_id: ${user_id}`);
    }

    // Find or create game session
    let gameSession = null;
    if (session_id) {
      gameSession = await PlayWin6GameSession.findOne({
        where: { session_token: session_id }
      });
    }

    // If no session found, create a new one
    if (!gameSession) {
      gameSession = await PlayWin6GameSession.create({
        user_id: user.user_id,
        game_id: game_id || game_uid,
        provider: provider || 'JiliGaming',
        game_type: 'Slot Game', // Default type
        session_token: session_id || generateSessionToken(),
        player_username: user.username,
        currency: getUserCurrency(user),
        language: 'en',
        platform: platform || 'desktop',
        ip_address: ipAddress,
        status: 'active',
        started_at: new Date()
      });
    }

    // Determine transaction type
    let transactionType = 'balance';
    if (bet_amount && parseFloat(bet_amount) > 0) {
      transactionType = 'bet';
    } else if (win_amount && parseFloat(win_amount) > 0) {
      transactionType = 'win';
    }

    // Generate operator transaction ID
    const operatorTxId = `PW6_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Process transaction
    const transactionData = {
      user_id: user.user_id,
      session_id: gameSession.id,
      type: transactionType,
      amount: parseAmount(win_amount || bet_amount || '0'),
      currency: getUserCurrency(user),
      provider: provider || 'JiliGaming',
      game_id: game_id || game_uid,
      game_uid: game_uid,
      provider_tx_id: transaction_id,
      operator_tx_id: operatorTxId,
      action: action || transactionType,
      action_id: action_id,
      old_balance: parseAmount(old_balance || '0'),
      new_balance: parseAmount(new_balance || wallet_amount || '0'),
      wallet_amount: parseAmount(wallet_amount || '0'),
      status: 'completed',
      platform: platform || 'desktop',
      ip_address: ipAddress,
      callback_data: callbackData,
      encrypted_payload: payload,
      timestamp: parseInt(timestamp),
      token: token
    };

    // Store transaction in database
    const transaction = await PlayWin6Transaction.create(transactionData);

    // Update game session if needed
    if (game_result === 'completed' || game_result === 'finished') {
      await gameSession.update({
        status: 'ended',
        ended_at: new Date()
      });
    }

    // Update user wallet if needed (integrate with your wallet service)
    if (parseFloat(win_amount) > 0 || parseFloat(bet_amount) > 0) {
      console.log('💰 Wallet update needed:', { 
        betAmount: bet_amount, 
        winAmount: win_amount, 
        walletAmount: wallet_amount,
        oldBalance: old_balance,
        newBalance: new_balance
      });
      
      // TODO: Integrate with your wallet service here
      // Example:
      // await walletService.updateBalance(user.user_id, parseFloat(new_balance));
    }

    console.log('✅ PlayWin6 callback processed successfully');
    
    return {
      success: true,
      message: 'Callback processed successfully',
      transactionId: transaction_id,
      operatorTxId: operatorTxId,
      userId: user.user_id,
      sessionId: gameSession.id,
      transactionType: transactionType,
      amount: transactionData.amount
    };
  } catch (error) {
    console.error('❌ Error processing PlayWin6 callback:', error);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
};

/**
 * Get user game history
 * @param {number} userId - User ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} - Game history
 */
const getUserGameHistory = async (userId, filters = {}) => {
  try {
    console.log('🎮 Getting PlayWin6 game history for user:', userId);

    // Initialize models
    await initializeModels();

    // Validate user
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Build query
    const whereClause = { userId };
    
    if (filters.gameUid) {
      whereClause.gameUid = filters.gameUid;
    }
    
    if (filters.startDate && filters.endDate) {
      whereClause.timestamp = {
        [Op.between]: [new Date(filters.startDate), new Date(filters.endDate)]
      };
    }

    // Get transactions
    let transactions = [];
    if (PlayWin6Transaction) {
      const limit = Math.min(filters.limit || 50, 100);
      const offset = filters.offset || 0;
      
      transactions = await PlayWin6Transaction.findAll({
        where: whereClause,
        order: [['timestamp', 'DESC']],
        limit,
        offset
      });
    }

    console.log('✅ PlayWin6 game history retrieved successfully');
    
    return {
      success: true,
      data: {
        transactions: transactions,
        total: transactions.length,
        userId: userId
      }
    };
  } catch (error) {
    console.error('❌ Error getting PlayWin6 game history:', error);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
};

/**
 * Get game session by token
 * @param {string} sessionToken - Session token
 * @returns {Promise<Object>} - Game session
 */
const getGameSession = async (sessionToken) => {
  try {
    console.log('🎮 Getting PlayWin6 game session:', sessionToken);

    // Initialize models
    await initializeModels();

    if (!PlayWin6GameSession) {
      throw new Error('PlayWin6GameSession model not available');
    }

    const session = await PlayWin6GameSession.findOne({
      where: { sessionToken }
    });

    if (!session) {
      throw new Error('Game session not found');
    }

    console.log('✅ PlayWin6 game session retrieved successfully');
    
    return {
      success: true,
      data: session
    };
  } catch (error) {
    console.error('❌ Error getting PlayWin6 game session:', error);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
};

/**
 * End game session
 * @param {string} sessionToken - Session token
 * @returns {Promise<Object>} - Session end result
 */
const endGameSession = async (sessionToken) => {
  try {
    console.log('🎮 Ending PlayWin6 game session:', sessionToken);

    // Initialize models
    await initializeModels();

    if (!PlayWin6GameSession) {
      throw new Error('PlayWin6GameSession model not available');
    }

    const session = await PlayWin6GameSession.findOne({
      where: { sessionToken }
    });

    if (!session) {
      throw new Error('Game session not found');
    }

    // Update session status
    await session.update({
      status: 'ended',
      endedAt: new Date()
    });

    console.log('✅ PlayWin6 game session ended successfully');
    
    return {
      success: true,
      message: 'Game session ended successfully'
    };
  } catch (error) {
    console.error('❌ Error ending PlayWin6 game session:', error);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
};

/**
 * Clean up expired sessions
 * @returns {Promise<Object>} - Cleanup result
 */
const cleanupExpiredSessions = async () => {
  try {
    console.log('🎮 Cleaning up expired PlayWin6 sessions');

    // Initialize models
    await initializeModels();

    if (!PlayWin6GameSession) {
      throw new Error('PlayWin6GameSession model not available');
    }

    const expiryTime = new Date(Date.now() - (playwin6Config.sessionExpiry * 1000));
    
    const deletedCount = await PlayWin6GameSession.destroy({
      where: {
        createdAt: {
          [Op.lt]: expiryTime
        },
        status: {
          [Op.ne]: 'ended'
        }
      }
    });

    console.log(`✅ Cleaned up ${deletedCount} expired PlayWin6 sessions`);
    
    return {
      success: true,
      deletedCount: deletedCount
    };
  } catch (error) {
    console.error('❌ Error cleaning up expired PlayWin6 sessions:', error);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
};

/**
 * Health check for PlayWin6 service
 * @returns {Promise<Object>} - Health check result
 */
const healthCheck = async () => {
  try {
    console.log('🎮 Performing PlayWin6 health check');

    // Test provider list API
    const providersResult = await getProviders();
    
    if (!providersResult.success) {
      throw new Error('Provider list API failed');
    }

    // Test game list API
    const gamesResult = await getProviderGameList('JiliGaming', 1, 'Slot Game');
    
    if (!gamesResult.success) {
      throw new Error('Game list API failed');
    }

    console.log('✅ PlayWin6 health check passed');
    
    return {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      config: {
        apiBaseUrl: playwin6Config.apiBaseUrl,
        hasApiToken: !!playwin6Config.apiToken,
        hasAesKey: !!playwin6Config.aesKey,
        hasAesIv: !!playwin6Config.aesIv
      }
    };
  } catch (error) {
    console.error('❌ PlayWin6 health check failed:', error);
    return {
      success: false,
      status: 'unhealthy',
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = {
  getProviderGameList,
  getProviders,
  launchGame,
  handleCallback,
  getUserGameHistory,
  getGameSession,
  endGameSession,
  cleanupExpiredSessions,
  healthCheck
}; 