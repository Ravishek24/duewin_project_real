// routes/spribeRoutes.js - FIXED ROUTES

const express = require('express');
const router = express.Router();
const spribeService = require('../services/spribeService');
const { SpribeGameSession, User } = require('../models');

// 🔥 COMPLETELY FIXED AUTH ENDPOINT
// routes/spribeRoutes.js - FINAL FIX FOR USER ID FIELD

router.post('/auth', async (req, res) => {
  try {
    console.log('🔐 ===== SPRIBE AUTH ENDPOINT =====');
    console.log('📦 Request details:', {
      headers: req.headers,
      query: req.query,
      body: req.body,
      ip: req.ip,
      timestamp: new Date().toISOString()
    });

    const { user_token, session_token, platform, currency } = req.body;

    console.log('🔍 Processing auth with:', {
      user_token: user_token ? user_token.substring(0, 8) + '...' : null,
      session_token: session_token ? session_token.substring(0, 8) + '...' : null,
      platform,
      currency
    });

    if (!user_token || !session_token) {
      console.error('❌ Missing required tokens');
      return res.status(200).json({
        code: 401,
        message: 'User token is invalid'
      });
    }

    const { getModels } = require('../models');
    const models = await getModels();
    
    const session = await models.SpribeGameSession.findOne({
      where: {
        launch_token: user_token,
        status: 'active'
      }
    });

    console.log('🔍 Session lookup result:', {
      found: !!session,
      sessionId: session?.id,
      userId: session?.user_id,
      searchToken: user_token.substring(0, 8) + '...'
    });

    if (!session) {
      console.error('❌ Session not found for user_token');
      return res.status(200).json({
        code: 401,
        message: 'User token is invalid'
      });
    }

    await session.update({
      session_token: session_token,
      platform: platform || 'desktop',
      last_activity: new Date()
    });

    console.log('✅ Session updated with SPRIBE session token');

    // 🔥 FIX: Use session.user_id to find user (since that's the foreign key)
    const user = await models.User.findByPk(session.user_id);
    
    console.log('👤 User lookup details:', {
      sessionUserId: session.user_id,
      userFound: !!user,
      userKeys: user ? Object.keys(user.dataValues) : null
    });

    if (!user) {
      console.error('❌ User not found for session');
      return res.status(200).json({
        code: 401,
        message: 'User token is invalid'
      });
    }

    // 🔥 CRITICAL FIX: The primary key is 'user_id', not 'id'
    const userId = user.user_id; // ✅ This is the correct primary key field
    const username = user.user_name; // ✅ This is the correct username field

    console.log('👤 User found:', {
      userId: userId,
      username: username,
      sessionUserId: session.user_id,
      fieldsMatch: userId === session.user_id
    });

    // 🔥 FIX: Use the correct user ID (user.user_id) for balance lookup
    const thirdPartyWalletService = require('../services/thirdPartyWalletService');
    const walletResult = await thirdPartyWalletService.getBalance(userId, currency || 'USD');

    console.log('💰 Balance lookup result:', {
      success: walletResult.success,
      balance: walletResult.balance,
      error: walletResult.error || walletResult.message,
      userId: userId
    });

    if (!walletResult.success) {
      console.error('❌ Failed to get balance:', walletResult.error || walletResult.message);
      return res.status(200).json({
        code: 500,
        message: 'Internal error'
      });
    }

    // Format balance for SPRIBE (USD: $1 = 1000 units)
    const formattedBalance = Math.round(walletResult.balance * 1000);

    console.log('💰 Balance formatted:', {
      original: walletResult.balance,
      formatted: formattedBalance,
      currency: currency || 'USD'
    });

    // 🔥 FIX: Use correct user ID in response
    const response = {
      code: 200,
      message: 'Success',
      data: {
        user_id: userId.toString(), // ✅ Using user.user_id
        username: username, // ✅ Using user.user_name
        balance: formattedBalance,
        currency: currency || 'USD'
      }
    };

    console.log('✅ Auth successful, sending response:', {
      code: response.code,
      userId: response.data.user_id,
      username: response.data.username,
      balance: response.data.balance,
      currency: response.data.currency
    });

    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Auth error:', error);
    console.error('❌ Error stack:', error.stack);
    return res.status(200).json({
      code: 500,
      message: 'Internal error'
    });
  }
});

// 🔥 FIX 2: Info endpoint
// routes/spribeRoutes.js - FIX ALL OTHER ENDPOINTS TOO

// 🔥 FIX: Info endpoint
router.post('/info', async (req, res) => {
  try {
    console.log('ℹ️ ===== SPRIBE INFO ENDPOINT =====');
    console.log('📦 Request:', req.body);

    const { user_id, session_token, currency } = req.body;

    if (!user_id || !session_token) {
      return res.status(200).json({
        code: 401,
        message: 'User token is invalid'
      });
    }

    // 🔥 FIX: Use correct user lookup
    const { getModels } = require('../models');
    const models = await getModels();
    
    // Find user by user_id (which is the primary key)
    const user = await models.User.findOne({
      where: { user_id: user_id } // ✅ Use user_id as the field name
    });

    if (!user) {
      return res.status(200).json({
        code: 401,
        message: 'User token is invalid'
      });
    }

    // Get balance using the correct user ID
    const thirdPartyWalletService = require('../services/thirdPartyWalletService');
    const walletResult = await thirdPartyWalletService.getBalance(user.user_id, currency || 'USD');

    if (!walletResult.success) {
      return res.status(200).json({
        code: 500,
        message: 'Internal error'
      });
    }

    const formattedBalance = Math.round(walletResult.balance * 1000);

    return res.status(200).json({
      code: 200,
      message: 'Success',
      data: {
        user_id: user.user_id.toString(), // ✅ Use user.user_id
        username: user.user_name, // ✅ Use user.user_name
        balance: formattedBalance,
        currency: currency || 'USD'
      }
    });

  } catch (error) {
    console.error('❌ Info error:', error);
    return res.status(200).json({
      code: 500,
      message: 'Internal error'
    });
  }
});

// 🔥 FIX 3: Withdraw endpoint (when user places bet)
router.post('/withdraw', async (req, res) => {
  try {
    console.log('💸 ===== SPRIBE WITHDRAW ENDPOINT =====');
    console.log('📦 Request:', req.body);

    const result = await spribeService.handleWithdraw(req.body);
    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ Withdraw error:', error);
    return res.status(200).json({
      code: 500,
      message: 'Internal error'
    });
  }
});

// 🔥 FIX 4: Deposit endpoint (when user wins)
router.post('/deposit', async (req, res) => {
  try {
    console.log('💰 ===== SPRIBE DEPOSIT ENDPOINT =====');
    console.log('📦 Request:', req.body);

    const result = await spribeService.handleDeposit(req.body);
    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ Deposit error:', error);
    return res.status(200).json({
      code: 500,
      message: 'Internal error'
    });
  }
});

// 🔥 FIX 5: Rollback endpoint
router.post('/rollback', async (req, res) => {
  try {
    console.log('🔄 ===== SPRIBE ROLLBACK ENDPOINT =====');
    console.log('📦 Request:', req.body);

    const result = await spribeService.handleRollback(req.body);
    return res.status(200).json(result);

  } catch (error) {
    console.error('❌ Rollback error:', error);
    return res.status(200).json({
      code: 500,
      message: 'Internal error'
    });
  }
});

// Game launch endpoint
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
        sessionId: result.sessionId,
        warningMessage: result.warningMessage
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

// Get games list
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