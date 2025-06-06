// routes/spribeRoutes.js - WORKING CALLBACK HANDLER

const express = require('express');
const router = express.Router();
const spribeService = require('../services/spribeService');
const spribeUtils = require('../utils/spribeUtils');
const { getModels } = require('../models');

// Middleware to log all SPRIBE requests
router.use((req, res, next) => {
  console.log('\n📨 ===== SPRIBE REQUEST RECEIVED =====');
  console.log('📦 Request details:', {
    method: req.method,
    path: req.path,
    query: req.query,
    params: req.params,
    headers: req.headers,
    body: req.body,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });
  next();
});

// Test endpoint to verify callback URL accessibility
router.get('/test-callback', (req, res) => {
  console.log('\n🧪 ===== TESTING CALLBACK URL =====');
  console.log('📦 Request details:', {
    method: req.method,
    path: req.path,
    headers: req.headers,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    message: 'Callback URL is accessible',
    details: {
      timestamp: new Date().toISOString(),
      serverTime: new Date().toISOString(),
      clientIP: req.ip,
      headers: req.headers
    }
  });
});

// Test endpoint to verify authentication endpoint
router.get('/test-auth', (req, res) => {
  console.log('\n🧪 ===== TESTING AUTH ENDPOINT =====');
  console.log('📦 Request details:', {
    method: req.method,
    path: req.path,
    headers: req.headers,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    message: 'Auth endpoint is accessible',
    details: {
      timestamp: new Date().toISOString(),
      serverTime: new Date().toISOString(),
      clientIP: req.ip,
      headers: req.headers
    }
  });
});

/**
 * 🔥 WORKING SPRIBE CALLBACK HANDLER
 */
