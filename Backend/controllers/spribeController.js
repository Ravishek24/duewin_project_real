// controllers/spribeController.js
const {
    getGameLaunchUrl,
    handleAuth,
    handlePlayerInfo,
    handleWithdraw,
    handleDeposit,
    handleRollback,
    listGames
} = require('../services/spribeService');
const { validateIP } = require('../utils/spribeUtils');
const { validateSpribeSignature } = require('../utils/spribeSignatureUtils');
const spribeService = require('../services/spribeService');
const spribeConfig = require('../config/spribeConfig');
const User = require('../models/User');
const GameSession = require('../models/GameSession');
const ThirdPartyWallet = require('../models/ThirdPartyWallet');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * Get a list of available SPRIBE games
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getGamesController = async (req, res) => {
    try {
        console.log('📋 Fetching SPRIBE games list...');
        console.log('Available games:', spribeConfig.availableGames);
        console.log('Providers:', spribeConfig.providers);
        
        const result = await listGames();
        
        console.log('Games list result:', {
            success: result.success,
            gamesCount: result.games?.length || 0,
            error: result.message
        });
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            console.error('Failed to list games:', result.message);
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error getting games list:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Server error retrieving games list',
            error: error.message
        });
    }
};

const validateSpribeRequest = (req) => {
    // 1. Validate IP address
    const clientIP = req.headers['x-forwarded-for'] || 
                    req.headers['x-real-ip'] || 
                    req.connection.remoteAddress;
    
    console.log('Validating SPRIBE request:', {
        headers: {
            'x-forwarded-for': req.headers['x-forwarded-for'],
            'x-real-ip': req.headers['x-real-ip'],
            'remote-address': req.connection.remoteAddress
        },
        clientIP,
        environment: process.env.NODE_ENV || 'development',
        nodeEnv: process.env.NODE_ENV,
        isProduction: process.env.NODE_ENV === 'production'
    });
    
    if (!validateIP(clientIP)) {
        console.error(`Unauthorized IP attempt: ${clientIP}`);
        return {
            isValid: false,
            code: 403,
            message: 'Unauthorized IP address'
        };
    }
    
    // 2. Validate required headers
    const clientId = req.header('X-Spribe-Client-ID');
    const timestamp = req.header('X-Spribe-Client-TS');
    const signature = req.header('X-Spribe-Client-Signature');
    
    console.log('Validating SPRIBE headers:', {
        clientId,
        timestamp,
        signature: signature ? 'present' : 'missing',
        expectedClientId: spribeConfig.clientId,
        environment: process.env.NODE_ENV || 'development'
    });
    
    if (!clientId || !timestamp || !signature) {
        return {
            isValid: false,
            code: 400,
            message: 'Missing required security headers'
        };
    }
    
    // 3. Validate signature using SPRIBE's exact specification
    const fullPath = req.originalUrl;
    const isValidSignature = validateSpribeSignature(
        clientId,
        timestamp,
        signature,
        fullPath,
        req.body,
        spribeConfig.clientSecret
    );
    
    if (!isValidSignature) {
        return {
            isValid: false,
            code: 413,
            message: 'Invalid Client-Signature'
        };
    }
    
    return { isValid: true };
};

/**
 * Get game launch URL
 */
const getLaunchUrlController = async (req, res) => {
  try {
    console.log('🎮 ===== GAME LAUNCH REQUEST =====');
    console.log('📦 Request details:', {
      gameId: req.params.gameId,
      userId: req.query.userId,
      headers: req.headers,
      auth: req.headers.authorization ? 'Present' : 'Missing'
    });

    // Get authorization token
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.error('❌ No authorization token provided');
      return res.status(401).json({
        success: false,
        message: 'Authorization token is required'
      });
    }

    // Extract token from Bearer format
    const token = authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : authHeader;

    if (!token) {
      console.error('❌ Invalid authorization token format');
      return res.status(401).json({
        success: false,
        message: 'Invalid authorization token format'
      });
    }

    // Get game ID from params and user ID from query
    const gameId = req.params.gameId;
    const userId = req.query.userId;

    if (!gameId || !userId) {
      console.error('❌ Missing required parameters:', { gameId, userId });
      return res.status(400).json({
        success: false,
        message: 'Game ID and User ID are required'
      });
    }

    // Get user from database
    const user = await User.findByPk(userId);
    if (!user) {
      console.error(`❌ User not found: ${userId}`);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get launch URL
    const result = await getGameLaunchUrl(gameId, userId, req);
    
    console.log('✅ Launch URL generated:', {
      success: result.success,
      hasUrl: !!result.url,
      sessionId: result.sessionId,
      warning: result.warningMessage
    });

    return res.status(200).json({
      success: true,
      data: {
        launchUrl: result
      }
    });
  } catch (error) {
    console.error('❌ Error generating launch URL:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate launch URL',
      error: error.message
    });
  }
};

