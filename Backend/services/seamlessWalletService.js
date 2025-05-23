// services/seamlessWalletService.js
const axios = require('axios');
const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const seamlessConfig = require('../config/seamlessConfig');
const User = require('../models/User');
const SeamlessTransaction = require('../models/SeamlessTransaction');
const SeamlessGameSession = require('../models/SeamlessGameSession');
const thirdPartyWalletService = require('./thirdPartyWalletService');

/**
 * Get list of available games from provider
 * @param {string} currency - Currency code (default: EUR)
 * @param {Object} filters - Optional filters for games
 * @param {string} filters.category - Category to filter by (e.g. 'video-slots', 'livecasino', etc.)
 * @param {string} filters.provider - Provider to filter by (e.g. 'ha' for Habanero)
 * @param {boolean} filters.mobile - Filter for mobile games only
 * @param {boolean} filters.jackpot - Filter for jackpot games only
 * @param {boolean} filters.freerounds - Filter for games supporting free rounds
 * @returns {Promise<Object>} List of games
 */
const getGameList = async (currency = seamlessConfig.default_currency, filters = {}) => {
  try {
    const requestData = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'getGameList',
      show_systems: 0,
      show_additional: true, // Important to get all filtering data
      currency: currency
    };

    const response = await axios.post(
      seamlessConfig.api_url.production,
      requestData
    );

    if (response.data.error !== 0) {
      throw new Error(`Error getting game list: ${response.data.message || 'Unknown error'}`);
    }

    // Apply filters if provided
    let filteredGames = response.data.response;
    
    if (filters) {
      // Filter by category (e.g. 'video-slots', 'livecasino', etc.)
      if (filters.category) {
        filteredGames = filteredGames.filter(game => 
          game.type === filters.category || game.category === filters.category
        );
      }
      
      // Filter by provider/system (e.g. 'ha' for Habanero)
      if (filters.provider) {
        filteredGames = filteredGames.filter(game => 
          game.system === filters.provider || 
          game.subcategory?.toLowerCase() === filters.provider.toLowerCase()
        );
      }
      
      // Filter for mobile games
      if (filters.mobile === true) {
        filteredGames = filteredGames.filter(game => game.mobile === true);
      }
      
      // Filter for jackpot games
      if (filters.jackpot === true) {
        filteredGames = filteredGames.filter(game => game.has_jackpot === true);
      }
      
      // Filter for games supporting free rounds
      if (filters.freerounds === true) {
        filteredGames = filteredGames.filter(game => game.freerounds_supported === true);
      }
    }

    return {
      success: true,
      games: filteredGames,
      totalCount: response.data.response.length,
      filteredCount: filteredGames.length
    };
  } catch (error) {
    console.error('Error in getGameList:', error);
    return {
      success: false,
      message: error.message || 'Failed to get game list'
    };
  }
};

/**
 * Check if player exists at provider
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Player info or false
 */
const playerExists = async (userId) => {
  try {
    // Get user
    const user = await User.findByPk(userId);
    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    const requestData = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'playerExists',
      user_username: `player${user.user_id}`, // Use a consistent format for usernames
      currency: seamlessConfig.default_currency
    };

    const response = await axios.post(
      seamlessConfig.api_url.production,
      requestData
    );

    if (response.data.error !== 0) {
      throw new Error(`Error checking player: ${response.data.message || 'Unknown error'}`);
    }

    return {
      success: true,
      exists: !!response.data.response, // Convert to boolean
      playerInfo: response.data.response
    };
  } catch (error) {
    console.error('Error in playerExists:', error);
    return {
      success: false,
      message: error.message || 'Failed to check player'
    };
  }
};

/**
 * Create player at provider
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Created player info
 */
const createPlayer = async (userId) => {
  try {
    // Get user
    const user = await User.findByPk(userId);
    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    const requestData = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'createPlayer',
      user_username: `player${user.user_id}`, // Use a consistent format for usernames
      user_password: `pwd${user.user_id}${Date.now().toString(36)}`, // Generate a secure password
      user_nickname: user.user_name.substring(0, 16), // Limit to 16 chars as required
      currency: seamlessConfig.default_currency
    };

    const response = await axios.post(
      seamlessConfig.api_url.production,
      requestData
    );

    if (response.data.error !== 0) {
      // Check if player already exists
      if (response.data.message === 'Player already exists') {
        // Try to get existing player info
        return await playerExists(userId);
      }
      throw new Error(`Error creating player: ${response.data.message || 'Unknown error'}`);
    }

    return {
      success: true,
      playerInfo: response.data.response
    };
  } catch (error) {
    console.error('Error in createPlayer:', error);
    return {
      success: false,
      message: error.message || 'Failed to create player'
    };
  }
};

