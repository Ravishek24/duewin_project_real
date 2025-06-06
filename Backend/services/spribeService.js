// services/spribeService.js - COMPLETE SERVICE WITH BOTH MODELS
const axios = require('axios');
const { generateSpribeHeaders } = require('../utils/spribeSignatureUtils');
const spribeConfig = require('../config/spribeConfig');
const { 
  generateGameLaunchUrl, 
  generateSecurityHeaders, 
  formatAmount, 
  parseAmount,
  getUserCurrency
} = require('../utils/spribeUtils');
const { sequelize } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

// Import models - these will be loaded after models are initialized
let User, SpribeGameSession, SpribeTransaction, Transaction;

// Initialize models when service is used
const initializeModels = async () => {
  if (!User) {
    try {
      const { getModels } = require('../models');
      const models = await getModels();
      
      User = models.User;
      SpribeGameSession = models.SpribeGameSession;
      SpribeTransaction = models.SpribeTransaction;
      Transaction = models.Transaction;
      
      if (!User || !SpribeGameSession || !SpribeTransaction) {
        throw new Error('Required SPRIBE models not loaded');
      }
      
      // Verify database tables
      await verifyDatabaseTables();
      
      console.log('✅ SPRIBE service models initialized');
    } catch (error) {
      console.error('❌ Error initializing SPRIBE service models:', error);
      throw error;
    }
  }
};

/**
 * Verify that required database tables exist and have correct structure
 */
const verifyDatabaseTables = async () => {
  try {
    console.log('🔍 Verifying database tables...');
    
    // Check if spribe_game_sessions table exists
    const [results] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'spribe_game_sessions'
    `);
    
    if (results[0].count === 0) {
      console.error('❌ spribe_game_sessions table does not exist');
      throw new Error('Required database table spribe_game_sessions does not exist');
    }
    
    // Check if spribe_transactions table exists
    const [txResults] = await sequelize.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
      AND table_name = 'spribe_transactions'
    `);
    
    if (txResults[0].count === 0) {
      console.error('❌ spribe_transactions table does not exist');
      throw new Error('Required database table spribe_transactions does not exist');
    }
    
    console.log('✅ Database tables verified');
  } catch (error) {
    console.error('❌ Error verifying database tables:', error);
    throw error;
  }
};

// ======================= GAME SESSION MANAGEMENT =======================

/**
 * Create a new game session in SpribeGameSession model
 */
const createGameSession = async (userId, gameId, provider, launchToken, currency, ipAddress) => {
  try {
    console.log('🎮 Creating SPRIBE session with params:', {
      userId,
      gameId,
      provider,
      tokenLength: launchToken?.length,
      currency,
      ipAddress
    });

    await initializeModels();
    console.log('✅ Models initialized for session creation');

    // Validate required parameters
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!gameId) {
      throw new Error('Game ID is required');
    }
    if (!provider) {
      throw new Error('Provider is required');
    }
    if (!launchToken) {
      throw new Error('Launch token is required');
    }
    if (!currency) {
      throw new Error('Currency is required');
    }

    const t = await sequelize.transaction();
    console.log('✅ Transaction started');
    
    try {
      console.log(`🎮 Creating SPRIBE session: User ${userId}, Game ${gameId}`);
      
      // Create new SPRIBE game session
      const session = await SpribeGameSession.create({
        user_id: userId,
        game_id: gameId,
        provider: provider,
        launch_token: launchToken,
        currency: currency,
        platform: 'desktop', // Will be updated in auth
        ip_address: ipAddress,
        status: 'active',
        started_at: new Date()
      }, { transaction: t });
      
      await t.commit();
      console.log(`✅ SPRIBE session created: ID ${session.id}`);
      
      return {
        success: true,
        session: session
      };
    } catch (error) {
      await t.rollback();
      console.error('❌ Error creating SPRIBE game session:', error);
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error.code,
        errno: error.errno,
        sqlState: error.sqlState,
        sqlMessage: error.sqlMessage
      });
      
      // Check for specific database errors
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => ({
          field: err.path,
          message: err.message,
          value: err.value
        }));
        console.error('Validation errors:', validationErrors);
        return {
          success: false,
          message: `Validation error: ${validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')}`
        };
      }
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        console.error('Unique constraint violation:', error.errors);
        return {
          success: false,
          message: 'A session with this token already exists'
        };
      }
      
      if (error.name === 'SequelizeForeignKeyConstraintError') {
        console.error('Foreign key constraint violation:', error);
        return {
          success: false,
          message: 'Invalid user ID or game ID'
        };
      }
      
      return {
        success: false,
        message: `Failed to create game session: ${error.message}`
      };
    }
  } catch (error) {
    console.error('❌ Critical error in createGameSession:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    return {
      success: false,
      message: `Failed to create game session: ${error.message}`
    };
  }
};

/**
 * Update game session with session token from SPRIBE
 */
