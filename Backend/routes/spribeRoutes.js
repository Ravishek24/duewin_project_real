// routes/spribeRoutes.js - COMPLETELY REWRITTEN TO MATCH SPRIBE SPEC

const express = require('express');
const router = express.Router();
const spribeService = require('../services/spribeService');
const { validateSpribeSignature } = require('../utils/spribeSignatureUtils');
const { getModels } = require('../models');
const spribeConfig = require('../config/spribeConfig');

// 🔥 FIXED: Authentication endpoint according to Spribe spec
router.post('/auth', async (req, res) => {
  try {
    console.log('🔐 ===== SPRIBE AUTH ENDPOINT =====');
    console.log('📦 Incoming request:', {
      headers: req.headers,
      body: req.body,
      ip: req.ip
    });

    // 🔥 CRITICAL: Validate Spribe signature first
    const signatureValid = validateSpribeSignature(req);
    if (!signatureValid) {
      console.error('❌ Invalid Spribe signature - request rejected');
      console.error('🔍 Debug info:', {
        hasHeaders: {
          clientId: !!req.headers['x-spribe-client-id'],
          timestamp: !!req.headers['x-spribe-client-ts'],
          signature: !!req.headers['x-spribe-client-signature']
        },
        environment: process.env.NODE_ENV,
        apiBaseUrl: spribeConfig.apiBaseUrl
      });
      const resp = { code: 413, message: 'Invalid Client-Signature' };
      console.log('🔙 Responding:', resp);
      return res.status(200).json(resp); // 🔥 FIXED: Always return HTTP 200
    }

    console.log('✅ Signature validation passed - processing auth request');

    const { user_token, session_token, platform, currency } = req.body;
    console.log('🔍 Auth parameters:', {
      user_token: user_token ? user_token.substring(0, 8) + '...' : null,
      session_token: session_token ? session_token.substring(0, 8) + '...' : null,
      platform,
      currency
    });

    // Validate required fields
    if (!user_token || !session_token) {
      console.error('❌ Missing required fields');
      const resp = { code: 401, message: 'User token is invalid' };
      console.log('🔙 Responding:', resp);
      return res.status(200).json(resp); // 🔥 FIXED: HTTP 200
    }

    // 🔥 FIXED: Find user by user_token (this is the token we generated during launch)
    const models = await getModels();
    
    // Find session by user_token (this is our launch token)
    const session = await models.SpribeGameSession.findOne({
      where: {
        launch_token: user_token,
        status: 'active'
      }
    });

    if (!session) {
      console.error('❌ Session not found for user_token');
      const resp = { code: 401, message: 'User token is invalid' };
      console.log('🔙 Responding:', resp);
      return res.status(200).json(resp); // 🔥 FIXED: HTTP 200
    }

    console.log('✅ Session found:', {
      sessionId: session.id,
      userId: session.user_id,
      gameId: session.game_id
    });

    // Update session with SPRIBE session token
    await session.update({
      session_token: session_token,
      platform: platform || 'desktop',
      last_activity: new Date()
    });

    // Get user
    const user = await models.User.findByPk(session.user_id);
    if (!user) {
      console.error('❌ User not found');
      const resp = { code: 401, message: 'User token is invalid' };
      console.log('🔙 Responding:', resp);
      return res.status(200).json(resp); // 🔥 FIXED: HTTP 200
    }

    // Get balance
    const thirdPartyWalletService = require('../services/thirdPartyWalletService');
    const walletResult = await thirdPartyWalletService.getBalance(user.user_id, currency || 'USD');
    console.log('💵 Wallet result:', walletResult);

    if (!walletResult.success) {
      console.error('❌ Failed to get balance:', walletResult);
      const resp = { code: 500, message: 'Internal error' };
      console.log('🔙 Responding:', resp);
      return res.status(200).json(resp); // 🔥 FIXED: HTTP 200
    }

    // 🔥 FIXED: Format balance according to Spribe spec (USD: $1 = 1000 units)
    const formattedBalance = Math.round(walletResult.balance * 1000);

    const resp = {
      code: 200,
      message: 'Success',
      data: {
        user_id: user.user_id.toString(),
        username: user.user_name,
        balance: formattedBalance,
        currency: currency || 'USD'
      }
    };
    console.log('🔙 Responding:', resp);
    return res.status(200).json(resp);

  } catch (error) {
    console.error('❌ Auth error:', error);
    const resp = { code: 500, message: 'Internal error' };
    console.log('🔙 Responding:', resp);
    return res.status(200).json(resp); // 🔥 FIXED: HTTP 200
  }
});

