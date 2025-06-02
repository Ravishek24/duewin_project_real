// routes/seamlessRoutes.js - FIXED VERSION
const express = require('express');
const router = express.Router();
const seamlessController = require('../controllers/seamlessController');
const { auth } = require('../middlewares/authMiddleware');
const { validateSeamlessRequest, logSeamlessRequest } = require('../middlewares/seamlessMiddleware');

// Debug route for testing
router.get('/debug', (req, res) => {
  console.log('=== DEBUG ROUTE HIT ===');
  console.log('Request path:', req.path);
  console.log('Request query:', req.query);
  console.log('Request headers:', req.headers);
  res.json({
    success: true,
    message: 'Debug route hit',
    path: req.path,
    query: req.query,
    headers: req.headers,
    env: {
      NODE_ENV: process.env.NODE_ENV,
      SEAMLESS_API_LOGIN: process.env.SEAMLESS_API_LOGIN,
      SEAMLESS_SALT_KEY: process.env.SEAMLESS_SALT_KEY ? 'SET' : 'NOT SET'
    }
  });
});

// Test signature validation
router.get('/test-signature', (req, res) => {
  const { testSignatureValidation } = require('../utils/seamlessUtils');
  const result = testSignatureValidation();
  res.json({
    success: true,
    signatureTest: result,
    message: result ? 'Signature validation working' : 'Signature validation failed'
  });
});

// PROTECTED ROUTES (require authentication)
router.get('/games', auth, seamlessController.getGamesList);
router.post('/games/refresh', auth, seamlessController.refreshGamesList);
router.get('/launch/:gameId', auth, seamlessController.launchGameController);
router.get('/iframe/:gameId', auth, seamlessController.serveGameInIframeController);
router.get('/redirect/:gameId', auth, seamlessController.redirectToGameController);
router.get('/test', auth, seamlessController.testPageController);
router.get('/games/filtered', auth, seamlessController.getFilteredGamesController);

// Free rounds routes (admin only)
router.post('/freerounds/add', auth, seamlessController.addFreeRoundsController);
router.post('/freerounds/remove', auth, seamlessController.removeFreeRoundsController);

// CRITICAL: CALLBACK ROUTES (NO AUTH REQUIRED - called by game provider)
// These routes are called by the game provider and should NOT require authentication
// Add logging middleware for debugging
router.use('/callback', logSeamlessRequest);

// Main unified callback route - this is what the provider calls
router.all('/callback', seamlessController.unifiedCallbackController);

// Individual callback routes for backward compatibility (optional)
router.get('/callback/balance', seamlessController.balanceCallbackController);
router.get('/callback/debit', seamlessController.debitCallbackController);  
router.get('/callback/credit', seamlessController.creditCallbackController);
router.get('/callback/rollback', seamlessController.rollbackCallbackController);
router.post('/callback/unified', seamlessController.unifiedCallbackController);

// Health check route for the callback endpoint
router.get('/callback/health', (req, res) => {
  res.json({
    success: true,
    message: 'Seamless callback endpoint is healthy',
    timestamp: new Date().toISOString(),
    endpoint: req.originalUrl
  });
});

module.exports = router;