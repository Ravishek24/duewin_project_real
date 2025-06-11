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

    const launchUrl = await spribeService.getGameLaunchUrl(gameId, userId, req);
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


// STEP 1: Test Demo Mode (No authentication required)
router.get('/test/demo-mode', (req, res) => {
  const demoUrls = {
    aviator_demo: 'https://demo.spribe.io/launch/aviator?currency=USD&lang=EN&return_url=https://strike.atsproduct.in/games',
    dice_demo: 'https://demo.spribe.io/launch/dice?currency=USD&lang=EN&return_url=https://strike.atsproduct.in/games',
    plinko_demo: 'https://demo.spribe.io/launch/plinko?currency=USD&lang=EN&return_url=https://strike.atsproduct.in/games'
  };
  
  res.json({
    message: 'Test these demo URLs - they should work without authentication',
    demo_urls: demoUrls,
    instructions: [
      '1. Click each demo URL',
      '2. If demo works but your URLs don\'t, the issue is authentication setup',
      '3. If demo also fails, the issue is network/domain related'
    ]
  });
});

// STEP 2: Generate Debug Launch URL with different parameters
router.post('/test/debug-launch-url', async (req, res) => {
  try {
    const userId = req.body.user_id || 1;
    const gameId = req.body.game_id || 'dice';
    
    // Get user and token
    const { getModels } = require('../models');
    const models = await getModels();
    const user = await models.User.scope('withSpribeToken').findByPk(userId);
    
    if (!user || !user.isSpribeTokenValid()) {
      return res.json({ error: 'User not found or token invalid' });
    }
    
    // Generate multiple URL variations to test
    const baseParams = {
      user: user.user_id.toString(),
      token: user.spribe_token,
      currency: 'USD',
      lang: 'en'
    };
    
    const urlVariations = {
      // Variation 1: With operator as client ID
      withClientId: `https://dev-test.spribe.io/games/launch/${gameId}?${new URLSearchParams({
        ...baseParams,
        operator: process.env.SPRIBE_CLIENT_ID,
        callback_url: 'https://strike.atsproduct.in/api/spribe'
      }).toString()}`,
      
      // Variation 2: With operator as 'strike'  
      withStrikeOperator: `https://dev-test.spribe.io/games/launch/${gameId}?${new URLSearchParams({
        ...baseParams,
        operator: 'strike',
        callback_url: 'https://strike.atsproduct.in/api/spribe'
      }).toString()}`,
      
      // Variation 3: Minimal parameters
      minimal: `https://dev-test.spribe.io/games/launch/${gameId}?${new URLSearchParams({
        user: user.user_id.toString(),
        token: user.spribe_token,
        currency: 'USD',
        operator: process.env.SPRIBE_CLIENT_ID
      }).toString()}`,
      
      // Variation 4: Different callback URL format
      altCallback: `https://dev-test.spribe.io/games/launch/${gameId}?${new URLSearchParams({
        ...baseParams,
        operator: process.env.SPRIBE_CLIENT_ID,
        callback_url: 'https://strike.atsproduct.in'
      }).toString()}`
    };
    
    res.json({
      message: 'Test these URL variations',
      variations: Object.keys(urlVariations).reduce((acc, key) => {
        acc[key] = urlVariations[key].replace(user.spribe_token, user.spribe_token.substring(0, 8) + '...');
        return acc;
      }, {}),
      instructions: [
        '1. Try each URL variation',
        '2. Check server logs for any callback requests',
        '3. Note which variation (if any) works or shows different behavior'
      ],
      debug_info: {
        userId: user.user_id,
        gameId,
        tokenValid: user.isSpribeTokenValid(),
        clientId: process.env.SPRIBE_CLIENT_ID ? 'SET' : 'MISSING',
        environment: process.env.NODE_ENV
      }
    });
    
  } catch (error) {
    res.json({ error: error.message });
  }
});