// 🔥 FIXED: Player info endpoint
router.post('/info', async (req, res) => {
  try {
    console.log('ℹ️ ===== SPRIBE INFO ENDPOINT =====');
    console.log('📦 Incoming request:', {
      headers: req.headers,
      body: req.body,
      ip: req.ip
    });

    // Validate signature
    const signatureValid = validateSpribeSignature(req);
    if (!signatureValid) {
      const resp = { code: 413, message: 'Invalid Client-Signature', data: null };
      console.log('🔙 Responding:', resp);
      return res.status(200).json(resp);
    }

    const { user_id, session_token, currency } = req.body;

    if (!user_id || !session_token) {
      const resp = { code: 401, message: 'User token is invalid', data: null };
      console.log('🔙 Responding:', resp);
      return res.status(200).json(resp);
    }

    const models = await getModels();
    // Find user
    const user = await models.User.findByPk(user_id);
    if (!user) {
      const resp = { code: 401, message: 'User token is invalid', data: null };
      console.log('🔙 Responding:', resp);
      return res.status(200).json(resp);
    }

    // Get balance
    const thirdPartyWalletService = require('../services/thirdPartyWalletService');
    const walletResult = await thirdPartyWalletService.getBalance(user.user_id, currency || 'USD');

    if (!walletResult.success) {
      const resp = { code: 500, message: 'Internal error', data: null };
      console.log('🔙 Responding:', resp);
      return res.status(200).json(resp);
    }

    const formattedBalance = Math.round(walletResult.balance * 1000);

    const resp = {
      code: 200,
      message: 'Success',
      data: {
        user_id: user.user_id.toString(),
        username: user.user_name,
        balance: formattedBalance,
        currency: currency || 'USD'
      }
    };
    console.log('🔙 Responding:', resp);
    return res.status(200).json(resp);
  } catch (err) {
    const resp = { code: 500, message: 'Internal server error', data: null };
    console.log('🔙 Responding:', resp);
    return res.status(200).json(resp);
  }
});

// 🔥 ADDED: GET route for withdraw endpoint (for callback URL testing)
router.get('/withdraw', async (req, res) => {
  try {
    console.log('💸 ===== SPRIBE WITHDRAW GET ENDPOINT (TEST) =====');
    console.log('📦 Incoming GET request:', {
      headers: req.headers,
      query: req.query,
      ip: req.ip
    });

    // Return a simple response for GET requests (callback URL testing)
    const resp = { 
      code: 200, 
      message: 'Withdraw endpoint is accessible',
      method: 'GET',
      note: 'Use POST method for actual withdrawals'
    };
    console.log('🔙 Responding to GET:', resp);
    return res.status(200).json(resp);
  } catch (error) {
    console.error('❌ Withdraw GET error:', error);
    const resp = { code: 500, message: 'Internal error' };
    console.log('🔙 Responding:', resp);
    return res.status(200).json(resp);
  }
});

// 🔥 FIXED: Withdraw endpoint (bet) - POST method
router.post('/withdraw', async (req, res) => {
  try {
    console.log('💸 ===== SPRIBE WITHDRAW ENDPOINT =====');
    console.log('📦 Incoming request:', {
      headers: req.headers,
      body: req.body,
      ip: req.ip
    });

    // Validate signature
    const signatureValid = validateSpribeSignature(req);
    if (!signatureValid) {
      const resp = { code: 413, message: 'Invalid Client-Signature', data: null };
      console.log('🔙 Responding:', resp);
      return res.status(200).json(resp);
    }

    const result = await spribeService.handleWithdraw(req.body);

    if ([401, 402, 403, 408, 413, 500].includes(result.code)) {
      const resp = { code: result.code, message: result.message, data: null };
      console.log('🔙 Responding:', resp);
      return res.status(200).json(resp);
    }
    if (result.code === 409) {
      const resp = { code: 409, message: result.message, data: result.data };
      console.log('🔙 Responding:', resp);
      return res.status(200).json(resp);
    }
    // Success
    const resp = { code: 200, message: 'Success', data: result.data };
    console.log('🔙 Responding:', resp);
    return res.status(200).json(resp);
  } catch (err) {
    const resp = { code: 500, message: 'Internal server error', data: null };
    console.log('🔙 Responding:', resp);
    return res.status(200).json(resp);
  }
});

// 🔥 ADDED: GET route for deposit endpoint (for callback URL testing)
router.get('/deposit', async (req, res) => {
  try {
    console.log('💰 ===== SPRIBE DEPOSIT GET ENDPOINT (TEST) =====');
    console.log('📦 Incoming GET request:', {
      headers: req.headers,
      query: req.query,
      ip: req.ip
    });

    // Return a simple response for GET requests (callback URL testing)
    const resp = { 
      code: 200, 
      message: 'Deposit endpoint is accessible',
      method: 'GET',
      note: 'Use POST method for actual deposits'
    };
    console.log('🔙 Responding to GET:', resp);
    return res.status(200).json(resp);
  } catch (error) {
    console.error('❌ Deposit GET error:', error);
    const resp = { code: 500, message: 'Internal error' };
    console.log('🔙 Responding:', resp);
    return res.status(200).json(resp);
  }
});

