const express = require('express');
const router = express.Router();
const seamlessController = require('../controllers/seamlessController');

// Debug route
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
    headers: req.headers
  });
});

// Game list routes
router.get('/games', seamlessController.getGamesList);
router.post('/games/refresh', seamlessController.refreshGamesList);

// Game launch routes
router.get('/launch/:gameId', seamlessController.launchGameController);
router.get('/iframe/:gameId', seamlessController.serveGameInIframeController);
router.get('/redirect/:gameId', seamlessController.redirectToGameController);

// Unified callback route for game provider
router.all('/callback', seamlessController.unifiedCallbackController);

// Individual callback routes (for backward compatibility)
router.get('/callback/balance', seamlessController.balanceCallbackController);
router.get('/callback/debit', seamlessController.debitCallbackController);
router.get('/callback/credit', seamlessController.creditCallbackController);
router.get('/callback/rollback', seamlessController.rollbackCallbackController);
router.post('/callback/unified', seamlessController.unifiedCallbackController);

// Free rounds routes
router.post('/freerounds/add', seamlessController.addFreeRoundsController);
router.post('/freerounds/remove', seamlessController.removeFreeRoundsController);

// Test routes
router.get('/test', seamlessController.testPageController);
router.get('/games/filtered', seamlessController.getFilteredGamesController);

module.exports = router; 