const updateGameSession = async (launchToken, sessionToken, platform) => {
  await initializeModels();
  const t = await sequelize.transaction();
  
  try {
    console.log(`🔄 Updating SPRIBE session: Token ${launchToken.substring(0, 8)}...`);
    
    // Find session by launch token
    const session = await SpribeGameSession.findOne({
      where: { 
        launch_token: launchToken,
        status: 'active'
      },
      transaction: t
    });
    
    if (!session) {
      await t.rollback();
      return {
        success: false,
        message: 'Session not found or expired'
      };
    }
    
    // Update session with SPRIBE session token
    await session.update({
      session_token: sessionToken,
      platform: platform
    }, { transaction: t });
    
    await t.commit();
    
    console.log(`✅ SPRIBE session updated: ID ${session.id}`);
    
    return {
      success: true,
      session: session
    };
  } catch (error) {
    await t.rollback();
    console.error('❌ Error updating SPRIBE game session:', error);
    
    return {
      success: false,
      message: 'Failed to update game session'
    };
  }
};

/**
 * End a game session
 */
const endGameSession = async (sessionToken) => {
  await initializeModels();
  const t = await sequelize.transaction();
  
  try {
    const session = await SpribeGameSession.findOne({
      where: { 
        session_token: sessionToken,
        status: 'active'
      },
      transaction: t
    });
    
    if (!session) {
      await t.rollback();
      return {
        success: false,
        message: 'Active session not found'
      };
    }
    
    await session.update({
      status: 'ended',
      ended_at: new Date()
    }, { transaction: t });
    
    await t.commit();
    
    console.log(`✅ SPRIBE session ended: ID ${session.id}`);
    
    return {
      success: true,
      message: 'Session ended successfully'
    };
  } catch (error) {
    await t.rollback();
    console.error('❌ Error ending SPRIBE game session:', error);
    
    return {
      success: false,
      message: 'Failed to end game session'
    };
  }
};

// ======================= TRANSACTION MANAGEMENT =======================

/**
 * Find transaction by provider transaction ID in SpribeTransaction model
 */
const findTransactionByProviderTxId = async (providerTxId) => {
  await initializeModels();
  
  try {
    const transaction = await SpribeTransaction.findOne({
      where: { provider_tx_id: providerTxId },
      include: [
        {
          model: SpribeGameSession,
          as: 'session'
        }
      ]
    });
    
    if (!transaction) {
      return {
        success: false,
        message: 'Transaction not found'
      };
    }
    
    return {
      success: true,
      transaction: transaction
    };
  } catch (error) {
    console.error('❌ Error finding SPRIBE transaction:', error);
    
    return {
      success: false,
      message: 'Error finding transaction'
    };
  }
};

/**
 * Process a bet transaction in SpribeTransaction model
 */
const processBetTransaction = async (transactionData) => {
  await initializeModels();
  
  const {
    user_id,
    provider,
    game_id,
    provider_tx_id,
    amount,
    currency,
    action_id,
    platform,
    ip_address,
    old_balance,
    new_balance
  } = transactionData;
  
  const t = await sequelize.transaction();
  
  try {
    console.log(`💰 Processing SPRIBE bet: User ${user_id}, Amount ${amount} ${currency}`);
    
    // Find active session for this user and game
    const session = await SpribeGameSession.findOne({
      where: {
        user_id: user_id,
        game_id: game_id,
        status: 'active'
      },
      order: [['created_at', 'DESC']],
      transaction: t
    });
    
    if (!session) {
      await t.rollback();
      return {
        success: false,
        message: 'No active game session found'
      };
    }
    
    // Generate unique operator transaction ID
    const operatorTxId = `BET_${Date.now()}_${uuidv4().substring(0, 8)}`;
    
    // Create SPRIBE transaction record
    const spribeTransaction = await SpribeTransaction.create({
      user_id: user_id,
      session_id: session.id,
      type: 'bet',
      amount: Math.round(amount * 100), // Store in smallest currency units
      currency: currency,
      provider: provider,
      game_id: game_id,
      provider_tx_id: provider_tx_id,
      operator_tx_id: operatorTxId,
      action: 'bet',
      action_id: action_id,
      old_balance: Math.round(old_balance * 100),
      new_balance: Math.round(new_balance * 100),
      status: 'completed'
    }, { transaction: t });
    
    await t.commit();
    
    console.log(`✅ SPRIBE bet recorded: TX ${operatorTxId}`);
    
    return {
      success: true,
      operator_tx_id: operatorTxId,
      transaction: spribeTransaction
    };
  } catch (error) {
    await t.rollback();
    console.error('❌ Error processing SPRIBE bet transaction:', error);
    
    return {
      success: false,
      message: 'Failed to process bet transaction'
    };
  }
};

/**
 * Process a win transaction in SpribeTransaction model
 */
