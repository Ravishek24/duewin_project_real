// routes/seamlessWalletRoutes.js
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
const { auth, requirePhoneVerification } = require('../middlewares/authMiddleware');
const { validateSeamlessRequest } = require('../middlewares/seamlessMiddleware');
const thirdPartyWalletService = require('../services/thirdPartyWalletService');
const seamlessWalletService = require('../services/seamlessWalletService');
const User = require('../models/User');

const router = express.Router();

// Protected routes (require authentication)
router.get('/games', auth, getGamesController);
router.get('/games/filtered', auth, getFilteredGamesController);
router.get('/launch/:gameId', auth, requirePhoneVerification, launchGameController);

// New routes for server-side game embedding to help bypass Cloudflare restrictions
router.get('/iframe/:gameId', auth, requirePhoneVerification, serveGameInIframeController);
router.get('/redirect/:gameId', auth, requirePhoneVerification, redirectToGameController);

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
    
    // Make direct API call to provider
    const requestData = {
      api_login: process.env.SEAMLESS_API_LOGIN || 'flywin_mc_s',
      api_password: process.env.SEAMLESS_API_PASSWORD || 'NbRWpbhtEVf8wIYW5G',
      method: 'getGame',
      lang: 'en',
      user_username: `player${user.user_id}`,
      user_password: `pwd${user.user_id}${Date.now().toString(36)}`,
      gameid: gameId,
      homeurl: 'https://strike.atsproduct.in',
      cashierurl: 'https://strike.atsproduct.in/wallet',
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
    
    // Success - send complete info
    return res.status(200).json({
      success: true,
      gameUrl: response.data.url,
      sessionId: response.data.sessionid,
      gameSessionId: response.data.gamesession_id,
      raw: response.data
    });
  } catch (error) {
    console.error('Error in debug game endpoint:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
      stack: error.stack,
      raw: error.response ? error.response.data : null
    });
  }
});

// Test page to help debug and demonstrate seamless integration
router.get('/test', auth, testPageController);

// Route to transfer funds to third-party wallet
router.post('/transfer-to-third-party', auth, requirePhoneVerification, async (req, res) => {
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
router.post('/freerounds/add', auth, requirePhoneVerification, addFreeRoundsController);
router.post('/freerounds/remove', auth, requirePhoneVerification, removeFreeRoundsController);

// New unified callback route for game providers
router.get('/callback', validateSeamlessRequest, unifiedCallbackController);

// Legacy callback routes - commented out but kept for reference
// router.get('/callback/balance', validateSeamlessRequest, balanceCallbackController);
// router.get('/callback/debit', validateSeamlessRequest, debitCallbackController);
// router.get('/callback/credit', validateSeamlessRequest, creditCallbackController);
// router.get('/callback/rollback', validateSeamlessRequest, rollbackCallbackController);

module.exports = router;