/**
 * Get game URL for launching a game
 * @param {number} userId - User ID
 * @param {string} gameId - Game ID or hash
 * @param {string} language - Language code
 * @returns {Promise<Object>} Game launch URL
 */
const getGameUrl = async (userId, gameId, language = seamlessConfig.default_language) => {
  try {
    let warningMessage = null;
    
    // First, check if there's already a third-party wallet with funds
    const walletBalanceCheck = await thirdPartyWalletService.getBalance(userId);
    
    // If wallet doesn't exist or has zero balance, try to transfer from main wallet
    if (!walletBalanceCheck.success || parseFloat(walletBalanceCheck.balance) <= 0) {
      // Transfer balance from main wallet to third-party wallet
      const transferResult = await thirdPartyWalletService.transferToThirdPartyWallet(userId);
      
      if (!transferResult.success) {
        // If error is about no funds, still continue but inform the user
        if (transferResult.message === 'No funds available in main wallet') {
          console.log(`User ${userId} has no funds to transfer to third-party wallet`);
          // Continue with game loading, but user won't be able to place bets
          warningMessage = 'You have no funds available to play. Please deposit first.';
        } else {
          console.error(`Failed to transfer to third-party wallet for user ${userId}:`, transferResult.message);
          throw new Error(`Failed to transfer to third-party wallet: ${transferResult.message}`);
        }
      }
    }
    
    // First, check if player exists
    const playerCheck = await playerExists(userId);
    
    // If player doesn't exist or there was an error, create the player
    if (!playerCheck.success || !playerCheck.exists) {
      const playerCreation = await createPlayer(userId);
      if (!playerCreation.success) {
        console.error(`Failed to create player for user ${userId}:`, playerCreation.message);
        throw new Error(`Failed to create player: ${playerCreation.message}`);
      }
    }
    
    // Get user
    const user = await User.findByPk(userId);
    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    const requestData = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'getGame',
      lang: language,
      user_username: `player${user.user_id}`,
      user_password: `pwd${user.user_id}${Date.now().toString(36)}`, // Must match or be consistent with createPlayer
      gameid: gameId,
      homeurl: seamlessConfig.home_url,
      cashierurl: seamlessConfig.cashier_url,
      play_for_fun: 0, // Real money play
      currency: seamlessConfig.default_currency
    };

    const response = await axios.post(
      seamlessConfig.api_url.production,
      requestData
    );

    if (response.data.error !== 0) {
      console.error(`Error getting game URL for user ${userId}, game ${gameId}:`, response.data);
      throw new Error(`Error getting game URL: ${response.data.message || 'Unknown error'} (code: ${response.data.error})`);
    }

    // Store game session info
    await SeamlessGameSession.create({
      user_id: userId,
      remote_id: playerCheck.playerInfo.id, // Use the remote ID from playerExists
      provider: gameId.includes('_') ? gameId.split('_')[0] : 'unknown',
      session_token: response.data.sessionid,
      game_id: gameId.includes('_') ? gameId.split('_')[1] : gameId,
      game_id_hash: gameId,
      is_active: true,
      ip_address: null, // Could be passed from the controller if needed
      game_type: gameId.includes('_') ? gameId.split('_')[0] : 'unknown', // Adding required field
      session_id: response.data.sessionid // Adding required field
    });

    // Handle different response formats from the provider
    // Sometimes the URL is in response.data.url, other times it's directly in response.data.response
    const gameUrl = response.data.url || response.data.response;
    
    return {
      success: true,
      gameUrl: gameUrl,
      warningMessage,
      sessionId: response.data.sessionid,
      gameSessionId: response.data.gamesession_id
    };
  } catch (error) {
    console.error(`Error in getGameUrl for user ${userId}, game ${gameId}:`, error);
    
    // Provide more specific error messages based on common issues
    if (error.message.includes('Network Error') || error.code === 'ECONNREFUSED') {
      return {
        success: false,
        message: 'Unable to connect to game provider. Please try again later.'
      };
    }
    
    if (error.response && error.response.status === 403) {
      return {
        success: false,
        message: 'Access denied by game provider. IP address may not be whitelisted.'
      };
    }
    
    return {
      success: false,
      message: error.message || 'Failed to get game URL'
    };
  }
};