const processWinTransaction = async (transactionData) => {
  await initializeModels();
  
  const {
    user_id,
    provider,
    game_id,
    provider_tx_id,
    amount,
    currency,
    action_id,
    platform,
    ip_address,
    withdraw_provider_tx_id,
    old_balance,
    new_balance
  } = transactionData;
  
  const t = await sequelize.transaction();
  
  try {
    console.log(`🎉 Processing SPRIBE win: User ${user_id}, Amount ${amount} ${currency}`);
    
    // Find active session
    const session = await SpribeGameSession.findOne({
      where: {
        user_id: user_id,
        game_id: game_id,
        status: 'active'
      },
      order: [['created_at', 'DESC']],
      transaction: t
    });
    
    if (!session) {
      await t.rollback();
      return {
        success: false,
        message: 'No active game session found'
      };
    }
    
    // Generate unique operator transaction ID
    const operatorTxId = `WIN_${Date.now()}_${uuidv4().substring(0, 8)}`;
    
    // Create SPRIBE transaction record
    const spribeTransaction = await SpribeTransaction.create({
      user_id: user_id,
      session_id: session.id,
      type: 'win',
      amount: Math.round(amount * 100),
      currency: currency,
      provider: provider,
      game_id: game_id,
      provider_tx_id: provider_tx_id,
      operator_tx_id: operatorTxId,
      action: 'win',
      action_id: action_id,
      old_balance: Math.round(old_balance * 100),
      new_balance: Math.round(new_balance * 100),
      withdraw_provider_tx_id: withdraw_provider_tx_id,
      status: 'completed'
    }, { transaction: t });
    
    await t.commit();
    
    console.log(`✅ SPRIBE win recorded: TX ${operatorTxId}`);
    
    return {
      success: true,
      operator_tx_id: operatorTxId,
      transaction: spribeTransaction
    };
  } catch (error) {
    await t.rollback();
    console.error('❌ Error processing SPRIBE win transaction:', error);
    
    return {
      success: false,
      message: 'Failed to process win transaction'
    };
  }
};

/**
 * Process a rollback transaction in SpribeTransaction model
 */
const processRollbackTransaction = async (transactionData) => {
  await initializeModels();
  
  const {
    user_id,
    provider,
    game_id,
    provider_tx_id,
    rollback_provider_tx_id,
    amount,
    currency,
    action_id,
    platform,
    ip_address,
    old_balance,
    new_balance
  } = transactionData;
  
  const t = await sequelize.transaction();
  
  try {
    console.log(`🔄 Processing SPRIBE rollback: User ${user_id}, Amount ${amount} ${currency}`);
    
    // Find the original transaction being rolled back
    const originalTransaction = await SpribeTransaction.findOne({
      where: { 
        provider_tx_id: rollback_provider_tx_id 
      },
      transaction: t
    });
    
    if (!originalTransaction) {
      await t.rollback();
      return {
        success: false,
        message: 'Original transaction not found'
      };
    }
    
    // Mark original transaction as rolled back
    await originalTransaction.update({
      status: 'rolled_back'
    }, { transaction: t });
    
    // Generate unique operator transaction ID
    const operatorTxId = `RB_${Date.now()}_${uuidv4().substring(0, 8)}`;
    
    // Create rollback transaction record
    const spribeTransaction = await SpribeTransaction.create({
      user_id: user_id,
      session_id: originalTransaction.session_id,
      type: 'rollback',
      amount: Math.round(amount * 100),
      currency: currency,
      provider: provider,
      game_id: game_id,
      provider_tx_id: provider_tx_id,
      operator_tx_id: operatorTxId,
      action: 'rollback',
      action_id: action_id,
      old_balance: Math.round(old_balance * 100),
      new_balance: Math.round(new_balance * 100),
      status: 'completed'
    }, { transaction: t });
    
    await t.commit();
    
    console.log(`✅ SPRIBE rollback recorded: TX ${operatorTxId}`);
    
    return {
      success: true,
      operator_tx_id: operatorTxId,
      transaction: spribeTransaction
    };
  } catch (error) {
    await t.rollback();
    console.error('❌ Error processing SPRIBE rollback transaction:', error);
    
    return {
      success: false,
      message: 'Failed to process rollback transaction'
    };
  }
};

// ======================= MAIN SPRIBE API HANDLERS =======================

/**
 * Get game launch URL - RECORDS IN SpribeGameSession
 */
