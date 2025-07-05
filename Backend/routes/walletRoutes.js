const express = require('express');
const {
  getWalletBalanceController,
  getTransactionHistoryController,
  getDepositHistoryController,
  getWithdrawalHistoryController,
  getFirstBonusStatusController,
  initiateWithdrawalController,
  getAllWalletBalances,
  transferFromThirdPartyToMain,
  getSeamlessSlotHistoryController,
  getLiveCasinoHistoryController,
  getSportsBettingHistoryController
} = require('../controllers/walletController');
const { auth, requirePhoneVerification } = require('../middlewares/authMiddleware');

const router = express.Router();

// Protected routes (require authentication)  
router.get('/balance', auth, getWalletBalanceController);
router.get('/history', auth, getTransactionHistoryController);
router.get('/deposit-history', auth, getDepositHistoryController);
router.get('/withdrawal-history', auth, getWithdrawalHistoryController);
router.get('/first-bonus-status', auth, getFirstBonusStatusController);

// Seamless slot game history
router.get('/seamless-slot-history', auth, getSeamlessSlotHistoryController);

// Live casino game history
router.get('/live-casino-history', auth, getLiveCasinoHistoryController);

// Sports betting history
router.get('/sports-betting-history', auth, getSportsBettingHistoryController);

// Initiate withdrawal - only define this route once
router.post('/withdraw', auth, initiateWithdrawalController);

// Get all wallet balances (main and third-party)
router.get('/balances', auth, getAllWalletBalances);

// Transfer from third-party wallet to main wallet
router.post('/transfer-from-third-party', auth, transferFromThirdPartyToMain);

module.exports = router;