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
 * @param {string} filters.page - Page number for pagination
 * @param {string} filters.limit - Number of items per page for pagination
 * @returns {Promise<Object>} List of games
 */
const getGameList = async (currency = seamlessConfig.default_currency, filters = {}) => {
  try {
    console.log('=== GET GAME LIST SERVICE ===');
    console.log('Input parameters:', { currency, filters });

    const requestData = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'getGameList',
      show_systems: 0,
      show_additional: true, // Important to get all filtering data
      currency: currency
    };

    console.log('Making API request to:', seamlessConfig.api_url.production);
    const response = await axios.post(
      seamlessConfig.api_url.production,
      requestData
    );

    if (response.data.error !== 0) {
      throw new Error(`Error getting game list: ${response.data.message || 'Unknown error'}`);
    }

    // Apply filters if provided
    let filteredGames = response.data.response;
    console.log('Initial games count:', filteredGames.length);
    
    if (filters && Object.keys(filters).length > 0) {
      console.log('Applying filters:', filters);
      
      // Filter by category (e.g. 'video-slots', 'livecasino', etc.)
      if (filters.category) {
        const initialCount = filteredGames.length;
        filteredGames = filteredGames.filter(game => 
          game.type === filters.category || game.category === filters.category
        );
        console.log(`Filtered ${initialCount - filteredGames.length} games by category: ${filters.category}`);
      }
      
      // Filter by provider/system
      const providerMap = {
        'leap': ['Leap'],
        'playtech': ['Playtech'],
        'goldenrace': ['Goldenrace'],
        'ezugi': ['ezugi'],
        'evolution': ['evolution'],
        'ebet': ['eBET'],
        'bombay': ['Bombay Live'],
        'asiagaming': ['asiagaming'],
        'pragmatic': ['pragmatic play'],
        'betconstruct': ['Betconstruct Live'],
        'g24': ['LiveG24'],
        'tvbet': ['TVbet'],
        'digitain': ['digitain'],
        'inplaynet': ['inplaynet'],
        'smartsoft': ['SmartSoft'],
        'habanero': ['Habanero'],
        'betsoft': ['betsoft'],
        'isoftbet': ['isoftbet'],
        'pgsoft': ['PG Soft'],
        'onetouch': ['One Touch'],
        'evoplay': ['Evoplay'],
        'jili': ['Jili'],
        'blueprint': ['Blueprint'],
        'galaxsys': ['Galaxsys'],
        'dragontiger': ['dragon tiger'],
        'mines': ['mines'],
        'plinko': ['plinko'],
        'ludo': ['ludo'],
        'teenpatti': ['teen patti'],
        'rolet': ['rolet'],
        'aviator': ['aviator'],
        'spribe': ['Spribe']
      };

      const providerCodes = providerMap[filters.provider.toLowerCase()] || [];
      console.log('Provider codes to filter:', providerCodes);

      if (providerCodes) {
        const initialCount = filteredGames.length;
        filteredGames = filteredGames.filter(game => {
          // Check all provider-related fields with exact case matching
          const systemMatch = providerCodes.some(code => 
            game.system === code
          );
          const subcategoryMatch = providerCodes.some(code => 
            game.subcategory === code
          );
          const categoryMatch = providerCodes.some(code => 
            game.category === code
          );
          const reportMatch = providerCodes.some(code => 
            game.report === code
          );
          const nameMatch = providerCodes.some(code => 
            game.name === code
          );
          const gamenameMatch = providerCodes.some(code => 
            game.gamename === code
          );

          const isMatch = systemMatch || subcategoryMatch || categoryMatch || reportMatch || nameMatch || gamenameMatch;
          
          // Enhanced logging for debugging
          if (isMatch || initialCount - filteredGames.length < 5) {
            console.log('Game details:', {
              name: game.name,
              gamename: game.gamename,
              system: game.system,
              subcategory: game.subcategory,
              category: game.category,
              report: game.report,
              isMatch: isMatch
            });
          }
          
          return isMatch;
        });
        console.log(`Filtered ${initialCount - filteredGames.length} games by provider: ${filters.provider}`);
      } else {
        console.log('No provider codes found for:', filters.provider);
      }
      
      // Filter for mobile games
      if (filters.mobile === true) {
        const initialCount = filteredGames.length;
        filteredGames = filteredGames.filter(game => game.mobile === true);
        console.log(`Filtered ${initialCount - filteredGames.length} games by mobile`);
      }
      
      // Filter for jackpot games
      if (filters.jackpot === true) {
        const initialCount = filteredGames.length;
        filteredGames = filteredGames.filter(game => game.has_jackpot === true);
        console.log(`Filtered ${initialCount - filteredGames.length} games by jackpot`);
      }
      
      // Filter for games supporting free rounds
      if (filters.freerounds === true) {
        const initialCount = filteredGames.length;
        filteredGames = filteredGames.filter(game => game.freerounds_supported === true);
        console.log(`Filtered ${initialCount - filteredGames.length} games by freerounds`);
      }
    } else {
      console.log('No filters provided, returning all games');
    }

    // Apply pagination
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedGames = filteredGames.slice(startIndex, endIndex);

    console.log(`Final filtered games count: ${filteredGames.length}`);
    console.log(`Pagination: Page ${page}, Limit ${limit}, Showing ${paginatedGames.length} games`);
    console.log('=== END GET GAME LIST SERVICE ===\n');

    return {
      success: true,
      games: paginatedGames,
      totalCount: response.data.response.length,
      filteredCount: filteredGames.length,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(filteredGames.length / limit),
        totalItems: filteredGames.length,
        itemsPerPage: limit
      }
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
    
    // Add debug logging
    console.log('=== DEBUG: getGameUrl ===');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Frontend URL from env:', process.env.FRONTEND_URL);
    console.log('Home URL from config:', seamlessConfig.home_url);
    console.log('Cashier URL from config:', seamlessConfig.cashier_url);
    
    // Get user first
    const user = await User.findByPk(userId);
    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    // Generate a consistent password based on user ID and a fixed salt
    const userPassword = `pwd${user.user_id}${process.env.SEAMLESS_PASSWORD_SALT || 'default_salt'}`;
    
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

    // Check for existing valid session
    const existingSession = await SeamlessGameSession.findOne({
      where: {
        user_id: userId,
        game_id_hash: gameId,
        is_active: true,
        created_at: {
          [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Within last 24 hours
        }
      }
    });

    // If we have a valid session, use it
    if (existingSession) {
      console.log('Using existing valid session:', existingSession.session_id);
      return {
        success: true,
        gameUrl: existingSession.game_url,
        warningMessage,
        sessionId: existingSession.session_id,
        gameSessionId: existingSession.game_session_id
      };
    }

    const requestData = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'getGame',
      lang: language,
      user_username: `player${user.user_id}`,
      user_password: userPassword, // Use consistent password
      gameid: gameId,
      homeurl: seamlessConfig.home_url,
      cashierurl: seamlessConfig.cashier_url,
      play_for_fun: 0,
      currency: seamlessConfig.default_currency
    };

    // Add debug logging for request data
    console.log('Request data being sent:', {
      ...requestData,
      api_password: '***REDACTED***' // Don't log sensitive data
    });

    const response = await axios.post(
      seamlessConfig.api_url.production,
      requestData
    );

    if (response.data.error !== 0) {
      console.error(`Error getting game URL for user ${userId}, game ${gameId}:`, response.data);
      throw new Error(`Error getting game URL: ${response.data.message || 'Unknown error'} (code: ${response.data.error})`);
    }

    // Store game session info
    const gameSession = await SeamlessGameSession.create({
      user_id: userId,
      remote_id: playerCheck.playerInfo.id, // Use the remote ID from playerExists
      provider: gameId.includes('_') ? gameId.split('_')[0] : 'unknown',
      session_token: response.data.sessionid,
      game_id: gameId.includes('_') ? gameId.split('_')[1] : gameId,
      game_id_hash: gameId,
      is_active: true,
      ip_address: null, // Could be passed from the controller if needed
      game_type: gameId.includes('_') ? gameId.split('_')[0] : 'unknown',
      session_id: response.data.sessionid,
      game_session_id: response.data.gamesession_id,
      game_url: response.data.url || response.data.response,
      user_password: userPassword // Store the password used for this session
    });

    // Handle different response formats from the provider
    const gameUrl = response.data.url || response.data.response;
    
    // Log the response for debugging
    console.log('🔍 Provider response:', {
      hasUrl: !!response.data.url,
      hasResponse: !!response.data.response,
      sessionId: response.data.sessionid,
      gameSessionId: response.data.gamesession_id
    });
    
    if (!gameUrl) {
      console.error('No game URL found in provider response:', response.data);
      throw new Error('No game URL received from provider');
    }
    
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
    
    console.log('=== DEBUG: Balance Request ===');
    console.log('Query params:', queryParams);
    
    // Find active game session
    const gameSession = await SeamlessGameSession.findOne({
      where: { 
        remote_id, 
        is_active: true,
        session_id: session_id // Validate session ID
      },
      order: [['created_at', 'DESC']],
      transaction: t
    });
    
    if (!gameSession) {
      console.error('Session not found or invalid:', { remote_id, session_id });
      await t.rollback();
      return {
        status: '500',
        msg: 'Invalid session'
      };
    }
    
    // Get user
    const user = await User.findByPk(gameSession.user_id, {
      transaction: t
    });
    
    if (!user) {
      console.error('User not found for session:', { remote_id, session_id });
      await t.rollback();
      return {
        status: '500',
        msg: 'User not found'
      };
    }
    
    // Get balance from third-party wallet
    const walletResult = await thirdPartyWalletService.getBalance(user.user_id);
    
    if (!walletResult.success) {
      console.error('Wallet not found for user:', user.user_id);
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
      provider_transaction_id: `balance_${Date.now()}`,
      provider: provider || 'unknown',
      game_id: game_id || null,
      game_id_hash: game_id_hash || null,
      type: 'balance',
      amount: 0,
      session_id: session_id || null,
      wallet_balance_before: walletResult.balance,
      wallet_balance_after: walletResult.balance
    }, { transaction: t });
    
    await t.commit();
    
    // Return balance with 2 decimal places
    return {
      status: '200',
      balance: parseFloat(walletResult.balance).toFixed(2)
    };
  } catch (error) {
    console.error('Error processing balance request:', error);
    await t.rollback();
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
    
    // Process activity reward
    try {
      const { processBetForActivityReward } = require('./activityRewardService');
      await processBetForActivityReward(user.user_id, betAmount, 'seamless', t);
    } catch (activityError) {
      logger.warn('Activity reward processing failed for seamless game', {
        error: activityError.message,
        userId: user.user_id,
        betAmount,
        gameType: 'seamless'
      });
    }
    
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

/**
 * Validate and refresh a game session
 * @param {string} sessionId - Session ID to validate
 * @returns {Promise<Object>} Validation result
 */
const validateGameSession = async (sessionId) => {
  try {
    const gameSession = await SeamlessGameSession.findOne({
      where: { 
        session_id: sessionId,
        is_active: true
      }
    });

    if (!gameSession) {
      return {
        success: false,
        message: 'Invalid or expired session'
      };
    }

    // Check if session is too old (24 hours)
    const sessionAge = Date.now() - gameSession.created_at.getTime();
    if (sessionAge > 24 * 60 * 60 * 1000) {
      // Close expired session
      await gameSession.update({
        is_active: false,
        closed_at: new Date()
      });

      return {
        success: false,
        message: 'Session expired'
      };
    }

    // Update last activity
    await gameSession.update({
      last_activity: new Date()
    });

    return {
      success: true,
      session: gameSession
    };
  } catch (error) {
    console.error('Error validating game session:', error);
    return {
      success: false,
      message: 'Error validating session'
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
  removeFreeRounds,
  validateGameSession
};