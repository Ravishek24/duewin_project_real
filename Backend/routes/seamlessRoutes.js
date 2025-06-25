// routes/seamlessRoutes.js - FIXED VERSION
const express = require('express');
const router = express.Router();
const seamlessController = require('../controllers/seamlessController');
const { auth } = require('../middlewares/authMiddleware');
const { validateSeamlessRequest, logSeamlessRequest } = require('../middlewares/seamlessMiddleware');

// CRITICAL: Callback test route (should be first)
router.get('/callback-test', (req, res) => {
  console.log('=== CALLBACK TEST HIT ===');
  console.log('Full URL:', req.originalUrl);
  console.log('Base URL:', req.baseUrl);
  console.log('Path:', req.path);
  console.log('Query:', req.query);
  console.log('Headers:', req.headers);
  console.log('IP:', req.ip);
  console.log('Method:', req.method);
  
  res.status(200).json({
    status: '200',
    message: 'Callback endpoint reachable',
    timestamp: new Date().toISOString(),
    url: {
      full: req.originalUrl,
      base: req.baseUrl,
      path: req.path
    },
    query: req.query,
    ip: req.ip,
    method: req.method
  });
});

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
// router.get('/callback/balance', seamlessController.balanceCallbackController);
// router.get('/callback/debit', seamlessController.debitCallbackController);  
// router.get('/callback/credit', seamlessController.creditCallbackController);
// router.get('/callback/rollback', seamlessController.rollbackCallbackController);
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

// Debug route to list all available routes
router.get('/debug/routes', (req, res) => {
  const routes = [];
  router.stack.forEach((middleware) => {
    if (middleware.route) {
      // Routes registered directly on the router
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      // Router middleware
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          routes.push({
            path: handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });

  res.json({
    success: true,
    message: 'Available routes',
    routes: routes,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl
  });
});

// === HOT GAMES ENDPOINT ===
const hotGameIds = [
  "163330", "162656", "159435", "165104", "165102", "165122", "156612", "156980", "157346",
  "163030", "164558", "159200", "169812", "167124", "133151", "114603", "160689", "165040",
  "164150", "170768", "162424", "169658"
];
const hotGameHashes = [
  "spribe_mines", "upgaming_dice", "spribe_dice", "spribe_plinko", "upgaming_plinko",
  "spribe_hilo", "upgaming_hilo", "spribe_keno", "upgaming_keno"
];

router.get('/hot-games', auth, async (req, res) => {
  try {
    const seamlessService = require('../services/seamlessService');
    const result = await seamlessService.getGamesList({ limit: 50000 });
    const allGames = result.games || [];
    const hotGames = allGames.filter(
      game => hotGameIds.includes(game.id) || hotGameHashes.includes(game.id_hash)
    );
    res.json({
      success: true,
      games: hotGames,
      count: hotGames.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;