/**
 * Process a balance request from the game provider
 * @param {Object} queryParams - The query parameters from the request
 * @returns {Promise<Object>} Response for the provider
 */
const processBalanceRequest = async (queryParams) => {
  const t = await sequelize.transaction();
  
  try {
    // Extract needed parameters
    const {
      remote_id,
      session_id,
      game_id,
      game_id_hash,
      provider
    } = queryParams;
    
    // Find user by remote_id (the ID assigned by the game provider)
    const gameSession = await SeamlessGameSession.findOne({
      where: { remote_id, is_active: true },
      order: [['created_at', 'DESC']],
      transaction: t
    });
    
    if (!gameSession) {
      await t.rollback();
      return {
        status: '500',
        msg: 'Session not found'
      };
    }
    
    // Get user
    const user = await User.findByPk(gameSession.user_id, {
      transaction: t
    });
    
    if (!user) {
      await t.rollback();
      return {
        status: '500',
        msg: 'User not found'
      };
    }
    
    // Get balance from third-party wallet instead of main wallet
    const walletResult = await thirdPartyWalletService.getBalance(user.user_id);
    
    if (!walletResult.success) {
      await t.rollback();
      return {
        status: '500',
        msg: 'Wallet not found'
      };
    }
    
    // Record this balance request
    await SeamlessTransaction.create({
      user_id: user.user_id,
      remote_id,
      provider_transaction_id: `balance_${Date.now()}`, // Generate a unique ID
      provider: provider || 'unknown',
      game_id: game_id || null,
      game_id_hash: game_id_hash || null,
      type: 'balance',
      amount: 0, // Balance requests don't have an amount
      session_id: session_id || null,
      wallet_balance_before: walletResult.balance,
      wallet_balance_after: walletResult.balance
    }, { transaction: t });
    
    // Update the session's last activity
    await gameSession.update({
      last_activity: new Date()
    }, { transaction: t });
    
    await t.commit();
    
    return {
      status: '200',
      balance: parseFloat(walletResult.balance).toFixed(2)
    };
  } catch (error) {
    await t.rollback();
    console.error('Error processing balance request:', error);
    return {
      status: '500',
      msg: 'Internal server error'
    };
  }
};

/**
 * Process a debit request from the game provider (player placing a bet)
 * @param {Object} queryParams - The query parameters from the request
 * @returns {Promise<Object>} Response for the provider
 */
const processDebitRequest = async (queryParams) => {
  const t = await sequelize.transaction();
  
  try {
    // Extract needed parameters
    const {
      remote_id,
      session_id,
      amount,
      game_id,
      game_id_hash,
      transaction_id,
      round_id,
      provider,
      gameplay_final,
      is_freeround_bet,
      jackpot_contribution_in_amount
    } = queryParams;
    
    // Check for duplicate transaction
    const existingTransaction = await SeamlessTransaction.findOne({
      where: { provider_transaction_id: transaction_id, type: 'debit' },
      transaction: t
    });
    
    if (existingTransaction) {
      // Return same response as the original transaction
      await t.rollback();
      return {
        status: '200',
        balance: parseFloat(existingTransaction.wallet_balance_after).toFixed(2),
        transactionId: existingTransaction.transaction_id
      };
    }
    
    // Find user by remote_id
    const gameSession = await SeamlessGameSession.findOne({
      where: { remote_id, is_active: true },
      order: [['created_at', 'DESC']],
      transaction: t
    });
    
    if (!gameSession) {
      await t.rollback();
      return {
        status: '500',
        msg: 'Session not found'
      };
    }
    
    // Get user 
    const user = await User.findByPk(gameSession.user_id, {
      transaction: t
    });
    
    if (!user) {
      await t.rollback();
      return {
        status: '500',
        msg: 'User not found'
      };
    }
    
    // Use third-party wallet service to update balance (deduct amount)
    const betAmount = parseFloat(amount);
    const walletResult = await thirdPartyWalletService.updateBalance(user.user_id, -betAmount);
    
    if (!walletResult.success) {
      await t.rollback();
      
      // Check if failure was due to insufficient funds
      if (walletResult.message === 'Insufficient funds') {
        return {
          status: '403',
          balance: parseFloat(walletResult.currentBalance).toFixed(2),
          msg: 'Insufficient funds'
        };
      }
      
      return {
        status: '500',
        msg: walletResult.message || 'Failed to update wallet'
      };
    }
    
    // Record transaction
    const transactionRecord = await SeamlessTransaction.create({
      user_id: user.user_id,
      remote_id,
      provider_transaction_id: transaction_id,
      provider: provider || 'unknown',
      game_id: game_id || null,
      game_id_hash: game_id_hash || null,
      round_id: round_id || null,
      type: 'debit',
      amount: betAmount,
      session_id: session_id || null,
      wallet_balance_before: walletResult.oldBalance,
      wallet_balance_after: walletResult.newBalance,
      is_freeround_bet: is_freeround_bet === '1',
      jackpot_contribution_in_amount: jackpot_contribution_in_amount || 0,
      gameplay_final: gameplay_final === '1'
    }, { transaction: t });
    
    // Update the session's last activity
    await gameSession.update({
      last_activity: new Date()
    }, { transaction: t });
    
    await t.commit();
    
    return {
      status: '200',
      balance: walletResult.newBalance.toFixed(2),
      transactionId: transactionRecord.transaction_id
    };
  } catch (error) {
    await t.rollback();
    console.error('Error processing debit request:', error);
    return {
      status: '500',
      msg: 'Internal server error'
    };
  }
};

