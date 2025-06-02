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
        'leap': ['Leap', 'LEAP'],
        'playtech': ['Playtech', 'PLAYTECH'],
        'goldenrace': ['Goldenrace', 'GOLDENRACE'],
        'ezugi': ['ezugi', 'EZUGI'],
        'evolution': ['evolution', 'EVOLUTION'],
        'ebet': ['eBET', 'EBET'],
        'bombay': ['Bombay Live', 'BOMBAY LIVE'],
        'asiagaming': ['asiagaming', 'ASIAGAMING'],
        'pragmatic': ['pragmatic play', 'PRAGMATIC PLAY', 'pragmatic'],
        'betconstruct': ['Betconstruct Live', 'BETCONSTRUCT LIVE'],
        'g24': ['LiveG24', 'LIVEG24'],
        'tvbet': ['TVbet', 'TVBET'],
        'digitain': ['digitain', 'DIGITAIN'],
        'inplaynet': ['inplaynet', 'INPLAYNET'],
        'smartsoft': ['SmartSoft', 'SMARTSOFT'],
        'habanero': ['Habanero', 'HABANERO'],
        'betsoft': ['betsoft', 'BETSOFT'],
        'isoftbet': ['isoftbet', 'ISOFTBET'],
        'pgsoft': ['PG Soft', 'PGSOFT'],
        'onetouch': ['One Touch', 'ONE TOUCH'],
        'evoplay': ['Evoplay', 'EVOPLAY'],
        'jili': ['Jili', 'JILI'],
        'blueprint': ['Blueprint', 'BLUEPRINT'],
        'galaxsys': ['Galaxsys', 'GALAXSYS'],
        'dragontiger': ['dragon tiger', 'DRAGON TIGER'],
        'mines': ['mines', 'MINES'],
        'plinko': ['plinko', 'PLINKO'],
        'ludo': ['ludo', 'LUDO'],
        'teenpatti': ['teen patti', 'TEEN PATTI'],
        'rolet': ['rolet', 'ROLET'],
        'aviator': ['aviator', 'AVIATOR'],
        'spribe': ['Spribe', 'SPRIBE']
      };

      const providerCodes = providerMap[filters.provider.toLowerCase()] || [];
      console.log('Provider codes to filter:', providerCodes);

      if (providerCodes.length > 0) {
        const initialCount = filteredGames.length;
        filteredGames = filteredGames.filter(game => {
          // Check all provider-related fields with case-insensitive matching
          const systemMatch = providerCodes.some(code => 
            game.system?.toLowerCase() === code.toLowerCase()
          );
          const subcategoryMatch = providerCodes.some(code => 
            game.subcategory?.toLowerCase() === code.toLowerCase()
          );
          const categoryMatch = providerCodes.some(code => 
            game.category?.toLowerCase() === code.toLowerCase()
          );
          const reportMatch = providerCodes.some(code => 
            game.report?.toLowerCase() === code.toLowerCase()
          );
          const nameMatch = providerCodes.some(code => 
            game.name?.toLowerCase() === code.toLowerCase()
          );
          const gamenameMatch = providerCodes.some(code => 
            game.gamename?.toLowerCase() === code.toLowerCase()
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
// 6. DOCS COMPLIANCE: Player creation with exact format
const createPlayer = async (userId) => {
  try {
    const user = await User.findByPk(userId);
    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    // DOCS COMPLIANCE: Username format and constraints
    const username = `player${user.user_id}`; // 4-16 chars, no special chars
    const password = `pwd${user.user_id}${process.env.SEAMLESS_PASSWORD_SALT || 'default'}`;
    
    // DOCS COMPLIANCE: Nickname 2-25 chars
    let nickname = user.user_name.substring(0, 16);
    if (nickname.length < 2) {
      nickname = `user${user.user_id}`;
    }

    const requestData = {
      api_login: process.env.SEAMLESS_API_LOGIN,
      api_password: process.env.SEAMLESS_API_PASSWORD,
      method: 'createPlayer',
      user_username: username,
      user_password: password,
      user_nickname: nickname,
      currency: 'EUR' // DOCS COMPLIANCE: Use exact currency from config
    };

    const response = await axios.post(
      process.env.SEAMLESS_API_URL,
      requestData,
      { timeout: 30000 }
    );

    if (response.data.error !== 0) {
      if (response.data.message === 'Player already exists') {
        return {
          success: true,
          playerInfo: {
            id: username,
            username: username,
            exists: true
          }
        };
      }
      throw new Error(`Create player error: ${response.data.message}`);
    }

    return {
      success: true,
      playerInfo: response.data.response
    };
  } catch (error) {
    console.error('Create player error:', error);
    return {
      success: false,
      message: error.message
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
const getGameUrl = async (userId, gameId, language = 'en') => {
  try {
    const user = await User.findByPk(userId);
    
    // CRITICAL: Use EXACT same format as in callbacks
    const username = `player${user.user_id}`;
    const password = `pwd${user.user_id}${process.env.SEAMLESS_PASSWORD_SALT}`;
    
    console.log('GAME LAUNCH - Username:', username);
    console.log('GAME LAUNCH - Password format:', password.substring(0, 10) + '...');
    
    // CRITICAL: Always check/create player with EXACT credentials
    const playerRequest = {
      api_login: process.env.SEAMLESS_API_LOGIN,
      api_password: process.env.SEAMLESS_API_PASSWORD,
      method: 'playerExists',
      user_username: username,
      currency: 'EUR'
    };
    
    let playerResponse = await axios.post(process.env.SEAMLESS_API_URL, playerRequest);
    
    // If player doesn't exist, create with EXACT credentials
    if (playerResponse.data.error !== 0 || !playerResponse.data.response) {
      console.log('Creating player with exact credentials...');
      
      const createRequest = {
        api_login: process.env.SEAMLESS_API_LOGIN,
        api_password: process.env.SEAMLESS_API_PASSWORD,
        method: 'createPlayer',
        user_username: username,
        user_password: password,
        user_nickname: user.user_name.substring(0, 16) || `user${user.user_id}`,
        currency: 'EUR'
      };
      
      const createResponse = await axios.post(process.env.SEAMLESS_API_URL, createRequest);
      if (createResponse.data.error !== 0 && !createResponse.data.message.includes('already exists')) {
        throw new Error(`Create player failed: ${createResponse.data.message}`);
      }
    }
    
    // CRITICAL: Ensure third-party wallet exists and has balance
    let walletResult = await thirdPartyWalletService.getBalance(userId);
    
    if (!walletResult.success) {
      console.log('Creating third-party wallet...');
      await thirdPartyWalletService.createWallet(userId);
    }
    
    // Transfer from main wallet if third-party wallet is empty
    walletResult = await thirdPartyWalletService.getBalance(userId);
    if (!walletResult.success || walletResult.balance <= 0) {
      console.log('Transferring to third-party wallet...');
      const transferResult = await thirdPartyWalletService.transferToThirdPartyWallet(userId);
      console.log('Transfer result:', transferResult);
    }
    
    // Now launch game with exact credentials
    const gameRequest = {
      api_login: process.env.SEAMLESS_API_LOGIN,
      api_password: process.env.SEAMLESS_API_PASSWORD,
      method: 'getGame',
      lang: language,
      user_username: username,
      user_password: password, // EXACT same password
      gameid: gameId,
      homeurl: process.env.FRONTEND_URL || 'http://localhost:3000',
      cashierurl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/wallet`,
      play_for_fun: 0,
      currency: 'EUR'
    };
    
    console.log('Game launch request:', {
      ...gameRequest,
      api_password: '***',
      user_password: '***'
    });
    
    const gameResponse = await axios.post(process.env.SEAMLESS_API_URL, gameRequest);
    
    console.log('Game launch response:', gameResponse.data);
    
    if (gameResponse.data.error !== 0) {
      throw new Error(`Game launch failed: ${gameResponse.data.message} (code: ${gameResponse.data.error})`);
    }
    
    // Store session with exact remote_id format
    await SeamlessGameSession.create({
      user_id: userId,
      remote_id: username, // CRITICAL: This must match callback remote_id
      provider: gameId.split('_')[0] || 'unknown',
      session_token: gameResponse.data.sessionid,
      game_id: gameId.split('_')[1] || gameId,
      game_id_hash: gameId,
      is_active: true,
      game_type: gameId.split('_')[0] || 'unknown',
      session_id: gameResponse.data.sessionid,
      game_url: gameResponse.data.url || gameResponse.data.response
    });
    
    return {
      success: true,
      gameUrl: gameResponse.data.url || gameResponse.data.response,
      sessionId: gameResponse.data.sessionid,
      gameSessionId: gameResponse.data.gamesession_id
    };
  } catch (error) {
    console.error('getGameUrl ERROR:', error);
    return {
      success: false,
      message: error.message
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
// 2. DOCS COMPLIANCE: Balance request handling
const processBalanceRequest = async (queryParams) => {
  const t = await sequelize.transaction();
  
  try {
    const { remote_id, session_id, game_id, currency } = queryParams;
    
    console.log('=== BALANCE REQUEST ===');
    console.log('remote_id:', remote_id);
    console.log('session_id:', session_id);
    
    if (!remote_id) {
      await t.rollback();
      return {
        status: '500',
        msg: 'Missing remote_id'
      };
    }
    
    // Extract user ID from remote_id: player123 -> 123
    const userIdMatch = remote_id.match(/player(\d+)/);
    if (!userIdMatch) {
      await t.rollback();
      return {
        status: '500',
        msg: 'Invalid remote_id format'
      };
    }
    
    const userId = parseInt(userIdMatch[1]);
    console.log('Extracted userId:', userId);
    
    const user = await User.findByPk(userId, { transaction: t });
    if (!user) {
      await t.rollback();
      return {
        status: '500',
        msg: 'User not found'
      };
    }
    
    // CRITICAL: Just get balance, don't create wallet here
    const walletResult = await thirdPartyWalletService.getBalance(userId);
    const balance = walletResult.success ? walletResult.balance : 0;
    
    console.log('User balance:', balance);
    
    // Record balance request
    await SeamlessTransaction.create({
      transaction_id: `bal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      remote_id,
      provider_transaction_id: `balance_${Date.now()}`,
      provider: 'seamless',
      game_id: game_id || null,
      type: 'balance',
      amount: 0,
      session_id: session_id || null,
      wallet_balance_before: balance,
      wallet_balance_after: balance
    }, { transaction: t });
    
    await t.commit();
    
    return {
      status: '200',
      balance: parseFloat(balance).toFixed(2)
    };
  } catch (error) {
    await t.rollback();
    console.error('Balance request error:', error);
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
// 3. DOCS COMPLIANCE: Debit request handling  
const processDebitRequest = async (queryParams) => {
  const t = await sequelize.transaction();
  
  try {
    const {
      remote_id,
      amount,
      transaction_id,
      session_id,
      provider,
      game_id,
      game_id_hash,
      round_id,
      gameplay_final,
      is_freeround_bet,
      jackpot_contribution_in_amount
    } = queryParams;
    
    console.log('=== DEBIT REQUEST (DOCS COMPLIANT) ===');
    
    // DOCS REQUIREMENT: Check for duplicate transaction_id
    const existingTransaction = await SeamlessTransaction.findOne({
      where: { provider_transaction_id: transaction_id, type: 'debit' },
      transaction: t
    });
    
    if (existingTransaction) {
      // DOCS COMPLIANCE: Return same response as original transaction
      await t.rollback();
      return {
        status: '200',
        balance: parseFloat(existingTransaction.wallet_balance_after).toFixed(2),
        transactionId: existingTransaction.transaction_id
      };
    }
    
    // Find user by remote_id
    const userIdMatch = remote_id.match(/player(\d+)/);
    if (!userIdMatch) {
      await t.rollback();
      return {
        status: '500',
        msg: 'Invalid remote_id'
      };
    }
    
    const userId = parseInt(userIdMatch[1]);
    const user = await User.findByPk(userId, { transaction: t });
    
    if (!user) {
      await t.rollback();
      return {
        status: '500',
        msg: 'User not found'
      };
    }
    
    const betAmount = parseFloat(amount);
    
    // DOCS COMPLIANCE: Update wallet balance (debit = subtract amount)
    const walletResult = await thirdPartyWalletService.updateBalance(userId, -betAmount);
    
    if (!walletResult.success) {
      await t.rollback();
      
      // DOCS COMPLIANCE: Return 403 for insufficient funds
      if (walletResult.message === 'Insufficient funds') {
        return {
          status: '403',
          balance: parseFloat(walletResult.currentBalance || 0).toFixed(2),
          msg: 'Insufficient funds'
        };
      }
      
      return {
        status: '500',
        msg: 'Failed to update wallet'
      };
    }
    
    // Record transaction
    const transactionRecord = await SeamlessTransaction.create({
      transaction_id: `deb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
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
      is_freeround_bet: is_freeround_bet === '1' || is_freeround_bet === 'true',
      jackpot_contribution_in_amount: parseFloat(jackpot_contribution_in_amount || 0),
      gameplay_final: gameplay_final === '1' || gameplay_final === 'true'
    }, { transaction: t });
    
    await t.commit();
    
    // DOCS COMPLIANCE: Response format
    return {
      status: '200',
      balance: walletResult.newBalance.toFixed(2),
      transactionId: transactionRecord.transaction_id
    };
  } catch (error) {
    await t.rollback();
    console.error('Debit request error:', error);
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
// 4. DOCS COMPLIANCE: Credit request handling
const processCreditRequest = async (queryParams) => {
  const t = await sequelize.transaction();
  
  try {
    const {
      remote_id,
      amount,
      transaction_id,
      session_id,
      provider,
      game_id,
      game_id_hash,
      round_id,
      gameplay_final,
      is_freeround_win,
      is_jackpot_win
    } = queryParams;
    
    console.log('=== CREDIT REQUEST (DOCS COMPLIANT) ===');
    
    // Check for duplicate transaction
    const existingTransaction = await SeamlessTransaction.findOne({
      where: { provider_transaction_id: transaction_id, type: 'credit' },
      transaction: t
    });
    
    if (existingTransaction) {
      await t.rollback();
      return {
        status: '200',
        balance: parseFloat(existingTransaction.wallet_balance_after).toFixed(2),
        transactionId: existingTransaction.transaction_id
      };
    }
    
    // Find user
    const userIdMatch = remote_id.match(/player(\d+)/);
    if (!userIdMatch) {
      await t.rollback();
      return {
        status: '500',
        msg: 'Invalid remote_id'
      };
    }
    
    const userId = parseInt(userIdMatch[1]);
    const user = await User.findByPk(userId, { transaction: t });
    
    if (!user) {
      await t.rollback();
      return {
        status: '500',
        msg: 'User not found'
      };
    }
    
    const winAmount = parseFloat(amount);
    
    // DOCS COMPLIANCE: Update wallet balance (credit = add amount)
    const walletResult = await thirdPartyWalletService.updateBalance(userId, winAmount);
    
    if (!walletResult.success) {
      await t.rollback();
      return {
        status: '500',
        msg: 'Failed to update wallet'
      };
    }
    
    // Record transaction
    const transactionRecord = await SeamlessTransaction.create({
      transaction_id: `crd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
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
      is_freeround_win: is_freeround_win === '1' || is_freeround_win === 'true',
      is_jackpot_win: is_jackpot_win === '1' || is_jackpot_win === 'true',
      gameplay_final: gameplay_final === '1' || gameplay_final === 'true'
    }, { transaction: t });
    
    await t.commit();
    
    return {
      status: '200',
      balance: walletResult.newBalance.toFixed(2),
      transactionId: transactionRecord.transaction_id
    };
  } catch (error) {
    await t.rollback();
    console.error('Credit request error:', error);
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
    const {
      remote_id,
      transaction_id,
      session_id,
      provider,
      amount // DOCS NOTE: Use amount from original transaction, not from request
    } = queryParams;
    
    console.log('=== ROLLBACK REQUEST (DOCS COMPLIANT) ===');
    
    // Check for duplicate rollback
    const existingRollback = await SeamlessTransaction.findOne({
      where: { 
        related_transaction_id: transaction_id, 
        type: 'rollback'
      },
      transaction: t
    });
    
    if (existingRollback) {
      await t.rollback();
      return {
        status: '200',
        balance: parseFloat(existingRollback.wallet_balance_after).toFixed(2),
        transactionId: existingRollback.transaction_id
      };
    }
    
    // DOCS COMPLIANCE: Find original transaction by transaction_id
    const originalTransaction = await SeamlessTransaction.findOne({
      where: { provider_transaction_id: transaction_id },
      transaction: t
    });
    
    if (!originalTransaction) {
      await t.rollback();
      // DOCS COMPLIANCE: Return 404 if transaction not found
      return {
        status: '404',
        msg: 'TRANSACTION_NOT_FOUND'
      };
    }
    
    if (originalTransaction.status === 'rolledback') {
      await t.rollback();
      return {
        status: '200',
        balance: parseFloat(originalTransaction.wallet_balance_before).toFixed(2),
        msg: 'Transaction already rolled back'
      };
    }
    
    const user = await User.findByPk(originalTransaction.user_id, { transaction: t });
    if (!user) {
      await t.rollback();
      return {
        status: '500',
        msg: 'User not found'
      };
    }
    
    // DOCS COMPLIANCE: Use amount from original transaction, not from request
    const rollbackAmount = parseFloat(originalTransaction.amount);
    let walletResult;
    
    // If original was debit (bet), add money back
    if (originalTransaction.type === 'debit') {
      walletResult = await thirdPartyWalletService.updateBalance(
        user.user_id, 
        rollbackAmount
      );
    } 
    // If original was credit (win), subtract money
    else if (originalTransaction.type === 'credit') {
      walletResult = await thirdPartyWalletService.updateBalance(
        user.user_id, 
        -rollbackAmount
      );
      
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
        msg: 'Failed to process rollback'
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
      transaction_id: `rbk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: user.user_id,
      remote_id,
      provider_transaction_id: rollbackTransactionId,
      provider: provider || 'unknown',
      game_id: originalTransaction.game_id,
      game_id_hash: originalTransaction.game_id_hash,
      round_id: originalTransaction.round_id,
      type: 'rollback',
      amount: rollbackAmount,
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
    console.error('Rollback request error:', error);
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