// STEP 3: Contact SPRIBE verification
router.get('/test/spribe-requirements', (req, res) => {
  res.json({
    message: 'Information to verify with SPRIBE support',
    your_domain: 'strike.atsproduct.in',
    your_callback_urls: [
      'https://strike.atsproduct.in/api/spribe/callback/auth',
      'https://strike.atsproduct.in/api/spribe/callback/info',
      'https://strike.atsproduct.in/api/spribe/callback/withdraw', 
      'https://strike.atsproduct.in/api/spribe/callback/deposit',
      'https://strike.atsproduct.in/api/spribe/callback/rollback'
    ],
    questions_for_spribe: [
      '1. Is our domain strike.atsproduct.in whitelisted in your system?',
      '2. Are our callback URLs correctly configured?',
      '3. What should the operator parameter be in launch URLs?',
      '4. Are we using the correct environment URLs (staging vs production)?',
      '5. Is our integration approved and active?',
      '6. Can you see any requests from our domain in your logs?'
    ],
    current_config: {
      client_id: process.env.SPRIBE_CLIENT_ID ? 'CONFIGURED' : 'MISSING',
      environment: process.env.NODE_ENV,
      launch_url: process.env.SPRIBE_GAME_LAUNCH_URL,
      api_url: process.env.SPRIBE_API_BASE_URL
    }
  });
});



// Since demo works but authenticated integration doesn't, 
// the issue is in the authentication parameters or SPRIBE configuration

/*
🎯 IDENTIFIED ISSUES TO CHECK:
*/

// ISSUE 1: Wrong Environment URLs
// You might be using staging URLs with production credentials or vice versa

// ISSUE 2: Incorrect Operator Parameter  
// The 'operator' in your launch URL might not match SPRIBE's configuration

// ISSUE 3: SPRIBE hasn't configured your callback URLs
// Even though your URLs are accessible, SPRIBE might not be calling them

// ISSUE 4: Wrong Client Credentials
// Your client ID/secret might be for a different environment

/*
🛠️ IMMEDIATE FIXES TO TRY:
*/

// FIX 1: Generate launch URL with different operator values
router.post('/test/operator-variations', async (req, res) => {
  try {
    const userId = req.body.user_id || 1;
    const gameId = req.body.game_id || 'dice';
    
    // Get user and ensure valid token
    const { getModels } = require('../models');
    const models = await getModels();
    const user = await models.User.scope('withSpribeToken').findByPk(userId);
    
    if (!user) {
      return res.json({ error: 'User not found' });
    }
    
    // Generate fresh token
    const token = user.generateSpribeToken();
    await user.save();
    
    const baseUrl = 'https://dev-test.spribe.io/games/launch';
    const baseParams = {
      user: user.user_id.toString(),
      token: token,
      currency: 'USD',
      lang: 'en'
    };
    
    // Try different operator values
    const operatorVariations = {
      // Try 1: Use your client ID as operator
      client_id: {
        ...baseParams,
        operator: process.env.SPRIBE_CLIENT_ID,
        callback_url: 'https://strike.atsproduct.in/api/spribe'
      },
      
      // Try 2: Use 'strike' as operator  
      strike: {
        ...baseParams,
        operator: 'strike',
        callback_url: 'https://strike.atsproduct.in/api/spribe'
      },
      
      // Try 3: Use domain as operator
      domain: {
        ...baseParams,
        operator: 'strike.atsproduct.in',
        callback_url: 'https://strike.atsproduct.in/api/spribe'
      },
      
      // Try 4: No callback URL (let SPRIBE use default)
      no_callback: {
        ...baseParams,
        operator: process.env.SPRIBE_CLIENT_ID
      },
      
      // Try 5: Different callback URL format
      alt_callback: {
        ...baseParams,
        operator: process.env.SPRIBE_CLIENT_ID,
        callback_url: 'https://strike.atsproduct.in'
      }
    };
    
    const testUrls = {};
    for (const [key, params] of Object.entries(operatorVariations)) {
      testUrls[key] = `${baseUrl}/${gameId}?${new URLSearchParams(params).toString()}`;
    }
    
    res.json({
      message: 'Test these operator variations - one should work',
      test_urls: Object.keys(testUrls).reduce((acc, key) => {
        acc[key] = testUrls[key].replace(token, token.substring(0, 8) + '...');
        return acc;
      }, {}),
      instructions: [
        '1. Try each URL in order',
        '2. Watch server logs for callback requests', 
        '3. The working URL will show the correct operator parameter',
        '4. If none work, the issue is SPRIBE-side configuration'
      ],
      debug_info: {
        userId: user.user_id,
        tokenGenerated: new Date().toISOString(),
        tokenExpires: user.spribe_token_expires_at,
        clientId: process.env.SPRIBE_CLIENT_ID || 'NOT_SET',
        environment: process.env.NODE_ENV
      }
    });
    
  } catch (error) {
    res.json({ error: error.message });
  }
});