const handleCallback = async (req, res) => {
  const requestId = `REQ_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  try {
    console.log(`\n🚨 ===== SPRIBE CALLBACK ${requestId} =====`);
    console.log('📅 Timestamp:', new Date().toISOString());
    console.log('🌐 Method:', req.method);
    console.log('📍 URL:', req.originalUrl);
    console.log('💾 Body:', JSON.stringify(req.body, null, 2));
    console.log('📍 Client IP:', req.ip);
    console.log('🎯 User Agent:', req.get('User-Agent'));

    // Handle GET requests (health checks)
    if (req.method === 'GET') {
      console.log('✅ GET request - health check');
      const response = {
        status: 'ok',
        message: 'SPRIBE callback endpoint is active',
        timestamp: new Date().toISOString(),
        method: 'GET'
      };
      console.log('📤 GET Response:', JSON.stringify(response, null, 2));
      console.log(`===== END ${requestId} =====\n`);
      return res.status(200).json(response);
    }

    // Handle OPTIONS preflight
    if (req.method === 'OPTIONS') {
      console.log('✅ OPTIONS preflight');
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      console.log(`===== END ${requestId} =====\n`);
      return res.status(200).end();
    }

    // Handle POST requests (actual SPRIBE calls)
    if (req.method === 'POST') {
      console.log('🔐 Processing SPRIBE POST request...');
      
      // Extract action from request body
      const { action } = req.body;
      
      if (!action) {
        console.error('❌ Missing action in request body');
        const errorResponse = {
          code: 400,
          message: 'Missing action parameter'
        };
        console.log('📤 Error Response:', JSON.stringify(errorResponse, null, 2));
        console.log(`===== END ${requestId} =====\n`);
        return res.status(200).json(errorResponse);
      }

      console.log(`🎯 Processing SPRIBE action: ${action}`);
      
      // 🔥 CRITICAL FIX: Actually call the SPRIBE service handlers
      let result;
      switch (action) {
        case 'auth':
          console.log('🔐 Calling handleAuth...');
          result = await spribeService.handleAuth(req.body);
          break;
          
        case 'player_info':
          console.log('ℹ️ Calling handlePlayerInfo...');
          result = await spribeService.handlePlayerInfo(req.body);
          break;
          
        case 'withdraw':
          console.log('💸 Calling handleWithdraw...');
          result = await spribeService.handleWithdraw(req.body);
          break;
          
        case 'deposit':
          console.log('💰 Calling handleDeposit...');
          result = await spribeService.handleDeposit(req.body);
          break;
          
        case 'rollback':
          console.log('🔄 Calling handleRollback...');
          result = await spribeService.handleRollback(req.body);
          break;
          
        default:
          console.error(`❌ Invalid action: ${action}`);
          result = {
            code: 400,
            message: `Invalid action: ${action}`
          };
      }
      
      console.log('📤 SPRIBE Service Result:', JSON.stringify(result, null, 2));
      console.log(`===== END ${requestId} =====\n`);
      
      // Always return HTTP 200 with the result (SPRIBE expects this)
      return res.status(200).json(result);
    }

    // Handle other methods
    const defaultResponse = {
      code: 405,
      message: 'Method not allowed'
    };
    console.log('📤 Default Response:', JSON.stringify(defaultResponse, null, 2));
    console.log(`===== END ${requestId} =====\n`);
    return res.status(200).json(defaultResponse);

  } catch (error) {
    console.error('❌ CRITICAL ERROR in SPRIBE callback:', error);
    console.error('Error stack:', error.stack);
    
    const errorResponse = {
      code: 500,
      message: 'Internal server error'
    };
    
    console.log('📤 Error Response:', JSON.stringify(errorResponse, null, 2));
    console.log(`===== END ${requestId} =====\n`);
    return res.status(200).json(errorResponse);
  }
};

// Routes
router.post('/callback', handleCallback);
router.get('/callback', handleCallback);
router.options('/callback', handleCallback);

// Game launch URL endpoint (POST with body)
router.post('/launch', async (req, res) => {
  try {
    const { gameId, userId } = req.body;
    
    if (!gameId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Missing gameId or userId'
      });
    }

    const result = await spribeService.getGameLaunchUrl(gameId, userId, req);
    
    if (result.success) {
      return res.json({
        success: true,
        url: result.url,
        sessionId: result.sessionId,
        warningMessage: result.warningMessage
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('❌ Error in launch endpoint:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Direct game launch URL endpoint (GET with URL parameter)
router.get('/launch/:gameId', async (req, res) => {
  console.log('\n🎮 ===== GAME LAUNCH REQUEST =====');
  console.log('📦 Request details:', {
    gameId: req.params.gameId,
    userId: req.query.userId,
    headers: req.headers
  });

  try {
    const gameId = req.params.gameId;
    const userId = req.query.userId;
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      console.error('❌ No authorization token provided');
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    const launchUrl = await spribeService.getGameLaunchUrl(gameId, userId, token);
    console.log('✅ Launch URL generated:', launchUrl);

    return res.json({
      success: true,
      data: { launchUrl }
    });
  } catch (error) {
    console.error('❌ Game launch error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get available games
router.get('/games', async (req, res) => {
  try {
    const result = await spribeService.listGames();
    return res.json(result);
  } catch (error) {
    console.error('❌ Error getting SPRIBE games:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get games list'
    });
  }
});

// Test endpoint to verify SPRIBE token
router.get('/verify-token/:token', async (req, res) => {
  try {
    const { token } = req.params;
    console.log('🔍 Verifying SPRIBE token:', token.substring(0, 8) + '...');
    
    const models = await getModels();
    const user = await models.User.scope('withSpribeToken').findOne({
      where: { spribe_token: token }
    });
    
    if (!user) {
      console.error('❌ Token not found in database');
      return res.json({
        success: false,
        message: 'Token not found',
        details: {
          token: token.substring(0, 8) + '...',
          found: false
        }
      });
    }
    
    const isValid = user.isSpribeTokenValid();
    console.log('✅ Token validation result:', {
      userId: user.user_id,
      isValid,
      createdAt: user.spribe_token_created_at,
      expiresAt: user.spribe_token_expires_at,
      currentTime: new Date()
    });
    
    return res.json({
      success: true,
      message: isValid ? 'Token is valid' : 'Token is expired',
      details: {
        userId: user.user_id,
        token: token.substring(0, 8) + '...',
        isValid,
        createdAt: user.spribe_token_created_at,
        expiresAt: user.spribe_token_expires_at,
        currentTime: new Date()
      }
    });
  } catch (error) {
    console.error('❌ Error verifying token:', error);
    return res.status(500).json({
      success: false,
      message: 'Error verifying token',
      error: error.message
    });
  }
});

// Authentication endpoint
router.post('/auth', async (req, res) => {
  console.log('\n🔐 ===== SPRIBE AUTH REQUEST =====');
  console.log('📦 Request details:', {
    headers: req.headers,
    body: req.body,
    ip: req.ip,
    timestamp: new Date().toISOString()
  });

  try {
    // Validate request headers
    const clientId = req.headers['x-spribe-client-id'];
    const timestamp = req.headers['x-spribe-client-ts'];
    const signature = req.headers['x-spribe-client-signature'];

    console.log('🔍 Validating headers:', {
      clientId: !!clientId,
      timestamp: !!timestamp,
      signature: !!signature,
      receivedHeaders: Object.keys(req.headers)
    });

    if (!clientId || !timestamp || !signature) {
      console.error('❌ Missing required headers:', {
        clientId: !!clientId,
        timestamp: !!timestamp,
        signature: !!signature
      });
      return res.status(401).json({
        success: false,
        error: 'Missing required headers'
      });
    }

    // Validate signature
    const isValid = spribeUtils.validateSignature(
      clientId,
      timestamp,
      signature,
      req.originalUrl,
      req.body
    );

    console.log('🔑 Signature validation:', {
      isValid,
      clientId,
      timestamp,
      signatureLength: signature?.length
    });

    if (!isValid) {
      console.error('❌ Invalid signature');
      return res.status(401).json({
        success: false,
        error: 'Invalid signature'
      });
    }

    // Handle authentication
    await spribeService.handleAuth(req, res);
  } catch (error) {
    console.error('❌ Auth error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;