const getGameLaunchUrl = async (gameId, userId, req) => {
  try {
    console.log('🎮 Starting game launch process:', { gameId, userId });
    
    await initializeModels();
    console.log('✅ Models initialized');
    
    // Validate game ID against staging games
    if (!spribeConfig.availableGames.includes(gameId)) {
      console.error('❌ Invalid game ID:', { 
        gameId, 
        availableGames: spribeConfig.availableGames 
      });
      return {
        success: false,
        message: `Game ${gameId} is not available in staging environment. Available games: ${spribeConfig.availableGames.join(', ')}`
      };
    }
    
    // Get user information
    const user = await User.findByPk(userId);
    if (!user) {
      console.error('❌ User not found:', { userId });
      return {
        success: false,
        message: 'User not found'
      };
    }
    console.log('✅ User found:', { userId: user.user_id });
    
    // Get user's currency (USD for SPRIBE)
    const currency = 'USD';
    console.log('✅ Using currency:', { currency });
    
    // Check third-party wallet balance in EUR first
    const thirdPartyWalletService = require('./thirdPartyWalletService');
    console.log('🔄 Checking third-party wallet balance in EUR...');
    const walletResult = await thirdPartyWalletService.getBalance(userId, 'EUR');
    
    if (!walletResult.success) {
      console.error('❌ Failed to get third-party wallet balance:', walletResult.message);
      return {
        success: false,
        message: 'Failed to get wallet balance'
      };
    }
    
    // Convert EUR balance to USD (approximate rate 1 EUR = 1.08 USD)
    const eurBalance = walletResult.balance;
    const usdBalance = eurBalance * 1.08;
    
    console.log('✅ Third-party wallet balance:', {
      eur: eurBalance,
      usd: usdBalance
    });
    
    // Generate frontend return URL
    const returnUrl = `${process.env.FRONTEND_URL}/games`;
    const accountHistoryUrl = `${process.env.FRONTEND_URL}/account/history`;
    console.log('✅ Generated URLs:', { returnUrl, accountHistoryUrl });
    
    // Generate one-time token
    const token = generateOneTimeToken();
    console.log('✅ Generated token:', { token: token.substring(0, 8) + '...' });
    
    // Create game session
    console.log('🔄 Creating game session...');
    const sessionResult = await createGameSession(
      userId, 
      gameId, 
      spribeConfig.providers[gameId], 
      token, 
      currency,
      req.headers['x-forwarded-for'] || req.connection.remoteAddress
    );
    
    if (!sessionResult.success) {
      console.error('❌ Failed to create game session:', sessionResult.message);
      return {
        success: false,
        message: 'Failed to create game session'
      };
    }
    console.log('✅ Game session created:', { sessionId: sessionResult.session.id });
    
    // Generate launch URL
    console.log('🔄 Generating launch URL...');
    const launchUrl = generateGameLaunchUrl(gameId, user, {
      currency,
      token,
      returnUrl,
      accountHistoryUrl,
      ircDuration: 3600, // 1 hour reality check
    });
    console.log('✅ Launch URL generated');
    
    // Log session creation
    console.log(`✅ SPRIBE Session Created:`, {
      sessionId: sessionResult.session.id,
      userId,
      gameId,
      token: token.substring(0, 8) + '...',
      currency,
      balance: {
        eur: eurBalance,
        usd: usdBalance
      }
    });
    
    if (usdBalance <= 0) {
      return {
        success: true,
        url: launchUrl,
        sessionId: sessionResult.session.id,
        warningMessage: 'You have no funds available to play. Please deposit first.'
      };
    }
    
    return {
      success: true,
      url: launchUrl,
      sessionId: sessionResult.session.id
    };
  } catch (error) {
    console.error('❌ Error generating game launch URL:', error);
    console.error('Error stack:', error.stack);
    return {
      success: false,
      message: `Failed to generate game launch URL: ${error.message}`
    };
  }
};

/**
 * Handle authentication request from SPRIBE
 * @param {Object} data - Authentication request data
 * @returns {Object} - Authentication response
 */
const handleAuth = async (data) => {
  await initializeModels();
  
  try {
    console.log('🔐 Processing SPRIBE auth request:', {
      user_token: data.user_token,
      session_token: data.session_token,
      platform: data.platform,
      currency: data.currency
    });
    
    // Validate required fields
    if (!data.user_token || !data.session_token || !data.platform || !data.currency) {
      console.error('❌ Missing required fields in auth request');
      return {
        code: 400,
        message: 'Missing required fields'
      };
    }
    
    // Find user by token
    const user = await User.findOne({
      where: { spribe_token: data.user_token }
    });
    
    if (!user) {
      console.error('❌ User not found for token:', data.user_token);
      return {
        code: 401,
        message: 'User token is invalid'
      };
    }
    
    // Check if token is expired
    const tokenAge = Date.now() - new Date(user.spribe_token_created_at).getTime();
    if (tokenAge > spribeConfig.tokenExpirationTime) {
      console.error('❌ Token expired for user:', user.id);
      return {
        code: 403,
        message: 'User token is expired'
      };
    }
    
    // Get user's balance in EUR first
    const thirdPartyWalletService = require('./thirdPartyWalletService');
    console.log('🔄 Getting third-party wallet balance in EUR...');
    const walletResult = await thirdPartyWalletService.getBalance(user.id, 'EUR');
    
    if (!walletResult.success) {
      console.error('❌ Failed to get third-party wallet balance:', walletResult.message);
      return {
        code: 500,
        message: 'Failed to get wallet balance'
      };
    }
    
    // Convert EUR balance to USD (approximate rate 1 EUR = 1.08 USD)
    const eurBalance = walletResult.balance;
    const usdBalance = eurBalance * 1.08;
    
    console.log('✅ Third-party wallet balance:', {
      eur: eurBalance,
      usd: usdBalance
    });
    
    // Format balance according to SPRIBE requirements (1 USD = 1000 units)
    // Round to nearest integer to avoid floating point issues
    const spribeBalance = Math.round(usdBalance * 1000);
    
    console.log('✅ SPRIBE formatted balance:', {
      original: usdBalance,
      spribe_units: spribeBalance
    });
    
    // Return success response with data object
    return {
      code: 200,
      message: 'Success',
      data: {
        user_id: user.id.toString(),
        username: user.username,
        balance: spribeBalance, // Balance in SPRIBE units (1 USD = 1000 units)
        currency: 'USD' // Always USD for SPRIBE
      }
    };
  } catch (error) {
    console.error('❌ Error handling auth request:', error);
    return {
      code: 500,
      message: 'Internal server error'
    };
  }
};