// FIX 2: Try production SPRIBE URLs instead of staging
router.post('/test/production-urls', async (req, res) => {
  try {
    const userId = req.body.user_id || 1;
    const gameId = req.body.game_id || 'dice';
    
    const { getModels } = require('../models');
    const models = await getModels();
    const user = await models.User.scope('withSpribeToken').findByPk(userId);
    
    if (!user) {
      return res.json({ error: 'User not found' });
    }
    
    const token = user.generateSpribeToken();
    await user.save();
    
    const urlVariations = {
      // Current staging URL
      staging: `https://dev-test.spribe.io/games/launch/${gameId}?${new URLSearchParams({
        user: user.user_id.toString(),
        token: token,
        currency: 'USD',
        operator: process.env.SPRIBE_CLIENT_ID,
        callback_url: 'https://strike.atsproduct.in/api/spribe'
      }).toString()}`,
      
      // Try production URL (if your credentials are for production)
      production: `https://api.spribe.io/games/launch/${gameId}?${new URLSearchParams({
        user: user.user_id.toString(),
        token: token,
        currency: 'USD', 
        operator: process.env.SPRIBE_CLIENT_ID,
        callback_url: 'https://strike.atsproduct.in/api/spribe'
      }).toString()}`
    };
    
    res.json({
      message: 'Test both staging and production URLs',
      urls: Object.keys(urlVariations).reduce((acc, key) => {
        acc[key] = urlVariations[key].replace(token, token.substring(0, 8) + '...');
        return acc;
      }, {}),
      note: 'Your credentials might be for production, not staging'
    });
    
  } catch (error) {
    res.json({ error: error.message });
  }
});

// FIX 3: Contact SPRIBE with exact requirements
router.get('/test/spribe-contact-info', (req, res) => {
  res.json({
    message: 'Send this exact information to SPRIBE support',
    subject: 'Integration Issue - Login Error Despite Accessible Callbacks',
    your_domain: 'strike.atsproduct.in',
    issue_description: 'Demo games work perfectly, but authenticated games show login error. No callback requests received.',
    
    working_demo_urls: [
      'https://demo.spribe.io/launch/aviator?currency=USD&lang=EN&return_url=https://strike.atsproduct.in/games',
      'https://demo.spribe.io/launch/dice?currency=USD&lang=EN&return_url=https://strike.atsproduct.in/games'
    ],
    
    failing_auth_urls: [
      'https://dev-test.spribe.io/games/launch/dice?user=1&token=...&currency=USD&operator=YOUR_CLIENT_ID&callback_url=https://strike.atsproduct.in/api/spribe'
    ],
    
    callback_urls_to_configure: [
      'https://strike.atsproduct.in/api/spribe/callback/auth',
      'https://strike.atsproduct.in/api/spribe/callback/info',
      'https://strike.atsproduct.in/api/spribe/callback/withdraw',
      'https://strike.atsproduct.in/api/spribe/callback/deposit', 
      'https://strike.atsproduct.in/api/spribe/callback/rollback'
    ],
    
    questions_for_spribe: [
      '1. What should the operator parameter be in our launch URLs?',
      '2. Are our callback URLs correctly configured in your system?',
      '3. Are we using the correct environment (staging vs production)?',
      '4. Can you see any requests from strike.atsproduct.in in your logs?',
      '5. Is our integration fully approved and active?'
    ],
    
    technical_proof: 'Callback URLs are externally accessible - curl tests show proper responses',
    
    next_steps: [
      '1. SPRIBE configures callback URLs in their system',
      '2. SPRIBE confirms correct operator parameter',
      '3. SPRIBE enables integration for strike.atsproduct.in domain',
      '4. Test integration again'
    ]
  });
});

/*
🎯 ROOT CAUSE ANALYSIS:

Since demo works but auth doesn't work, the issue is:

1. SPRIBE hasn't configured your callback URLs in their system
2. Wrong operator parameter in launch URL  
3. Your credentials are for different environment than URLs you're using
4. SPRIBE hasn't enabled your integration yet

The solution requires SPRIBE to configure their system correctly.
*/

module.exports = router;