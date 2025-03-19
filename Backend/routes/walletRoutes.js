import express from 'express';
import { 
  getWalletBalanceController,
  getTransactionHistoryController,
  getRechargeHistoryController,
  getWithdrawalHistoryController
} from '../controllers/walletController.js';
import { auth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// All wallet routes require authentication
router.use(auth);

// Wallet routes
router.get('/balance', getWalletBalanceController);
router.get('/transactions', getTransactionHistoryController);
router.get('/recharges', getRechargeHistoryController);
router.get('/withdrawals', getWithdrawalHistoryController);

export default router;