const logSpribeRequest = (req, actionName) => {
    console.log(`\n===== SPRIBE ${actionName} REQUEST =====`);
    console.log('Timestamp:', new Date().toISOString());
    console.log('Headers:', {
        'X-Spribe-Client-ID': req.header('X-Spribe-Client-ID'),
        'X-Spribe-Client-TS': req.header('X-Spribe-Client-TS'),
        'X-Spribe-Client-Signature': req.header('X-Spribe-Client-Signature'),
        'Content-Type': req.header('Content-Type'),
        'IP': req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress
    });
    console.log('Original URL:', req.originalUrl);
    console.log('Body:', JSON.stringify(req.body));
    console.log('========================================\n');
};

const logSpribeResponse = (actionName, response) => {
    console.log(`\n===== SPRIBE ${actionName} RESPONSE =====`);
    console.log('Timestamp:', new Date().toISOString());
    console.log('Response:', JSON.stringify(response));
    console.log('========================================\n');
};

const logSpribeHeaderDebug = (req, context) => {
  console.log(`\n===== SPRIBE HEADER DEBUG: ${context} =====`);
  console.log('Timestamp:', new Date().toISOString());
  console.log('Headers:', req.headers);
  console.log('Original URL:', req.originalUrl);
  console.log('Body:', JSON.stringify(req.body));
  console.log('========================================\n');
};

/**
 * 🔥 FIXED: Handle auth callback from SPRIBE
 * This handles the authentication request when SPRIBE calls your auth callback URL
 */
