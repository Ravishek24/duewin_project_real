// routes/spribeRoutes.js - UPDATED
const express = require('express');
const {
  getGamesController,
  getLaunchUrlController,
  handleCallback,
  healthCheck
} = require('../controllers/spribeController');
const { auth, requirePhoneVerification } = require('../middlewares/authMiddleware');

const router = express.Router();

// Health check endpoint (public)
router.get('/health', healthCheck);

// Frontend routes (require authentication)
router.get('/games', auth, getGamesController);
router.get('/launch/:gameId', auth, getLaunchUrlController);

// Single unified callback endpoint for all Spribe API requests (public - secured via signature)
router.post('/callback', handleCallback);

// Legacy routes for backward compatibility (all route to unified callback)
// router.post('/auth', handleCallback);
// router.post('/info', handleCallback);
// router.post('/withdraw', handleCallback);
// router.post('/deposit', handleCallback);
// router.post('/rollback', handleCallback);

module.exports = router;