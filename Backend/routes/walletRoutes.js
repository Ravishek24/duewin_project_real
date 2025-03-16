import express from 'express';
import { getWalletBalanceController } from '../controllers/walletController.js';
import { auth } from '../middleware/authMiddleware.js';

const router = express.Router();

// All wallet routes require authentication
router.use(auth);

router.get('/balance', getWalletBalanceController);

export default router;