/**
 * Process a credit request from the game provider (player winning)
 * @param {Object} queryParams - The query parameters from the request
 * @returns {Promise<Object>} Response for the provider
 */
const processCreditRequest = async (queryParams) => {
  const t = await sequelize.transaction();
  
  try {
    // Extract needed parameters
    const {
      remote_id,
      session_id,
      amount,
      game_id,
      game_id_hash,
      transaction_id,
      round_id,
      provider,
      gameplay_final,
      is_freeround_win,
      is_jackpot_win
    } = queryParams;
    
    // Check for duplicate transaction
    const existingTransaction = await SeamlessTransaction.findOne({
      where: { provider_transaction_id: transaction_id, type: 'credit' },
      transaction: t
    });
    
    if (existingTransaction) {
      // Return same response as the original transaction
      await t.rollback();
      return {
        status: '200',
        balance: parseFloat(existingTransaction.wallet_balance_after).toFixed(2),
        transactionId: existingTransaction.transaction_id
      };
    }
    
    // Find user by remote_id
    const gameSession = await SeamlessGameSession.findOne({
      where: { remote_id, is_active: true },
      order: [['created_at', 'DESC']],
      transaction: t
    });
    
    if (!gameSession) {
      await t.rollback();
      return {
        status: '500',
        msg: 'Session not found'
      };
    }
    
    // Get user
    const user = await User.findByPk(gameSession.user_id, {
      transaction: t
    });
    
    if (!user) {
      await t.rollback();
      return {
        status: '500',
        msg: 'User not found'
      };
    }
    
    // Process the win using third-party wallet
    const winAmount = parseFloat(amount);
    const walletResult = await thirdPartyWalletService.updateBalance(user.user_id, winAmount);
    
    if (!walletResult.success) {
      await t.rollback();
      return {
        status: '500',
        msg: walletResult.message || 'Failed to update wallet'
      };
    }
    
    // Record transaction
    const transactionRecord = await SeamlessTransaction.create({
      user_id: user.user_id,
      remote_id,
      provider_transaction_id: transaction_id,
      provider: provider || 'unknown',
      game_id: game_id || null,
      game_id_hash: game_id_hash || null,
      round_id: round_id || null,
      type: 'credit',
      amount: winAmount,
      session_id: session_id || null,
      wallet_balance_before: walletResult.oldBalance,
      wallet_balance_after: walletResult.newBalance,
      is_freeround_win: is_freeround_win === '1',
      is_jackpot_win: is_jackpot_win === '1',
      gameplay_final: gameplay_final === '1'
    }, { transaction: t });
    
    // Update the session's last activity
    await gameSession.update({
      last_activity: new Date()
    }, { transaction: t });
    
    await t.commit();
    
    return {
      status: '200',
      balance: walletResult.newBalance.toFixed(2),
      transactionId: transactionRecord.transaction_id
    };
  } catch (error) {
    await t.rollback();
    console.error('Error processing credit request:', error);
    return {
      status: '500',
      msg: 'Internal server error'
    };
  }
};