const authCallbackController = async (req, res) => {
  try {
    console.log('🔐 ===== SPRIBE AUTH REQUEST =====');
    console.log('📦 Request details:', {
      method: req.method,
      headers: req.headers,
      query: req.query,
      body: req.body,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    // 🔥 FIX 1: Handle query parameters for security validation
    const { client_id, client_secret, timestamp } = req.query;

    // Validate security parameters from query string
    if (!client_id || !client_secret || !timestamp) {
      console.error('❌ Missing security parameters in query');
      return res.status(200).json({
        code: 413,
        message: 'Missing required security parameters'
      });
    }

    // Validate client credentials
    if (client_id !== spribeConfig.clientId || client_secret !== spribeConfig.clientSecret) {
      console.error('❌ Invalid security parameters');
      return res.status(200).json({
        code: 413,
        message: 'Invalid Client-Signature'
      });
    }

    // 🔥 FIX 2: Extract correct field names from SPRIBE request
    const { user_token, session_token, platform, currency } = req.body;

    if (!user_token || !session_token) {
      console.error('❌ Missing required tokens');
      return res.status(200).json({
        code: 401,
        message: 'User token is invalid'
      });
    }

    console.log('🔍 Processing auth with tokens:', {
      user_token: user_token.substring(0, 8) + '...',
      session_token: session_token.substring(0, 8) + '...',
      platform,
      currency
    });

    // 🔥 FIX 3: Find session by user_token (not spribe_token)
    const session = await SpribeGameSession.findOne({
      where: {
        launch_token: user_token, // This is the user token we generated
        status: 'active'
      }
    });

    if (!session) {
      console.error('❌ Session not found for user_token');
      return res.status(200).json({
        code: 401,
        message: 'User token is invalid'
      });
    }

    // Update session with SPRIBE's session token
    await session.update({
      session_token: session_token,
      platform: platform || 'desktop'
    });

    // Get user details
    const user = await User.findByPk(session.user_id);
    if (!user) {
      console.error('❌ User not found');
      return res.status(200).json({
        code: 401,
        message: 'User token is invalid'
      });
    }

    // Get balance from third-party wallet
    const thirdPartyWalletService = require('../services/thirdPartyWalletService');
    const walletResult = await thirdPartyWalletService.getBalance(user.id, currency || 'USD');

    if (!walletResult.success) {
      console.error('❌ Failed to get balance');
      return res.status(200).json({
        code: 500,
        message: 'Internal error'
      });
    }

    // Format balance for SPRIBE (convert to units: $1 = 1000 units)
    const formattedBalance = Math.round(walletResult.balance * 1000);

    // 🔥 FIX 4: Return response in correct SPRIBE format
    const response = {
      code: 200,
      message: 'Success',
      data: {
        user_id: user.id.toString(),
        username: user.username || user.user_name,
        balance: formattedBalance,
        currency: currency || 'USD'
      }
    };

    console.log('✅ Auth successful:', {
      userId: user.id,
      balance: formattedBalance,
      currency: currency || 'USD'
    });

    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Auth error:', error);
    return res.status(200).json({
      code: 500,
      message: 'Internal error'
    });
  }
};

/**
 * Handle player info callback from SPRIBE
 */
const infoCallbackController = async (req, res) => {
  logSpribeRequest(req, 'INFO');
  try {
    const clientId = req.header('X-Spribe-Client-ID');
    const timestamp = req.header('X-Spribe-Client-TS');
    const signature = req.header('X-Spribe-Client-Signature');
    const fullPath = req.originalUrl;
    const isValidSignature = validateSignature(clientId, timestamp, signature, fullPath, req.body);
    if (!isValidSignature) {
      const resp = { code: 413, message: 'Invalid Client-Signature' };
      logSpribeResponse('INFO', resp);
      return res.status(200).json(resp);
    }
    const result = await handlePlayerInfo(req.body);
    logSpribeResponse('INFO', result);
    return res.status(200).json(result);
  } catch (error) {
    const resp = { code: 500, message: 'Internal server error' };
    logSpribeResponse('INFO', resp);
    res.status(200).json(resp);
  }
};

/**
 * Handle withdraw callback from SPRIBE (betting)
 */
const withdrawCallbackController = async (req, res) => {
  logSpribeRequest(req, 'WITHDRAW');
  try {
    const clientId = req.header('X-Spribe-Client-ID');
    const timestamp = req.header('X-Spribe-Client-TS');
    const signature = req.header('X-Spribe-Client-Signature');
    const fullPath = req.originalUrl;
    const isValidSignature = validateSignature(clientId, timestamp, signature, fullPath, req.body);
    if (!isValidSignature) {
      const resp = { code: 413, message: 'Invalid Client-Signature' };
      logSpribeResponse('WITHDRAW', resp);
      return res.status(200).json(resp);
    }
    const result = await handleWithdraw(req.body);
    logSpribeResponse('WITHDRAW', result);
    return res.status(200).json(result);
  } catch (error) {
    const resp = { code: 500, message: 'Internal server error' };
    logSpribeResponse('WITHDRAW', resp);
    res.status(200).json(resp);
  }
};

/**
 * Handle deposit callback from SPRIBE (winning)
 */
const depositCallbackController = async (req, res) => {
  logSpribeRequest(req, 'DEPOSIT');
  try {
    const clientId = req.header('X-Spribe-Client-ID');
    const timestamp = req.header('X-Spribe-Client-TS');
    const signature = req.header('X-Spribe-Client-Signature');
    const fullPath = req.originalUrl;
    const isValidSignature = validateSignature(clientId, timestamp, signature, fullPath, req.body);
    if (!isValidSignature) {
      const resp = { code: 413, message: 'Invalid Client-Signature' };
      logSpribeResponse('DEPOSIT', resp);
      return res.status(200).json(resp);
    }
    const result = await handleDeposit(req.body);
    logSpribeResponse('DEPOSIT', result);
    return res.status(200).json(result);
  } catch (error) {
    const resp = { code: 500, message: 'Internal server error' };
    logSpribeResponse('DEPOSIT', resp);
    res.status(200).json(resp);
  }
};

/**
 * Handle rollback callback from SPRIBE
 */
const rollbackCallbackController = async (req, res) => {
  logSpribeRequest(req, 'ROLLBACK');
  try {
    const clientId = req.header('X-Spribe-Client-ID');
    const timestamp = req.header('X-Spribe-Client-TS');
    const signature = req.header('X-Spribe-Client-Signature');
    const fullPath = req.originalUrl;
    const isValidSignature = validateSignature(clientId, timestamp, signature, fullPath, req.body);
    if (!isValidSignature) {
      const resp = { code: 413, message: 'Invalid Client-Signature' };
      logSpribeResponse('ROLLBACK', resp);
      return res.status(200).json(resp);
    }
    const result = await handleRollback(req.body);
    logSpribeResponse('ROLLBACK', result);
    return res.status(200).json(result);
  } catch (error) {
    const resp = { code: 500, message: 'Internal server error' };
    logSpribeResponse('ROLLBACK', resp);
    res.status(200).json(resp);
  }
};

const healthCheck = async (req, res) => {
  try {
    // Check if all required config is present
    const spribeConfig = require('../config/spribeConfig');
    const configCheck = {
      hasClientId: !!spribeConfig.clientId,
      hasClientSecret: !!spribeConfig.clientSecret,
      hasOperatorKey: !!spribeConfig.operatorKey,
      environment: 'staging',
      availableGames: spribeConfig.availableGames.length,
      supportedCurrencies: spribeConfig.supportedCurrencies
    };
    
    res.json({
      success: true,
      message: 'SPRIBE integration health check',
      timestamp: new Date().toISOString(),
      config: configCheck,
      endpoints: {
        games: '/api/spribe/games',
        launch: '/api/spribe/launch/:gameId',
        callback: '/api/spribe/callback'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'SPRIBE integration health check failed',
      error: error.message
    });
  }
};

module.exports = {
    getGamesController,
    getLaunchUrlController,
    authCallbackController,
    infoCallbackController,
    withdrawCallbackController,
    depositCallbackController,
    rollbackCallbackController,
    healthCheck,
    validateSpribeRequest,
};