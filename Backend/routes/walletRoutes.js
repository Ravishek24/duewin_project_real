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
// NOTE: Auth middleware is applied at router level in index.js
const rateLimiters = require('../middleware/rateLimiter');

const router = express.Router();

// Protected routes (require authentication) - Enhanced wallet rate limiting
router.get('/balance', rateLimiters.enhancedWallet, getWalletBalanceController);
router.get('/history', rateLimiters.enhancedWallet, getTransactionHistoryController);
router.get('/deposit-history', rateLimiters.enhancedWallet, getDepositHistoryController);
router.get('/withdrawal-history', rateLimiters.enhancedWallet, getWithdrawalHistoryController);
router.get('/first-bonus-status', rateLimiters.enhancedWallet, getFirstBonusStatusController);

// Seamless slot game history - Enhanced wallet rate limiting
router.get('/seamless-slot-history', rateLimiters.enhancedWallet, getSeamlessSlotHistoryController);

// Live casino game history - Enhanced wallet rate limiting
router.get('/live-casino-history', rateLimiters.enhancedWallet, getLiveCasinoHistoryController);

// Sports betting history - Enhanced wallet rate limiting
router.get('/sports-betting-history', rateLimiters.enhancedWallet, getSportsBettingHistoryController);

// Initiate withdrawal - only define this route once - Enhanced wallet rate limiting
router.post('/withdraw', rateLimiters.enhancedWallet, initiateWithdrawalController);

// Get all wallet balances (main and third-party) - Enhanced wallet rate limiting
router.get('/balances', rateLimiters.enhancedWallet, getAllWalletBalances);

// Transfer from third-party wallet to main wallet - Enhanced wallet rate limiting
router.post('/transfer-from-third-party', rateLimiters.enhancedWallet, transferFromThirdPartyToMain);

module.exports = router;