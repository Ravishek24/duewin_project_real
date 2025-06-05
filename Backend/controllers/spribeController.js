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
const { validateSignature, validateIP } = require('../utils/spribeUtils');
const spribeService = require('../services/spribeService');
const spribeConfig = require('../config/spribeConfig');

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
    
    // 3. Validate signature
    const fullPath = req.originalUrl;
    const isValidSignature = validateSignature(clientId, timestamp, signature, fullPath, req.body);
    
    console.log('Signature validation result:', {
        isValidSignature,
        fullPath,
        body: req.body,
        environment: process.env.NODE_ENV || 'development'
    });
    
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
 * Get game launch URL for a specific game
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getLaunchUrlController = async (req, res) => {
    try {
        const { gameId } = req.params;
        const userId = req.user.user_id;
        
        const result = await getGameLaunchUrl(gameId, userId, req);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error generating game launch URL:', error);
        res.status(500).json({
            success: false,
            message: 'Server error generating game launch URL'
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

/**
 * Handle authentication request from SPRIBE
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const authCallbackController = async (req, res) => {
    logSpribeRequest(req, 'AUTH');
    try {
        const clientId = req.header('X-Spribe-Client-ID');
        const timestamp = req.header('X-Spribe-Client-TS');
        const signature = req.header('X-Spribe-Client-Signature');
        const fullPath = req.originalUrl;
        const isValidSignature = validateSignature(clientId, timestamp, signature, fullPath, req.body);
        if (!isValidSignature) {
            const resp = { code: 413, message: 'Invalid Client-Signature' };
            logSpribeResponse('AUTH', resp);
            return res.status(200).json(resp);
        }
        const result = await handleAuth(req.body);
        logSpribeResponse('AUTH', result);
        return res.status(200).json(result);
    } catch (error) {
        const resp = { code: 500, message: 'Internal server error' };
        logSpribeResponse('AUTH', resp);
        res.status(200).json(resp);
    }
};

/**
 * Handle player info request from SPRIBE
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
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
 * Handle withdraw request from SPRIBE (betting)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
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
 * Handle deposit request from SPRIBE (winning)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
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
 * Handle rollback request from SPRIBE
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
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

/**
 * Handle all SPRIBE callbacks
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const handleCallback = async (req, res) => {
  try {
    // Log environment and configuration
    console.log('SPRIBE Environment:', {
      NODE_ENV: process.env.NODE_ENV,
      SPRIBE_CLIENT_ID: process.env.SPRIBE_CLIENT_ID,
      SPRIBE_OPERATOR_KEY: process.env.SPRIBE_OPERATOR_KEY,
      SPRIBE_CALLBACK_URL: process.env.SPRIBE_CALLBACK_URL
    });

    // Log request details
    console.log('SPRIBE Callback Request:', {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      body: req.body,
      ip: req.ip,
      ips: req.ips,
      protocol: req.protocol,
      secure: req.secure
    });

    // STEP 1: Enhanced security validation
    const securityCheck = validateSpribeRequest(req);
    if (!securityCheck.isValid) {
      console.error('SPRIBE security validation failed:', securityCheck.message);
      return res.status(200).json({
        code: securityCheck.code,
        message: securityCheck.message
      });
    }
    
    // STEP 2: Log incoming request for monitoring
    console.log('Valid SPRIBE callback received:', {
      timestamp: new Date().toISOString(),
      ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      action: req.body.action,
      user_id: req.body.user_id,
      provider_tx_id: req.body.provider_tx_id
    });
    
    // STEP 3: Extract action and validate
    const { action } = req.body;
    
    if (!action) {
      return res.status(200).json({
        code: 400,
        message: 'Missing action parameter'
      });
    }
    
    // STEP 4: Handle the request based on action type
    let result;
    switch (action) {
      case 'auth':
        result = await spribeService.handleAuth(req.body);
        break;
      case 'player_info':
        result = await spribeService.handlePlayerInfo(req.body);
        break;
      case 'withdraw':
        result = await spribeService.handleWithdraw(req.body);
        break;
      case 'deposit':
        result = await spribeService.handleDeposit(req.body);
        break;
      case 'rollback':
        result = await spribeService.handleRollback(req.body);
        break;
      default:
        return res.status(200).json({
          code: 400,
          message: `Invalid action: ${action}`
        });
    }
    
    // STEP 5: Always return HTTP 200 with proper SPRIBE response format
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error handling SPRIBE callback:', error);
    return res.status(200).json({
      code: 500,
      message: 'Internal server error'
    });
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
    handleCallback,
    healthCheck,
};