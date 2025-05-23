// routes/spribeRoutes.js
const express = require('express');
const {
  getGamesController,
  getLaunchUrlController,
  handleCallback
} = require('../controllers/spribeController');
const { auth, requirePhoneVerification } = require('../middlewares/authMiddleware');

const router = express.Router();

// Frontend routes (require authentication)
router.get('/games', auth, getGamesController);
router.get('/launch/:gameId', auth, requirePhoneVerification, getLaunchUrlController);

// Single unified callback endpoint for all Spribe API requests
router.post('/callback', handleCallback);

module.exports = router;