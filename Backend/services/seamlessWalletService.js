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
 * CRITICAL FIX: Helper function to find user by remote_id
 */
const findUserByRemoteId = async (remote_id, transaction = null) => {
  try {
    // Extract user ID from remote_id format (player123 -> 123)
    const userIdMatch = remote_id.match(/player(\d+)/);
    if (!userIdMatch) {
      throw new Error(`Invalid remote_id format: ${remote_id}`);
    }
    
    const userId = parseInt(userIdMatch[1]);
    console.log('Extracted user ID from remote_id:', userId);
    
    const user = await User.findByPk(userId, { transaction });
    if (!user) {
      throw new Error(`User not found for ID: ${userId}`);
    }
    
    return user;
  } catch (error) {
    console.error('Error finding user by remote_id:', error);
    throw error;
  }
};



/**
 * Generate consistent player credentials
 * @param {Object} user - User object
 * @returns {Object} Player credentials
 */
const generatePlayerCredentials = (user) => {
  return {
    username: `${seamlessConfig.player_prefix}${user.user_id}`,
    password: `pwd${user.user_id}_${seamlessConfig.password_salt}`,
    nickname: user.user_name ? user.user_name.substring(0, 16) : `Player${user.user_id}`
  };
};

/**
 * Check if player exists at provider with consistent credentials
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Player info or false
 */
const playerExists = async (userId) => {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    const credentials = generatePlayerCredentials(user);
    const requestData = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'playerExists',
      user_username: credentials.username,
      currency: seamlessConfig.default_currency
    };

    console.log('🔍 Checking player exists:', {
      username: credentials.username,
      userId: userId
    });

    const response = await axios.post(seamlessConfig.api_url.production, requestData);

    if (response.data.error !== 0) {
      if (response.data.error === 1 && response.data.message === 'Player not found') {
        return { success: true, exists: false };
      }
      throw new Error(`Error checking player: ${response.data.message || 'Unknown error'}`);
    }

    return {
      success: true,
      exists: !!response.data.response,
      playerInfo: response.data.response,
      credentials: credentials
    };
  } catch (error) {
    console.error('Error in playerExists:', error);
    return { success: false, message: error.message || 'Failed to check player' };
  }
};

/**
 * Create player at provider with consistent credentials
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Created player info
 */
/**
 * FIXED: Create player at provider with proper error handling
 */
