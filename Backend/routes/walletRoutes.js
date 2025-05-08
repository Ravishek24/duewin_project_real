const express = require('express');
const { 
  getWalletBalanceController,
  getTransactionHistoryController,
  getRechargeHistoryController,
  getWithdrawalHistoryController
} = require('../controllers/walletController.js');
const { auth } = require('../middlewares/authMiddleware');

const router = express.Router();

// All wallet routes require authentication
router.use(auth);

// Wallet routes
router.get('/balance', getWalletBalanceController);
router.get('/transactions', getTransactionHistoryController);
router.get('/recharges', getRechargeHistoryController);
router.get('/withdrawals', getWithdrawalHistoryController);

module.exports = router;