/**
 * Process a rollback request from the game provider
 * @param {Object} queryParams - The query parameters from the request
 * @returns {Promise<Object>} Response for the provider
 */
const processRollbackRequest = async (queryParams) => {
  const t = await sequelize.transaction();
  
  try {
    // Extract needed parameters
    const {
      remote_id,
      transaction_id,
      session_id,
      provider
    } = queryParams;
    
    // Check for duplicate rollback
    const existingRollback = await SeamlessTransaction.findOne({
      where: { 
        related_transaction_id: transaction_id, 
        type: 'rollback'
      },
      transaction: t
    });
    
    if (existingRollback) {
      // Return same response as the original rollback
      await t.rollback();
      return {
        status: '200',
        balance: parseFloat(existingRollback.wallet_balance_after).toFixed(2),
        transactionId: existingRollback.transaction_id
      };
    }
    
    // Find the original transaction
    const originalTransaction = await SeamlessTransaction.findOne({
      where: { provider_transaction_id: transaction_id },
      transaction: t
    });
    
    if (!originalTransaction) {
      await t.rollback();
      return {
        status: '404',
        msg: 'Original transaction not found'
      };
    }
    
    // Check if transaction already rolled back
    if (originalTransaction.status === 'rolledback') {
      await t.rollback();
      return {
        status: '200',
        balance: parseFloat(originalTransaction.wallet_balance_before).toFixed(2),
        msg: 'Transaction already rolled back'
      };
    }
    
    // Get user
    const user = await User.findByPk(originalTransaction.user_id, {
      transaction: t
    });
    
    if (!user) {
      await t.rollback();
      return {
        status: '500',
        msg: 'User not found'
      };
    }
    
    // Process the rollback in third-party wallet
    let walletResult;
    
    // If original was debit (bet), add money back to wallet
    if (originalTransaction.type === 'debit') {
      walletResult = await thirdPartyWalletService.updateBalance(
        user.user_id, 
        parseFloat(originalTransaction.amount)
      );
    } 
    // If original was credit (win), subtract money from wallet
    else if (originalTransaction.type === 'credit') {
      walletResult = await thirdPartyWalletService.updateBalance(
        user.user_id, 
        -parseFloat(originalTransaction.amount)
      );
      
      // Check if wallet has enough balance for the rollback
      if (!walletResult.success && walletResult.message === 'Insufficient funds') {
        await t.rollback();
        return {
          status: '403',
          balance: walletResult.currentBalance.toFixed(2),
          msg: 'Insufficient funds for rollback'
        };
      }
    }
    
    if (!walletResult || !walletResult.success) {
      await t.rollback();
      return {
        status: '500',
        msg: walletResult ? walletResult.message : 'Failed to process rollback'
      };
    }
    
    // Mark original transaction as rolled back
    await originalTransaction.update({
      status: 'rolledback',
      updated_at: new Date()
    }, { transaction: t });
    
    // Record rollback transaction
    const rollbackTransactionId = `rollback_${transaction_id}_${Date.now()}`;
    const transactionRecord = await SeamlessTransaction.create({
      user_id: user.user_id,
      remote_id,
      provider_transaction_id: rollbackTransactionId,
      provider: provider || 'unknown',
      game_id: originalTransaction.game_id,
      game_id_hash: originalTransaction.game_id_hash,
      round_id: originalTransaction.round_id,
      type: 'rollback',
      amount: parseFloat(originalTransaction.amount),
      session_id: session_id || null,
      wallet_balance_before: walletResult.oldBalance,
      wallet_balance_after: walletResult.newBalance,
      related_transaction_id: transaction_id,
      status: 'success'
    }, { transaction: t });
    
    await t.commit();
    
    return {
      status: '200',
      balance: walletResult.newBalance.toFixed(2),
      transactionId: transactionRecord.transaction_id
    };
  } catch (error) {
    await t.rollback();
    console.error('Error processing rollback request:', error);
    return {
      status: '500',
      msg: 'Internal server error'
    };
  }
};

/**
 * Close an active game session and transfer balance back to main wallet
 * @param {string} sessionToken - Session token
 * @returns {Promise<Object>} Result
 */
