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
    
    const requestData = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'getGameList',
      show_systems: 0,
      show_additional: true,
      currency: currency
    };

    const response = await axios.post(seamlessConfig.api_url.production, requestData);

    if (response.data.error !== 0) {
      throw new Error(`Error getting game list: ${response.data.message || 'Unknown error'}`);
    }

    let filteredGames = response.data.response;
    
    // Apply filters if provided
    if (filters && Object.keys(filters).length > 0) {
      if (filters.category) {
        filteredGames = filteredGames.filter(game => 
          game.type === filters.category || game.category === filters.category
        );
      }
      
      if (filters.provider) {
        filteredGames = filteredGames.filter(game => 
          game.system?.toLowerCase() === filters.provider.toLowerCase() ||
          game.subcategory?.toLowerCase().includes(filters.provider.toLowerCase())
        );
      }
      
      if (filters.mobile === true) {
        filteredGames = filteredGames.filter(game => game.mobile === true);
      }
      
      if (filters.jackpot === true) {
        filteredGames = filteredGames.filter(game => game.has_jackpot === true);
      }
      
      if (filters.freerounds === true) {
        filteredGames = filteredGames.filter(game => game.freerounds_supported === true);
      }
    }

    // Apply pagination
    const page = parseInt(filters.page) || 1;
    const limit = parseInt(filters.limit) || 50;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedGames = filteredGames.slice(startIndex, endIndex);

    console.log('=== END GET GAME LIST SERVICE ===');

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
    console.error('❌ Error in getGameList:', error);
    return { success: false, message: error.message || 'Failed to get game list' };
  }
};

const closeGameSession = async () => {
  return { success: false, message: 'Close session not implemented yet' };
};

/**
 * CRITICAL FIX: Helper function to find user by remote_id
 */
/**
 * CRITICAL FIX: Helper function to find user by remote_id
 * The provider sends remote_id as the ID returned from createPlayer response
 */
const findUserByRemoteId = async (remote_id, transaction = null) => {
  try {
    console.log('🔍 Finding user by remote_id:', remote_id);
    
    // Try to find by remote_id in the SeamlessGameSession table first
    const gameSession = await SeamlessGameSession.findOne({
      where: { remote_id: remote_id.toString() },
      order: [['created_at', 'DESC']], // Get the most recent session
      transaction
    });
    
    if (gameSession) {
      console.log('✅ Found user via game session:', gameSession.user_id);
      const user = await User.findByPk(gameSession.user_id, { transaction });
      if (user) return user;
    }
    
    // If not found in sessions, try direct numeric lookup
    // The remote_id might be the user_id directly
    if (/^\d+$/.test(remote_id)) {
      const userId = parseInt(remote_id);
      const user = await User.findByPk(userId, { transaction });
      if (user) {
        console.log('✅ Found user by direct ID lookup:', userId);
        return user;
      }
    }
    
    // Last resort: try to extract from player format
    const playerMatch = remote_id.match(/player(\d+)/);
    if (playerMatch) {
      const userId = parseInt(playerMatch[1]);
      const user = await User.findByPk(userId, { transaction });
      if (user) {
        console.log('✅ Found user by player format extraction:', userId);
        return user;
      }
    }
    
    throw new Error(`User not found for remote_id: ${remote_id}`);
  } catch (error) {
    console.error('❌ Error finding user by remote_id:', error);
    throw error;
  }
};

/**
 * Generate consistent player credentials
 * @param {Object} user - User object
 * @returns {Object} Player credentials
 */
/**
 * FIXED: Generate consistent player credentials that match what provider expects
 */