/**
 * Handle player info request - QUERIES SpribeGameSession
 */
const handlePlayerInfo = async (infoData) => {
  const { user_id, session_token, currency } = infoData;
  
  try {
    await initializeModels();
    
    console.log(`ℹ️ SPRIBE Player Info: User ${user_id}, Currency ${currency}`);
    
    // Validate currency is supported
    if (!spribeConfig.supportedCurrencies.includes(currency)) {
      return {
        code: 400,
        message: `Currency ${currency} is not supported`
      };
    }
    
    // Get user from database
    const user = await User.findByPk(user_id);
    if (!user) {
      return {
        code: 401,
        message: 'User not found'
      };
    }
    
    // Get balance from third-party wallet in USD
    const thirdPartyWalletService = require('./thirdPartyWalletService');
    const walletResult = await thirdPartyWalletService.getBalance(user_id, 'USD');
    if (!walletResult.success) {
      return {
        code: 500,
        message: 'Wallet not found'
      };
    }
    
    return {
      code: 200,
      message: 'Player info retrieved successfully',
      data: {
        user_id: user.user_id.toString(),
        username: user.user_name,
        balance: formatAmount(walletResult.balance, 'USD'),
        currency: 'USD'
      }
    };
  } catch (error) {
    console.error('❌ Error handling SPRIBE player info request:', error);
    return {
      code: 500,
      message: 'Internal server error'
    };
  }
};

/**
 * Handle withdraw request - RECORDS IN SpribeTransaction
 */
const handleWithdraw = async (withdrawData) => {
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
    await initializeModels();
    
    console.log(`💸 SPRIBE Withdraw: User ${user_id}, Amount ${amount}, Currency ${currency}, TX ${provider_tx_id}`);
    
    // Validate currency
    if (!spribeConfig.supportedCurrencies.includes(currency)) {
      return {
        code: 400,
        message: `Currency ${currency} is not supported`
      };
    }
    
    // 🔥 CRITICAL: Check for duplicate in SpribeTransaction model
    const existingTx = await findTransactionByProviderTxId(provider_tx_id);
    
    if (existingTx.success) {
      console.log(`⚠️ Duplicate SPRIBE transaction: ${provider_tx_id}`);
      return {
        code: 409,
        message: 'Duplicate transaction',
        data: {
          user_id: existingTx.transaction.user_id.toString(),
          operator_tx_id: existingTx.transaction.operator_tx_id,
          provider: existingTx.transaction.provider,
          provider_tx_id: existingTx.transaction.provider_tx_id,
          old_balance: formatAmount(existingTx.transaction.old_balance / 100, currency),
          new_balance: formatAmount(existingTx.transaction.new_balance / 100, currency),
          currency: currency
        }
      };
    }
    
    // Parse amount from SPRIBE format
    const parsedAmount = parseAmount(amount, currency);
    
    // Validate amount is positive
    if (parsedAmount <= 0) {
      return {
        code: 400,
        message: 'Invalid amount'
      };
    }
    
    // Update third-party wallet balance (deduct amount)
    const thirdPartyWalletService = require('./thirdPartyWalletService');
    const walletResult = await thirdPartyWalletService.updateBalance(user_id, -parsedAmount);
    
    if (!walletResult.success) {
      if (walletResult.message === 'Insufficient funds') {
        return {
          code: 402,
          message: 'Insufficient funds'
        };
      }
      
      return {
        code: 500,
        message: walletResult.message || 'Failed to update wallet'
      };
    }
    
    // 🔥 CRITICAL: Process the bet transaction in SpribeTransaction model
    const result = await processBetTransaction({
      user_id,
      provider,
      game_id: game,
      provider_tx_id,
      amount: parsedAmount,
      currency,
      action_id,
      platform,
      ip_address: null,
      old_balance: walletResult.oldBalance,
      new_balance: walletResult.newBalance
    });
    
    if (!result.success) {
      return {
        code: 500,
        message: result.message || 'Transaction processing failed'
      };
    }
    
    // Create general transaction record for system-wide tracking
    try {
      if (Transaction) {
        await Transaction.create({
          user_id: user_id,
          type: 'bet',
          amount: parsedAmount,
          status: 'completed',
          description: `Spribe game bet - ${game}`,
          reference_id: `spribe_bet_${uuidv4()}`,
          metadata: {
            game_id: game,
            transaction_id: result.operator_tx_id,
            game_type: 'spribe',
            currency: currency,
            spribe_tx_id: result.transaction.id
          }
        });
      }
    } catch (txError) {
      console.warn('⚠️ Failed to create general transaction record:', txError.message);
    }

    // Process activity reward
    try {
      const { processBetForActivityReward } = require('./activityRewardService');
      await processBetForActivityReward(user_id, parsedAmount, 'spribe');
    } catch (activityError) {
      console.warn('⚠️ Activity reward processing failed:', activityError.message);
    }

    console.log(`✅ SPRIBE withdraw successful: TX ${result.operator_tx_id}`);

    return {
      code: 200,
      message: 'Withdrawal successful',
      data: {
        user_id: user_id.toString(),
        operator_tx_id: result.operator_tx_id,
        provider: provider,
        provider_tx_id: provider_tx_id,
        old_balance: formatAmount(walletResult.oldBalance, currency),
        new_balance: formatAmount(walletResult.newBalance, currency),
        currency: currency
      }
    };
  } catch (error) {
    console.error('❌ Error handling SPRIBE withdraw request:', error);
    
    return {
      code: 500,
      message: 'Internal server error'
    };
  }
};