const closeGameSession = async (sessionToken) => {
  try {
    const gameSession = await SeamlessGameSession.findOne({
      where: { session_token: sessionToken, is_active: true }
    });
    
    if (!gameSession) {
      return {
        success: false,
        message: 'Active session not found'
      };
    }
    
    // Update session
    await gameSession.update({
      is_active: false,
      closed_at: new Date()
    });
    
    // Transfer balance back to main wallet
    const transferResult = await thirdPartyWalletService.transferToMainWallet(gameSession.user_id);
    
    if (!transferResult.success) {
      return {
        success: false,
        message: `Game session closed but failed to transfer balance: ${transferResult.message}`
      };
    }
    
    return {
      success: true,
      message: 'Game session closed and balance transferred successfully'
    };
  } catch (error) {
    console.error('Error closing game session:', error);
    return {
      success: false,
      message: 'Failed to close game session'
    };
  }
};

/**
 * Check for and close expired sessions
 * @returns {Promise<Object>} Result with count of closed sessions
 */
const cleanupExpiredSessions = async () => {
  try {
    // Find sessions that haven't had activity for the configured expiry time
    const expiryTime = new Date();
    expiryTime.setSeconds(expiryTime.getSeconds() - seamlessConfig.session_expiry);
    
    const expiredSessions = await SeamlessGameSession.findAll({
      where: {
        is_active: true,
        last_activity: {
          [Op.lt]: expiryTime
        }
      }
    });
    
    // Close expired sessions
    for (const session of expiredSessions) {
      await session.update({
        is_active: false,
        closed_at: new Date()
      });
    }
    
    return {
      success: true,
      message: `Closed ${expiredSessions.length} expired sessions`
    };
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
    return {
      success: false,
      message: 'Failed to clean up expired sessions'
    };
  }
};

/**
 * Add free rounds to players
 * @param {string} title - Free rounds campaign title
 * @param {string} playerIds - Comma-separated player IDs
 * @param {string} gameIds - Comma-separated game IDs
 * @param {number} available - Number of free rounds
 * @param {Date} validTo - Expiry date
 * @param {Date} validFrom - Start date (optional)
 * @param {string} betLevel - Bet level (min, med, max)
 * @returns {Promise<Object>} Response from API
 */
const addFreeRounds = async (
  title,
  playerIds,
  gameIds,
  available,
  validTo,
  validFrom = null,
  betLevel = seamlessConfig.default_betlevel
) => {
  try {
    const requestData = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'addFreeRounds',
      title,
      playerids: playerIds,
      gameids: gameIds,
      available: parseInt(available),
      validTo: validTo,
      betlevel: betLevel
    };
    
    if (validFrom) {
      requestData.validFrom = validFrom;
    }

    const response = await axios.post(
      seamlessConfig.api_url.production,
      requestData
    );

    if (response.data.error !== 0) {
      throw new Error(`Error adding free rounds: ${response.data.message || 'Unknown error'}`);
    }

    return {
      success: true,
      message: 'Free rounds added successfully',
      data: response.data.response
    };
  } catch (error) {
    console.error('Error in addFreeRounds:', error);
    return {
      success: false,
      message: error.message || 'Failed to add free rounds'
    };
  }
};

/**
 * Remove free rounds from players
 * @param {string} title - Title of the free rounds to remove
 * @param {string} playerIds - Comma-separated list of player IDs
 * @param {string} gameIds - Comma-separated list of game IDs
 * @returns {Promise<Object>} Result of the operation
 */
const removeFreeRounds = async (title, playerIds, gameIds) => {
  try {
    const requestData = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'removeFreeRounds',
      title: title,
      player_ids: playerIds,
      game_ids: gameIds
    };

    const response = await axios.post(
      seamlessConfig.api_url.production,
      requestData
    );

    if (response.data.error !== 0) {
      throw new Error(`Error removing free rounds: ${response.data.message || 'Unknown error'}`);
    }

    return {
      success: true,
      message: 'Free rounds removed successfully',
      response: response.data.response
    };
  } catch (error) {
    console.error('Error in removeFreeRounds:', error);
    return {
      success: false,
      message: error.message || 'Failed to remove free rounds'
    };
  }
};

module.exports = {
  getGameList,
  playerExists,
  createPlayer,
  getGameUrl,
  processBalanceRequest,
  processDebitRequest,
  processCreditRequest,
  processRollbackRequest,
  closeGameSession,
  cleanupExpiredSessions,
  addFreeRounds,
  removeFreeRounds
};