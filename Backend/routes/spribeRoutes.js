// routes/spriteRoutes.js
const express = require('express');
const {
  getGamesController,
  getLaunchUrlController,
  authCallbackController,
  infoCallbackController,
  withdrawCallbackController,
  depositCallbackController,
  rollbackCallbackController
} = require('../controllers/spribeController');
const { auth, requirePhoneVerification } = require('../middlewares/authMiddleware');

const router = express.Router();

// Frontend routes (require authentication)
router.get('/games', auth, getGamesController);
router.get('/launch/:gameId', auth, requirePhoneVerification, getLaunchUrlController);

// SPRIBE callback routes (don't require auth - they use their own signature validation)
router.post('/callback/auth', authCallbackController);
router.post('/callback/info', infoCallbackController);
router.post('/callback/withdraw', withdrawCallbackController);
router.post('/callback/deposit', depositCallbackController);
router.post('/callback/rollback', rollbackCallbackController);

module.exports = router;