const generatePlayerCredentials = (user) => {
  return {
    username: `player${user.user_id}`,
    password: `pwd${user.user_id}${seamlessConfig.password_salt}`,
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

    const response = await axios.post(seamlessConfig.api_url.production, requestData);

    if (response.data.error !== 0) {
      return { success: true, exists: false };
    }

    return {
      success: true,
      exists: !!response.data.response,
      playerInfo: response.data.response,
      credentials: credentials
    };
  } catch (error) {
    console.error('❌ Error checking player exists:', error);
    return { success: false, message: error.message };
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
      return { success: false, message: 'User not found' };
    }

    const credentials = generatePlayerCredentials(user);
    
    const requestData = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'createPlayer',
      user_username: credentials.username,
      user_password: credentials.password,
      user_nickname: credentials.nickname,
      currency: seamlessConfig.default_currency
    };

    console.log('🎮 Creating player with credentials:', {
      username: credentials.username,
      nickname: credentials.nickname
    });

    const response = await axios.post(seamlessConfig.api_url.production, requestData);

    if (response.data.error !== 0) {
      if (response.data.message?.includes('Player already exists')) {
        // Player exists, get the existing player info
        const existsResult = await playerExists(userId);
        if (existsResult.success && existsResult.exists) {
          return {
            success: true,
            playerInfo: existsResult.playerInfo,
            remoteId: existsResult.playerInfo.id
          };
        }
      }
      throw new Error(`Create player error: ${response.data.message}`);
    }

    // CRITICAL: Store the remote_id returned by the provider
    const remoteId = response.data.response.id;
    console.log('✅ Player created successfully, remote_id:', remoteId);

    return {
      success: true,
      playerInfo: response.data.response,
      remoteId: remoteId
    };
  } catch (error) {
    console.error('❌ Create player error:', error);
    return { success: false, message: error.message };
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
    console.log('🎮 Getting game URL for user:', userId, 'game:', gameId);

    const user = await User.findByPk(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // ENHANCED: Provider-specific debugging
    // FIXED: Better provider detection logic
    let provider = 'BombayLive'; // Default provider - CHANGED TO BOMBAY LIVE (FULL NAME)
    
    if (gameId.includes('_')) {
      // Game ID has underscore format (e.g., "pf_game123")
      provider = gameId.split('_')[0];
    } else {
      // Game ID is numeric, need to determine provider from game list
      console.log('🎮 Numeric game ID detected, looking up provider...');
      try {
        const gameListResponse = await axios.post(seamlessConfig.api_url.production, {
          api_login: seamlessConfig.api_login,
          api_password: seamlessConfig.api_password,
          method: 'getGameList',
          show_systems: 0,
          show_additional: true,
          currency: seamlessConfig.default_currency
        });
        
        if (gameListResponse.data.error === 0 && gameListResponse.data.response) {
          const game = gameListResponse.data.response.find(g => g.id === gameId || g.game_id === gameId);
          if (game) {
            let rawProvider = game.system || game.subcategory || 'BombayLive'; // Default to BombayLive
            console.log('🎮 Raw provider from game list:', rawProvider);
            
            // FIXED: Provider mapping to handle mismatches
            const providerMapping = {
              'ol': 'BombayLive',  // 'ol' maps to 'BombayLive'
              'bl': 'BombayLive',  // 'bl' maps to 'BombayLive'
              'es': 'es',  // 'es' maps to 'es' (Evolution)
              'pf': 'pf',  // 'pf' maps to 'pf' (Play'n GO)
              'ss': 'ss',  // 'ss' maps to 'ss' (Spadegaming)
              'ep': 'ep',  // 'ep' maps to 'ep' (EvoPlay)
              'ag': 'ag',  // 'ag' maps to 'ag' (Asia Gaming)
              'pg': 'pg',  // 'pg' maps to 'pg' (Pragmatic Play)
              'ev': 'ev',  // 'ev' maps to 'ev' (Evolution)
              'bp': 'bp',  // 'bp' maps to 'bp' (Blueprint)
              'bs': 'bs',  // 'bs' maps to 'bs' (Betsoft)
              'g24': 'g24', // 'g24' maps to 'g24' (G24)
              'vg': 'vg',  // 'vg' maps to 'vg' (Vivo Gaming)
              'ez': 'ez',  // 'ez' maps to 'ez' (Ezugi)
              'dt': 'dt',  // 'dt' maps to 'dt' (Digitain)
              'ds': 'ds'   // 'ds' maps to 'ds' (Delasport)
            };
            
            provider = providerMapping[rawProvider.toLowerCase()] || 'BombayLive'; // Default to BombayLive for unknown providers
            console.log('🎮 Mapped provider:', rawProvider, '→', provider);
          } else {
            console.log('🎮 Game not found in list, using BombayLive as default provider');
            provider = 'BombayLive'; // Default to BombayLive
          }
        }
      } catch (error) {
        console.log('🎮 Error looking up game provider, using BombayLive as default:', error.message);
        provider = 'BombayLive'; // Default to BombayLive
      }
    }
    
    console.log('🎮 Provider detected:', provider, 'for game ID:', gameId);
    
    if (provider === 'pf') {
      console.log('🎮 === PLAY\'N GO GAME DETECTED ===');
      console.log('🎮 Enhanced debugging enabled for Play\'n GO');
    }
    
    if (provider === 'BombayLive') {
      console.log('🎮 === BOMBAY LIVE GAME DETECTED ===');
      console.log('🎮 Enhanced debugging enabled for Bombay Live');
    }

    // 1. Ensure player exists at provider
    let playerInfo;
    const existsResult = await playerExists(userId);
    
    if (!existsResult.success) {
      console.error('❌ Failed to check player existence:', existsResult.message);
      return { success: false, message: 'Failed to check player existence' };
    }

    if (!existsResult.exists) {
      console.log('🎮 Player does not exist, creating...');
      const createResult = await createPlayer(userId);
      if (!createResult.success) {
        console.error('❌ Failed to create player:', createResult.message);
        return { success: false, message: 'Failed to create player' };
      }
      playerInfo = createResult.playerInfo;
    } else {
      playerInfo = existsResult.playerInfo;
    }

    console.log('🎮 Player info:', playerInfo);

    // ENHANCED: Validate player info for Play'n GO
    if (provider === 'pf') {
      if (!playerInfo || !playerInfo.id) {
        console.error('❌ Invalid player info for Play\'n GO:', playerInfo);
        return { success: false, message: 'Invalid player information for Play\'n GO' };
      }
      console.log('✅ Play\'n GO player validation passed');
    }

    // 2. Ensure third-party wallet exists and has balance
    const walletResult = await thirdPartyWalletService.getBalance(userId);
    if (!walletResult.success || walletResult.balance <= 0) {
      console.log('💰 No balance in third-party wallet. User needs to transfer funds manually.');
      // REMOVED: Automatic transfer to prevent unwanted transfers
      // Users should manually transfer funds when they want to play
    }

    // 3. Get game URL using exact credentials
    const credentials = generatePlayerCredentials(user);
    const gameRequest = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'getGame',
      lang: language,
      user_username: credentials.username,
      user_password: credentials.password,
      gameid: gameId,
      homeurl: seamlessConfig.home_url,
      cashierurl: seamlessConfig.cashier_url,
      play_for_fun: 0,
      currency: seamlessConfig.default_currency
    };

    // ENHANCED: Provider-specific request modifications
    if (provider === 'pf') {
      console.log('🎮 === PLAY\'N GO GAME REQUEST ===');
      console.log('🎮 Request data:', JSON.stringify(gameRequest, null, 2));
      
      // Add Play'n GO specific parameters if needed
      gameRequest.provider = 'pf';
      gameRequest.currency = 'EUR'; // Ensure EUR for Play'n GO
    }

    console.log('🎮 Requesting game URL with:', {
      username: credentials.username,
      gameid: gameId,
      provider: provider
    });

    const gameResponse = await axios.post(seamlessConfig.api_url.production, gameRequest);
    
    console.log('🎮 Game response:', {
      error: gameResponse.data.error,
      message: gameResponse.data.message,
      hasUrl: !!(gameResponse.data.url || gameResponse.data.response),
      provider: provider
    });

    // ENHANCED: Detailed error analysis for Play'n GO
    if (gameResponse.data.error !== 0) {
      console.error('❌ Game launch failed for provider:', provider);
      console.error('❌ Error details:', gameResponse.data);
      
      if (provider === 'pf') {
        console.error('🎮 === PLAY\'N GO ERROR ANALYSIS ===');
        console.error('🎮 This might be a signup/registration issue');
        console.error('🎮 Check if player exists properly at Play\'n GO');
        console.error('🎮 Verify player credentials and currency settings');
      }
      
      return {
        success: false,
        message: `Game launch failed: ${gameResponse.data.message} (${gameResponse.data.error})`
      };
    }

    // ENHANCED: Validate game response for Play'n GO
    if (provider === 'pf') {
      if (!gameResponse.data.url && !gameResponse.data.response) {
        console.error('❌ Play\'n GO returned no game URL');
        return { success: false, message: 'No game URL returned from Play\'n GO' };
      }
      
      if (!gameResponse.data.sessionid) {
        console.error('❌ Play\'n GO returned no session ID');
        return { success: false, message: 'No session ID returned from Play\'n GO' };
      }
      
      console.log('✅ Play\'n GO game response validation passed');
    }

    // 4. CRITICAL: Store session with the correct remote_id format
    const remoteId = playerInfo.id || credentials.username; // Use provider's ID
    
    // FIXED: Better game ID extraction
    let gameIdExtracted = gameId;
    if (gameId.includes('_')) {
      gameIdExtracted = gameId.split('_')[1] || gameId;
    }
    
    await SeamlessGameSession.create({
      user_id: userId,
      remote_id: remoteId.toString(), // CRITICAL: Store as string
      provider: provider,
      session_token: gameResponse.data.sessionid,
      game_id: gameIdExtracted,
      game_id_hash: gameId,
      game_url: gameResponse.data.url || gameResponse.data.response,
      game_type: provider,
      session_id: gameResponse.data.sessionid,
      game_session_id: gameResponse.data.gamesession_id,
      is_active: true,
      ip_address: '127.0.0.1' // Will be updated by middleware
    });

    console.log('✅ Game session created with remote_id:', remoteId);

    // ENHANCED: Success logging for Play'n GO
    if (provider === 'pf') {
      console.log('🎮 === PLAY\'N GO LAUNCH SUCCESS ===');
      console.log('🎮 Game URL:', gameResponse.data.url || gameResponse.data.response);
      console.log('🎮 Session ID:', gameResponse.data.sessionid);
      console.log('🎮 If user still gets signup error, check:');
      console.log('🎮 1. Browser console for JavaScript errors');
      console.log('🎮 2. Game provider\'s player registration status');
      console.log('🎮 3. Geographic restrictions or licensing issues');
    }

    return {
      success: true,
      gameUrl: gameResponse.data.url || gameResponse.data.response,
      sessionId: gameResponse.data.sessionid,
      gameSessionId: gameResponse.data.gamesession_id
    };
  } catch (error) {
    console.error('❌ Error getting game URL:', error);
    return { success: false, message: error.message };
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
    
    console.log('💰 === BALANCE REQUEST ===');
    console.log('💰 remote_id:', remote_id);
    console.log('💰 session_id:', session_id);
    
    if (!remote_id) {
      await t.rollback();
      return { status: '500', msg: 'Missing remote_id' };
    }
    
    // CRITICAL FIX: Use the new findUserByRemoteId function
    const user = await findUserByRemoteId(remote_id, t);
    
    // Get balance from third-party wallet
    const walletResult = await thirdPartyWalletService.getBalance(user.user_id);
    const balance = walletResult.success ? walletResult.balance : 0;
    
    console.log('💰 User balance:', balance);
    
    // Record balance request
    await SeamlessTransaction.create({
      transaction_id: `bal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: user.user_id,
      remote_id: remote_id.toString(),
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
    console.error('❌ Balance request error:', error);
    return { status: '500', msg: error.message };
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
    
    console.log('💸 === DEBIT REQUEST ===');
    console.log('💸 remote_id:', remote_id);
    console.log('💸 amount:', amount);
    console.log('💸 transaction_id:', transaction_id);
    
    const betAmount = parseFloat(amount);
    if (betAmount < 0) {
      await t.rollback();
      return {
        status: '400',
        msg: 'Invalid debit amount. Amount cannot be negative.'
      };
    }
    
    // CRITICAL FIX: Use the new findUserByRemoteId function
    const user = await findUserByRemoteId(remote_id, t);

    // Check for duplicate transaction
    const existingTransaction = await SeamlessTransaction.findOne({
      where: { provider_transaction_id: transaction_id, user_id: user.user_id, type: 'debit' },
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
    
    // Update wallet balance (debit = subtract amount)
    const walletResult = await thirdPartyWalletService.updateBalance(user.user_id, -betAmount);
    
    if (!walletResult.success) {
      await t.rollback();
      
      if (walletResult.message === 'Insufficient funds') {
        return {
          status: '403',
          balance: parseFloat(walletResult.currentBalance || 0).toFixed(2),
          msg: 'Insufficient funds'
        };
      }
      
      return { status: '500', msg: 'Failed to update wallet' };
    }

    // Update total_bet_amount
    await User.increment('total_bet_amount', {
      by: betAmount,
      where: { user_id: user.user_id },
      transaction: t
    });
    
    // Record transaction
    const transactionRecord = await SeamlessTransaction.create({
      transaction_id: `deb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: user.user_id,
      remote_id: remote_id.toString(),
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
    
    return {
      status: '200',
      balance: walletResult.newBalance.toFixed(2),
      transactionId: transactionRecord.transaction_id
    };
  } catch (error) {
    await t.rollback();
    console.error('❌ Debit request error:', error);
    return { status: '500', msg: error.message };
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
    
    console.log('💰 === CREDIT REQUEST ===');
    console.log('💰 remote_id:', remote_id);
    console.log('💰 amount:', amount);
    console.log('💰 transaction_id:', transaction_id);
    
    const winAmount = parseFloat(amount);
    if (winAmount < 0) {
      await t.rollback();
      return {
        status: '400',
        msg: 'Invalid credit amount. Amount cannot be negative.'
      };
    }
    
    // CRITICAL FIX: Use the new findUserByRemoteId function
    const user = await findUserByRemoteId(remote_id, t);

    // Check for duplicate transaction
    const existingTransaction = await SeamlessTransaction.findOne({
      where: { provider_transaction_id: transaction_id, user_id: user.user_id, type: 'credit' },
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
    
    // Update wallet balance (credit = add amount)
    const walletResult = await thirdPartyWalletService.updateBalance(user.user_id, winAmount);
    
    if (!walletResult.success) {
      await t.rollback();
      return { status: '500', msg: 'Failed to update wallet' };
    }
    
    // Record transaction
    const transactionRecord = await SeamlessTransaction.create({
      transaction_id: `crd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: user.user_id,
      remote_id: remote_id.toString(),
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
    console.error('❌ Credit request error:', error);
    return { status: '500', msg: error.message };
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
    const { remote_id, transaction_id, session_id, provider } = queryParams;
    
    console.log('🔄 === ROLLBACK REQUEST ===');
    console.log('🔄 remote_id:', remote_id);
    console.log('🔄 transaction_id:', transaction_id);
    
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
    
    // Find original transaction by provider_transaction_id
    const originalTransaction = await SeamlessTransaction.findOne({
      where: { provider_transaction_id: transaction_id },
      transaction: t
    });
    
    if (!originalTransaction) {
      await t.rollback();
      return { status: '404', msg: 'TRANSACTION_NOT_FOUND' };
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
      return { status: '500', msg: 'User not found' };
    }
    
    // Use amount from original transaction
    const rollbackAmount = parseFloat(originalTransaction.amount);
    let walletResult;
    
    // If original was debit (bet), add money back
    if (originalTransaction.type === 'debit') {
      walletResult = await thirdPartyWalletService.updateBalance(user.user_id, rollbackAmount);
    } 
    // If original was credit (win), subtract money
    else if (originalTransaction.type === 'credit') {
      walletResult = await thirdPartyWalletService.updateBalance(user.user_id, -rollbackAmount);
      
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
      return { status: '500', msg: 'Failed to process rollback' };
    }
    
    // Mark original transaction as rolled back
    await originalTransaction.update({
      status: 'rolledback',
      updated_at: new Date()
    }, { transaction: t });
    
    // Record rollback transaction
    const transactionRecord = await SeamlessTransaction.create({
      transaction_id: `rbk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      user_id: user.user_id,
      remote_id: remote_id.toString(),
      provider_transaction_id: `rollback_${transaction_id}_${Date.now()}`,
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
    console.error('❌ Rollback request error:', error);
    return { status: '500', msg: error.message };
  }
};

/**
 * Close an active game session and transfer balance back to main wallet
 * @param {string} sessionToken - Session token
 * @returns {Promise<Object>} Result
 */
const closeGameSessionWithToken = async (sessionToken) => {
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
            if (sessionAge > 5 * 60 * 60 * 1000) {
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
  closeGameSessionWithToken,
  cleanupExpiredSessions,
  addFreeRounds,
  removeFreeRounds,
  validateGameSession,
  generatePlayerCredentials,
  findUserByRemoteId,
};