/**
 * Handle deposit request - RECORDS IN SpribeTransaction
 */
const handleDeposit = async (depositData) => {
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
    await initializeModels();
    
    console.log(`💰 SPRIBE Deposit: User ${user_id}, Amount ${amount}, Currency ${currency}, TX ${provider_tx_id}`);
    
    // Validate currency
    if (!spribeConfig.supportedCurrencies.includes(currency)) {
      return {
        code: 400,
        message: `Currency ${currency} is not supported`
      };
    }
    
    // 🔥 CRITICAL: Check for duplicate in SpribeTransaction model
    const existingTx = await findTransactionByProviderTxId(provider_tx_id);
    
    if (existingTx.success) {
      console.log(`⚠️ Duplicate SPRIBE transaction: ${provider_tx_id}`);
      return {
        code: 409,
        message: 'Duplicate transaction',
        data: {
          user_id: existingTx.transaction.user_id.toString(),
          operator_tx_id: existingTx.transaction.operator_tx_id,
          provider: existingTx.transaction.provider,
          provider_tx_id: existingTx.transaction.provider_tx_id,
          old_balance: formatAmount(existingTx.transaction.old_balance / 100, currency),
          new_balance: formatAmount(existingTx.transaction.new_balance / 100, currency),
          currency: currency
        }
      };
    }
    
    // Parse amount from SPRIBE format
    const parsedAmount = parseAmount(amount, currency);
    
    // Update third-party wallet balance (add amount)
    const thirdPartyWalletService = require('./thirdPartyWalletService');
    const walletResult = await thirdPartyWalletService.updateBalance(user_id, parsedAmount);
    
    if (!walletResult.success) {
      return {
        code: 500,
        message: walletResult.message || 'Failed to update wallet'
      };
    }
    
    // 🔥 CRITICAL: Process the win transaction in SpribeTransaction model
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
      withdraw_provider_tx_id,
      old_balance: walletResult.oldBalance,
      new_balance: walletResult.newBalance
    });
    
    if (!result.success) {
      return {
        code: 500,
        message: result.message || 'Transaction processing failed'
      };
    }
    
    console.log(`✅ SPRIBE deposit successful: TX ${result.operator_tx_id}`);
    
    return {
      code: 200,
      message: 'Deposit successful',
      data: {
        user_id: user_id.toString(),
        operator_tx_id: result.operator_tx_id,
        provider: provider,
        provider_tx_id: provider_tx_id,
        old_balance: formatAmount(walletResult.oldBalance, currency),
        new_balance: formatAmount(walletResult.newBalance, currency),
        currency: currency
      }
    };
  } catch (error) {
    console.error('❌ Error handling SPRIBE deposit request:', error);
    
    return {
      code: 500,
      message: 'Internal server error'
    };
  }
};

/**
 * Handle rollback request - RECORDS IN SpribeTransaction
 */
