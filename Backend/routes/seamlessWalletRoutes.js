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
import { auth, requirePhoneVerification } from '../middlewares/authMiddleware.js';
import { validateSeamlessRequest } from '../middlewares/seamlessMiddleware.js';

const router = express.Router();

// Protected routes (require authentication)
router.get('/games', auth, getGamesController);
router.get('/launch/:gameId', auth, requirePhoneVerification, launchGameController);

// Admin-only routes
router.post('/freerounds/add', auth, requirePhoneVerification, addFreeRoundsController);
router.post('/freerounds/remove', auth, requirePhoneVerification, removeFreeRoundsController);

// Callback routes for game providers (validate signatures)
router.get('/callback/balance', validateSeamlessRequest, balanceCallbackController);
router.get('/callback/debit', validateSeamlessRequest, debitCallbackController);
router.get('/callback/credit', validateSeamlessRequest, creditCallbackController);
router.get('/callback/rollback', validateSeamlessRequest, rollbackCallbackController);

export default router;