const createPlayer = async (userId) => {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    // Use consistent username format
    const username = `player${user.user_id}`;
    const password = `pwd${user.user_id}${process.env.SEAMLESS_PASSWORD_SALT || 'default_salt'}`;

    const requestData = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'createPlayer',
      user_username: username,
      user_password: password,
      user_nickname: user.user_name.substring(0, 16),
      currency: seamlessConfig.default_currency
    };

    console.log('Creating player with data:', {
      ...requestData,
      api_password: '***'
    });

    const response = await axios.post(
      seamlessConfig.api_url.production,
      requestData,
      { timeout: 30000 }
    );

    console.log('Create player response:', response.data);

    if (response.data.error !== 0) {
      if (response.data.message === 'Player already exists') {
        // Return success if player already exists
        return {
          success: true,
          playerInfo: {
            id: username,
            username: username,
            exists: true
          }
        };
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
 * Get game URL for launching a game - FIXED SESSION MANAGEMENT
 * @param {number} userId - User ID
 * @param {string} gameId - Game ID or hash
 * @param {string} language - Language code
 * @returns {Promise<Object>} Game launch URL
 */
/**
 * FIXED: Get game URL with proper session management
 */
const getGameUrl = async (userId, gameId, language = seamlessConfig.default_language) => {
  try {
    console.log('=== GET GAME URL DEBUG ===');
    console.log('User ID:', userId);
    console.log('Game ID:', gameId);
    
    const user = await User.findByPk(userId);
    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    const username = `player${user.user_id}`;
    const userPassword = `pwd${user.user_id}${process.env.SEAMLESS_PASSWORD_SALT || 'default_salt'}`;
    
    console.log('Using username:', username);
    
    // Check if player exists, create if not
    const playerCheck = await playerExists(userId);
    if (!playerCheck.success || !playerCheck.exists) {
      console.log('Player does not exist, creating...');
      const playerCreation = await createPlayer(userId);
      if (!playerCreation.success) {
        throw new Error(`Failed to create player: ${playerCreation.message}`);
      }
    }
    
    // Ensure third-party wallet exists and has funds
    const walletCheck = await thirdPartyWalletService.getBalance(userId);
    if (!walletCheck.success) {
      // Create wallet if it doesn't exist
      await thirdPartyWalletService.createWallet(userId);
    }
    
    // Transfer funds if wallet is empty
    if (!walletCheck.success || parseFloat(walletCheck.balance) <= 0) {
      const transferResult = await thirdPartyWalletService.transferToThirdPartyWallet(userId);
      if (!transferResult.success && transferResult.message !== 'No funds available in main wallet') {
        console.warn('Failed to transfer to third-party wallet:', transferResult.message);
      }
    }

    const requestData = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'getGame',
      lang: language,
      user_username: username,
      user_password: userPassword,
      gameid: gameId,
      homeurl: seamlessConfig.home_url,
      cashierurl: seamlessConfig.cashier_url,
      play_for_fun: 0,
      currency: seamlessConfig.default_currency
    };

    console.log('Making getGame request with data:', {
      ...requestData,
      api_password: '***'
    });

    const response = await axios.post(
      seamlessConfig.api_url.production,
      requestData,
      { timeout: 30000 }
    );

    console.log('GetGame response:', response.data);

    if (response.data.error !== 0) {
      throw new Error(`Error getting game URL: ${response.data.message || 'Unknown error'} (code: ${response.data.error})`);
    }

    // Store game session
    const gameSession = await SeamlessGameSession.create({
      user_id: userId,
      remote_id: username,
      provider: gameId.includes('_') ? gameId.split('_')[0] : 'unknown',
      session_token: response.data.sessionid,
      game_id: gameId.includes('_') ? gameId.split('_')[1] : gameId,
      game_id_hash: gameId,
      is_active: true,
      game_type: gameId.includes('_') ? gameId.split('_')[0] : 'unknown',
      session_id: response.data.sessionid,
      game_url: response.data.url || response.data.response
    });

    const gameUrl = response.data.url || response.data.response;
    
    if (!gameUrl) {
      throw new Error('No game URL received from provider');
    }
    
    return {
      success: true,
      gameUrl: gameUrl,
      sessionId: response.data.sessionid,
      gameSessionId: response.data.gamesession_id
    };
  } catch (error) {
    console.error(`Error in getGameUrl:`, error);
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
/**
 * FIXED: Process balance request with proper user resolution
 */
const processBalanceRequest = async (queryParams) => {
  const t = await sequelize.transaction();
  
  try {
    const { remote_id, session_id, game_id, game_id_hash, provider } = queryParams;
    
    console.log('=== BALANCE REQUEST DEBUG ===');
    console.log('Query params:', queryParams);
    
    // CRITICAL FIX: Find user by remote_id
    const user = await findUserByRemoteId(remote_id, t);
    console.log('Found user:', { id: user.user_id, name: user.user_name });
    
    // Get balance from third-party wallet
    const walletResult = await thirdPartyWalletService.getBalance(user.user_id);
    console.log('Wallet balance result:', walletResult);
    
    if (!walletResult.success) {
      console.error('Wallet not found for user:', user.user_id);
      
      // CRITICAL FIX: Try to create wallet if it doesn't exist
      const createWalletResult = await thirdPartyWalletService.createWallet(user.user_id);
      if (!createWalletResult.success) {
        await t.rollback();
        return {
          status: '500',
          msg: 'Failed to create wallet'
        };
      }
      
      // Get balance again after creating wallet
      const newWalletResult = await thirdPartyWalletService.getBalance(user.user_id);
      if (!newWalletResult.success) {
        await t.rollback();
        return {
          status: '500',
          msg: 'Wallet error after creation'
        };
      }
      
      walletResult.balance = newWalletResult.balance;
    }
    
    // Record this balance request
    await SeamlessTransaction.create({
      transaction_id: `bal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
    
    console.log('Returning balance:', parseFloat(walletResult.balance).toFixed(2));
    
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
/**
 * FIXED: Process debit request with proper user resolution
 */
const processDebitRequest = async (queryParams) => {
  const t = await sequelize.transaction();
  
  try {
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
    
    console.log('=== DEBIT REQUEST DEBUG ===');
    console.log('Query params:', queryParams);
    
    // Check for duplicate transaction
    const existingTransaction = await SeamlessTransaction.findOne({
      where: { provider_transaction_id: transaction_id, type: 'debit' },
      transaction: t
    });
    
    if (existingTransaction) {
      console.log('Duplicate transaction found, returning previous result');
      await t.rollback();
      return {
        status: '200',
        balance: parseFloat(existingTransaction.wallet_balance_after).toFixed(2),
        transactionId: existingTransaction.transaction_id
      };
    }
    
    // CRITICAL FIX: Find user by remote_id
    const user = await findUserByRemoteId(remote_id, t);
    console.log('Found user for debit:', { id: user.user_id, name: user.user_name });
    
    // Process bet using third-party wallet
    const betAmount = parseFloat(amount);
    console.log('Processing bet amount:', betAmount);
    
    const walletResult = await thirdPartyWalletService.updateBalance(user.user_id, -betAmount);
    console.log('Wallet update result:', walletResult);
    
    if (!walletResult.success) {
      await t.rollback();
      
      if (walletResult.message === 'Insufficient funds') {
        return {
          status: '403',
          balance: parseFloat(walletResult.currentBalance || 0).toFixed(2),
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
      transaction_id: `deb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
    
    await t.commit();
    
    console.log('Debit successful, new balance:', walletResult.newBalance.toFixed(2));
    
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
/**
 * FIXED: Process credit request with proper user resolution
 */
const processCreditRequest = async (queryParams) => {
  const t = await sequelize.transaction();
  
  try {
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
    
    console.log('=== CREDIT REQUEST DEBUG ===');
    console.log('Query params:', queryParams);
    
    // Check for duplicate transaction
    const existingTransaction = await SeamlessTransaction.findOne({
      where: { provider_transaction_id: transaction_id, type: 'credit' },
      transaction: t
    });
    
    if (existingTransaction) {
      console.log('Duplicate transaction found, returning previous result');
      await t.rollback();
      return {
        status: '200',
        balance: parseFloat(existingTransaction.wallet_balance_after).toFixed(2),
        transactionId: existingTransaction.transaction_id
      };
    }
    
    // CRITICAL FIX: Find user by remote_id
    const user = await findUserByRemoteId(remote_id, t);
    console.log('Found user for credit:', { id: user.user_id, name: user.user_name });
    
    // Process win using third-party wallet
    const winAmount = parseFloat(amount);
    console.log('Processing win amount:', winAmount);
    
    const walletResult = await thirdPartyWalletService.updateBalance(user.user_id, winAmount);
    console.log('Wallet update result:', walletResult);
    
    if (!walletResult.success) {
      await t.rollback();
      return {
        status: '500',
        msg: walletResult.message || 'Failed to update wallet'
      };
    }
    
    // Record transaction
    const transactionRecord = await SeamlessTransaction.create({
      transaction_id: `crd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
    
    await t.commit();
    
    console.log('Credit successful, new balance:', walletResult.newBalance.toFixed(2));
    
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
  validateGameSession,
  generatePlayerCredentials
};