const handleRollback = async (rollbackData) => {
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
    await initializeModels();
    
    console.log(`🔄 SPRIBE Rollback: User ${user_id}, Amount ${amount}, Original TX ${rollback_provider_tx_id}`);
    
    // 🔥 CRITICAL: Check for duplicate rollback in SpribeTransaction model
    const existingTx = await findTransactionByProviderTxId(provider_tx_id);
    
    if (existingTx.success) {
      console.log(`⚠️ Duplicate SPRIBE rollback: ${provider_tx_id}`);
      return {
        code: 409,
        message: 'Duplicate transaction',
        data: {
          user_id: existingTx.transaction.user_id.toString(),
          currency: existingTx.transaction.currency,
          operator_tx_id: existingTx.transaction.operator_tx_id,
          provider: existingTx.transaction.provider,
          provider_tx_id: existingTx.transaction.provider_tx_id,
          old_balance: formatAmount(existingTx.transaction.old_balance / 100, existingTx.transaction.currency),
          new_balance: formatAmount(existingTx.transaction.new_balance / 100, existingTx.transaction.currency)
        }
      };
    }
    
    // Find original transaction to determine if it was a bet or win
    const originalTx = await findTransactionByProviderTxId(rollback_provider_tx_id);
    if (!originalTx.success) {
      return {
        code: 408,
        message: 'Transaction does not found'
      };
    }
    
    // Get currency from transaction
    const currency = originalTx.transaction.currency || 'EUR';
    
    // Parse amount from SPRIBE format
    const parsedAmount = parseAmount(amount, currency);
    
    // Determine if we need to add or subtract based on original transaction type
    let walletResult;
    const thirdPartyWalletService = require('./thirdPartyWalletService');
    
    if (originalTx.transaction.type === 'bet') {
      // If rolling back a bet, give money back to player
      walletResult = await thirdPartyWalletService.updateBalance(user_id, parsedAmount);
    } else if (originalTx.transaction.type === 'win') {
      // If rolling back a win, take money from player
      walletResult = await thirdPartyWalletService.updateBalance(user_id, -parsedAmount);
      
      // Handle insufficient funds case
      if (!walletResult.success && walletResult.message === 'Insufficient funds') {
        return {
          code: 402,
          message: 'Insufficient funds for rollback'
        };
      }
    }
    
    if (!walletResult || !walletResult.success) {
      return {
        code: 500,
        message: walletResult ? walletResult.message : 'Failed to process rollback'
      };
    }
    
    // 🔥 CRITICAL: Process the rollback transaction in SpribeTransaction model
    const result = await processRollbackTransaction({
      user_id,
      provider,
      game_id: game,
      provider_tx_id,
      rollback_provider_tx_id,
      amount: parsedAmount,
      currency,
      action_id,
      platform: null,
      ip_address: null,
      old_balance: walletResult.oldBalance,
      new_balance: walletResult.newBalance
    });
    
    if (!result.success) {
      return {
        code: 500,
        message: result.message || 'Rollback processing failed'
      };
    }
    
    console.log(`✅ SPRIBE rollback successful: TX ${result.operator_tx_id}`);
    
    return {
      code: 200,
      message: 'Rollback successful',
      data: {
        user_id: user_id.toString(),
        currency: currency,
        operator_tx_id: result.operator_tx_id,
        provider: provider,
        provider_tx_id: provider_tx_id,
        old_balance: formatAmount(walletResult.oldBalance, currency),
        new_balance: formatAmount(walletResult.newBalance, currency)
      }
    };
  } catch (error) {
    console.error('❌ Error handling SPRIBE rollback request:', error);
    
    return {
      code: 500,
      message: 'Internal server error'
    };
  }
};

/**
 * List available games - UPDATED FOR STAGING
 */
const listGames = async () => {
  try {
    // Import config at the start
    const spribeConfig = require('../config/spribeConfig');
    
    // Validate config
    if (!spribeConfig || !spribeConfig.availableGames || !Array.isArray(spribeConfig.availableGames)) {
      throw new Error('Invalid SPRIBE configuration: missing or invalid availableGames');
    }
    
    if (!spribeConfig.providers || typeof spribeConfig.providers !== 'object') {
      throw new Error('Invalid SPRIBE configuration: missing or invalid providers');
    }
    
    if (!spribeConfig.gameInfoUrl) {
      throw new Error('Invalid SPRIBE configuration: missing gameInfoUrl');
    }
    
    console.log('Processing games list:', {
      availableGames: spribeConfig.availableGames,
      providers: Object.keys(spribeConfig.providers),
      gameInfoUrl: spribeConfig.gameInfoUrl
    });
    
    const games = spribeConfig.availableGames.map(gameId => {
      const provider = spribeConfig.providers[gameId] || 'spribe_crypto';
      const providerType = provider.split('_')[1] || 'game';
      
      return {
        id: gameId,
        provider: provider,
        name: gameId
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
        type: providerType,
        thumbnailUrl: `${spribeConfig.gameInfoUrl}/games/${gameId}/thumbnail.png`,
        description: `Play ${gameId
          .split('-')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ')} from SPRIBE`,
        isActive: true,
        category: providerType,
        environment: 'staging'
      };
    });
    
    console.log(`Successfully processed ${games.length} games`);
    
    return {
      success: true,
      games,
      supportedCurrencies: spribeConfig.supportedCurrencies || ['USD', 'INR', 'EUR'],
      environment: 'staging'
    };
  } catch (error) {
    console.error('❌ Error listing games:', error);
    console.error('Error stack:', error.stack);
    return {
      success: false,
      message: `Failed to list games: ${error.message}`
    };
  }
};

// ======================= UTILITY FUNCTIONS =======================

/**
 * Get user's game transaction history from SpribeTransaction model
 */
const getUserGameHistory = async (userId, filters = {}) => {
  try {
    await initializeModels();
    
    const {
      gameId,
      dateFrom,
      dateTo,
      type,
      limit = 50,
      offset = 0
    } = filters;
    
    const whereClause = { user_id: userId };
    
    if (gameId) {
      whereClause.game_id = gameId;
    }
    
    if (type) {
      whereClause.type = type;
    }
    
    if (dateFrom || dateTo) {
      whereClause.created_at = {};
      if (dateFrom) {
        whereClause.created_at[Op.gte] = new Date(dateFrom);
      }
      if (dateTo) {
        whereClause.created_at[Op.lte] = new Date(dateTo);
      }
    }
    
    const transactions = await SpribeTransaction.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: SpribeGameSession,
          as: 'session',
          attributes: ['game_id', 'provider', 'platform']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });
    
    return {
      success: true,
      transactions: transactions.rows,
      total: transactions.count,
      pagination: {
        limit,
        offset,
        total: transactions.count,
        pages: Math.ceil(transactions.count / limit)
      }
    };
  } catch (error) {
    console.error('❌ Error getting user SPRIBE game history:', error);
    
    return {
      success: false,
      message: 'Failed to get transaction history'
    };
  }
};