// 🔥 FIXED: Deposit endpoint (win) - POST method
router.post('/deposit', async (req, res) => {
  try {
    console.log('💰 ===== SPRIBE DEPOSIT ENDPOINT =====');
    console.log('📦 Incoming request:', {
      headers: req.headers,
      body: req.body,
      ip: req.ip
    });

    // Validate signature
    const signatureValid = validateSpribeSignature(req);
    if (!signatureValid) {
      const resp = { code: 413, message: 'Invalid Client-Signature', data: null };
      console.log('🔙 Responding:', resp);
      return res.status(200).json(resp);
    }

    const result = await spribeService.handleDeposit(req.body);

    if ([401, 402, 403, 408, 413, 500].includes(result.code)) {
      const resp = { code: result.code, message: result.message, data: null };
      console.log('🔙 Responding:', resp);
      return res.status(200).json(resp);
    }
    if (result.code === 409) {
      const resp = { code: 409, message: result.message, data: result.data };
      console.log('🔙 Responding:', resp);
      return res.status(200).json(resp);
    }
    // Success
    const resp = { code: 200, message: 'Success', data: result.data };
    console.log('🔙 Responding:', resp);
    return res.status(200).json(resp);
  } catch (err) {
    const resp = { code: 500, message: 'Internal server error', data: null };
    console.log('🔙 Responding:', resp);
    return res.status(200).json(resp);
  }
});

// 🔥 ADDED: GET route for rollback endpoint (for callback URL testing)
router.get('/rollback', async (req, res) => {
  try {
    console.log('🔄 ===== SPRIBE ROLLBACK GET ENDPOINT (TEST) =====');
    console.log('📦 Incoming GET request:', {
      headers: req.headers,
      query: req.query,
      ip: req.ip
    });

    // Return a simple response for GET requests (callback URL testing)
    const resp = { 
      code: 200, 
      message: 'Rollback endpoint is accessible',
      method: 'GET',
      note: 'Use POST method for actual rollbacks'
    };
    console.log('🔙 Responding to GET:', resp);
    return res.status(200).json(resp);
  } catch (error) {
    console.error('❌ Rollback GET error:', error);
    const resp = { code: 500, message: 'Internal error' };
    console.log('🔙 Responding:', resp);
    return res.status(200).json(resp);
  }
});

// 🔥 FIXED: Rollback endpoint - POST method
router.post('/rollback', async (req, res) => {
  try {
    console.log('🔄 ===== SPRIBE ROLLBACK ENDPOINT =====');
    console.log('📦 Incoming request:', {
      headers: req.headers,
      body: req.body,
      ip: req.ip
    });

    // Validate signature
    const signatureValid = validateSpribeSignature(req);
    if (!signatureValid) {
      const resp = { code: 413, message: 'Invalid Client-Signature', data: null };
      console.log('🔙 Responding:', resp);
      return res.status(200).json(resp);
    }

    const result = await spribeService.handleRollback(req.body);

    if ([401, 402, 403, 408, 413, 500].includes(result.code)) {
      const resp = { code: result.code, message: result.message, data: null };
      console.log('🔙 Responding:', resp);
      return res.status(200).json(resp);
    }
    if (result.code === 409) {
      const resp = { code: 409, message: result.message, data: result.data };
      console.log('🔙 Responding:', resp);
      return res.status(200).json(resp);
    }
    // Success
    const resp = { code: 200, message: 'Success', data: result.data };
    console.log('🔙 Responding:', resp);
    return res.status(200).json(resp);
  } catch (err) {
    const resp = { code: 500, message: 'Internal server error', data: null };
    console.log('🔙 Responding:', resp);
    return res.status(200).json(resp);
  }
});

// 🔥 ADDED: Game launch endpoint
router.get('/launch/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'userId is required'
      });
    }

    const result = await spribeService.getGameLaunchUrl(gameId, userId, req);
    
    if (result.success) {
      return res.json({
        success: true,
        url: result.url,
        sessionId: result.sessionId
      });
    } else {
      return res.status(400).json(result);
    }

  } catch (error) {
    console.error('❌ Launch error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// 🔥 ADDED: Get games list
router.get('/games', async (req, res) => {
  try {
    const result = await spribeService.listGames();
    return res.json(result);
  } catch (error) {
    console.error('❌ Games list error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get games list'
    });
  }
});

module.exports = router;