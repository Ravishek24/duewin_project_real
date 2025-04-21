// routes/seamlessWalletRoutes.js
import express from 'express';
import {
  getGamesController,
  launchGameController,
  balanceCallbackController,
  debitCallbackController,
  creditCallbackController,
  rollbackCallbackController,
  addFreeRoundsController,
  removeFreeRoundsController
} from '../controllers/seamlessController.js';
import { auth, requireEmailVerification } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Protected routes (require authentication)
router.get('/games', auth, getGamesController);
router.get('/launch/:gameId', auth, requireEmailVerification, launchGameController);

// Admin-only routes
router.post('/freerounds/add', auth, requireEmailVerification, addFreeRoundsController);
router.post('/freerounds/remove', auth, requireEmailVerification, removeFreeRoundsController);

// Callback routes for game providers (no auth needed, validation done via signature)
router.get('/callback/balance', balanceCallbackController);
router.get('/callback/debit', debitCallbackController);
router.get('/callback/credit', creditCallbackController);
router.get('/callback/rollback', rollbackCallbackController);

export default router;