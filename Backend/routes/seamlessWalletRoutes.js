// routes/seamlessWalletRoutes.js - FIXED VERSION
const express = require('express');
const {
  getGamesController,
  launchGameController,
  balanceCallbackController,
  debitCallbackController,
  creditCallbackController,
  rollbackCallbackController,
  addFreeRoundsController,
  removeFreeRoundsController,
  unifiedCallbackController,
  serveGameInIframeController,
  redirectToGameController,
  testPageController,
  getFilteredGamesController
} = require('../controllers/seamlessController');
const { auth } = require('../middlewares/authMiddleware');
const { validateSeamlessRequest } = require('../middlewares/seamlessMiddleware');
const thirdPartyWalletService = require('../services/thirdPartyWalletService');
const seamlessWalletService = require('../services/seamlessWalletService');
const User = require('../models/User');
const SeamlessGameSession = require('../models/SeamlessGameSession');

const router = express.Router();

// Protected routes (require authentication)
router.get('/games', auth, getGamesController);
router.get('/games/filtered', auth, getFilteredGamesController);
router.get('/launch/:gameId', auth, launchGameController);

// New routes for server-side game embedding to help bypass Cloudflare restrictions
router.get('/iframe/:gameId', auth, serveGameInIframeController);
router.get('/redirect/:gameId', auth, redirectToGameController);

// Debug routes - direct access to the game URL without middleware or frontend formatting
router.get('/debug-game/:gameId', auth, async (req, res) => {
  try {
    const { gameId } = req.params;
    const userId = req.user.user_id;
    
    console.log(`Debug: Getting game URL for user ${userId}, game ${gameId}`);
    
    // Get user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Generate consistent password
    const userPassword = `pwd${user.user_id}${process.env.SEAMLESS_PASSWORD_SALT || 'default_salt'}`;
    
    // Make direct API call to provider
    const requestData = {
      api_login: process.env.SEAMLESS_API_LOGIN || 'flywin_mc_s',
      api_password: process.env.SEAMLESS_API_PASSWORD || 'NbRWpbhtEVf8wIYW5G',
      method: 'getGame',
      lang: 'en',
      user_username: `player${user.user_id}`,
      user_password: userPassword,
      gameid: gameId,
      homeurl: process.env.FRONTEND_URL || 'http://localhost:3000',
      cashierurl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/wallet`,
      play_for_fun: 0,
      currency: 'EUR'
    };
    
    console.log('Debug: Making direct API call to game provider');
    console.log('Debug: Request data', JSON.stringify(requestData));
    
    const axios = require('axios');
    const response = await axios.post(
      'https://stage.game-program.com/api/seamless/provider',
      requestData,
      { timeout: 30000 }
    );
    
    console.log('Debug: Provider response', JSON.stringify(response.data));
    
    if (response.data.error !== 0) {
      return res.status(400).json({
        success: false,
        message: `Provider error: ${response.data.message || 'Unknown error'} (${response.data.error})`,
        providerResponse: response.data
      });
    }

    // Store game session info
    await SeamlessGameSession.create({
      user_id: userId,
      remote_id: `player${user.user_id}`,
      provider: gameId.includes('_') ? gameId.split('_')[0] : 'unknown',
      session_token: response.data.sessionid,
      game_id: gameId.includes('_') ? gameId.split('_')[1] : gameId,
      game_id_hash: gameId,
      is_active: true,
      ip_address: req.ip,
      game_type: gameId.includes('_') ? gameId.split('_')[0] : 'unknown',
      session_id: response.data.sessionid,
      game_session_id: response.data.gamesession_id,
      game_url: response.data.url || response.data.response,
      user_password: userPassword
    });

    return res.status(200).json({
      success: true,
      gameUrl: response.data.url || response.data.response,
      sessionId: response.data.sessionid,
      gameSessionId: response.data.gamesession_id
    });
  } catch (error) {
    console.error('Debug: Error getting game URL:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to get game URL',
      error: error.response?.data || error.message
    });
  }
});

// Test page to help debug and demonstrate seamless integration
router.get('/test', auth, testPageController);

// Route to transfer funds to third-party wallet
// FIXED: Ensure this route handler is properly async
router.post('/transfer-to-third-party', auth, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const result = await thirdPartyWalletService.transferToThirdPartyWallet(userId);
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Funds transferred successfully to third-party wallet',
        ...result
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to transfer funds'
      });
    }
  } catch (error) {
    console.error('Error transferring to third-party wallet:', error);
    res.status(500).json({
      success: false,
      message: 'Server error transferring funds'
    });
  }
});

// Admin-only routes
router.post('/freerounds/add', auth, addFreeRoundsController);
router.post('/freerounds/remove', auth, removeFreeRoundsController);

// New unified callback route for game providers
router.get('/callback', validateSeamlessRequest, unifiedCallbackController);

// Legacy callback routes - commented out but kept for reference
// router.get('/callback/balance', validateSeamlessRequest, balanceCallbackController);
// router.get('/callback/debit', validateSeamlessRequest, debitCallbackController);
// router.get('/callback/credit', validateSeamlessRequest, creditCallbackController);
// router.get('/callback/rollback', validateSeamlessRequest, rollbackCallbackController);

module.exports = router;