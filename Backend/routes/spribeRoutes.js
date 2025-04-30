// routes/spriteRoutes.js
import express from 'express';
import {
  getGamesController,
  getLaunchUrlController,
  authCallbackController,
  infoCallbackController,
  withdrawCallbackController,
  depositCallbackController,
  rollbackCallbackController
} from '../controllers/spribeController.js';
import { auth, requireEmailVerification } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Frontend routes (require authentication)
router.get('/games', auth, getGamesController);
router.get('/launch/:gameId', auth, requireEmailVerification, getLaunchUrlController);

// SPRIBE callback routes (don't require auth - they use their own signature validation)
router.post('/callback/auth', authCallbackController);
router.post('/callback/info', infoCallbackController);
router.post('/callback/withdraw', withdrawCallbackController);
router.post('/callback/deposit', depositCallbackController);
router.post('/callback/rollback', rollbackCallbackController);

export default router;