/**
 * Get session statistics from SpribeGameSession and SpribeTransaction models
 */
const getSessionStatistics = async (sessionId) => {
  try {
    await initializeModels();
    
    // Get session details
    const session = await SpribeGameSession.findByPk(sessionId, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'user_name']
        }
      ]
    });
    
    if (!session) {
      return {
        success: false,
        message: 'Session not found'
      };
    }
    
    // Get transaction statistics
    const stats = await SpribeTransaction.findAll({
      where: { session_id: sessionId },
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('id')), 'transaction_count'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN type = 'bet' THEN amount ELSE 0 END")), 'total_bet_amount'],
        [sequelize.fn('SUM', sequelize.literal("CASE WHEN type = 'win' THEN amount ELSE 0 END")), 'total_win_amount'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN type = 'bet' THEN 1 END")), 'bet_count'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN type = 'win' THEN 1 END")), 'win_count'],
        [sequelize.fn('COUNT', sequelize.literal("CASE WHEN type = 'rollback' THEN 1 END")), 'rollback_count']
      ],
      raw: true
    });
    
    const sessionStats = stats[0] || {};
    
    return {
      success: true,
      session: {
        id: session.id,
        user_id: session.user_id,
        user_name: session.user?.user_name,
        game_id: session.game_id,
        provider: session.provider,
        currency: session.currency,
        platform: session.platform,
        status: session.status,
        started_at: session.started_at,
        ended_at: session.ended_at,
        duration: session.ended_at ? 
          Math.floor((new Date(session.ended_at) - new Date(session.started_at)) / 1000) : 
          Math.floor((new Date() - new Date(session.started_at)) / 1000)
      },
      statistics: {
        transaction_count: parseInt(sessionStats.transaction_count) || 0,
        bet_count: parseInt(sessionStats.bet_count) || 0,
        win_count: parseInt(sessionStats.win_count) || 0,
        rollback_count: parseInt(sessionStats.rollback_count) || 0,
        total_bet_amount: parseFloat((parseInt(sessionStats.total_bet_amount) || 0) / 100).toFixed(2),
        total_win_amount: parseFloat((parseInt(sessionStats.total_win_amount) || 0) / 100).toFixed(2),
        net_result: parseFloat(((parseInt(sessionStats.total_win_amount) || 0) - (parseInt(sessionStats.total_bet_amount) || 0)) / 100).toFixed(2)
      }
    };
  } catch (error) {
    console.error('❌ Error getting session statistics:', error);
    
    return {
      success: false,
      message: 'Failed to get session statistics'
    };
  }
};

/**
 * Clean up expired sessions
 */
const cleanupExpiredSessions = async () => {
  try {
    await initializeModels();
    
    // Mark sessions as expired if they've been active for more than 4 hours
    const expiredCutoff = new Date(Date.now() - 4 * 60 * 60 * 1000); // 4 hours ago
    
    const result = await SpribeGameSession.update(
      { 
        status: 'expired',
        ended_at: new Date()
      },
      {
        where: {
          status: 'active',
          started_at: {
            [Op.lt]: expiredCutoff
          }
        }
      }
    );
    
    console.log(`🧹 Cleaned up ${result[0]} expired SPRIBE sessions`);
    
    return {
      success: true,
      expiredSessions: result[0]
    };
  } catch (error) {
    console.error('❌ Error cleaning up expired sessions:', error);
    
    return {
      success: false,
      message: 'Failed to cleanup expired sessions'
    };
  }
};

// Helper to generate one-time token
const generateOneTimeToken = () => {
  return require('crypto').randomBytes(32).toString('hex');
};

const makeSpribeRequest = async (method, path, data = null) => {
  try {
    const url = `${spribeConfig.apiBaseUrl}${path}`;
    const headers = generateSpribeHeaders(
      path,
      data,
      spribeConfig.clientId,
      spribeConfig.clientSecret
    );

    console.log('Making SPRIBE request:', {
      method,
      url,
      headers: {
        ...headers,
        'X-Spribe-Client-Signature': headers['X-Spribe-Client-Signature'].substring(0, 10) + '...'
      },
      data
    });

    const response = await axios({
      method,
      url,
      headers,
      data
    });

    return response.data;
  } catch (error) {
    console.error('SPRIBE request failed:', {
      error: error.message,
      response: error.response?.data
    });
    throw error;
  }
};

// ======================= EXPORTS =======================

module.exports = {
  // Main API handlers
  getGameLaunchUrl,
  handleAuth,
  handlePlayerInfo,
  handleWithdraw,
  handleDeposit,
  handleRollback,
  listGames,
  
  // Session management
  createGameSession,
  updateGameSession,
  endGameSession,
  
  // Transaction management
  processBetTransaction,
  processWinTransaction,
  processRollbackTransaction,
  findTransactionByProviderTxId,
  
  // Utility functions
  getUserGameHistory,
  getSessionStatistics,
  cleanupExpiredSessions,
  
  // Model initialization
  initializeModels
};