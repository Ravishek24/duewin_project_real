// routes/mxPayRoutes.js
const express = require('express');
const {
  mxPayDepositController,
  mxPayCollectionCallbackController,
  checkMxPayOrderStatusController,
  mxPayTransferCallbackController,
  getMxPayBankListController,
  checkMxPayMerchantBalanceController,
  processMxPayPayoutController
} = require('../controllers/mxPayController');
const { auth, requirePhoneVerification } = require('../middlewares/authMiddleware');
const rateLimiters = require('../middleware/rateLimiter');

const router = express.Router();

// Protected routes (require authentication & phone verification) - Rate limited
router.post('/deposit', auth, requirePhoneVerification, rateLimiters.mxPayIntegration, mxPayDepositController);
router.get('/order-status/:order_id', auth, requirePhoneVerification, rateLimiters.mxPayIntegration, checkMxPayOrderStatusController);

// Admin-only routes - No rate limiting for now as requested
router.get('/banks', auth, getMxPayBankListController);
router.get('/balance', auth, checkMxPayMerchantBalanceController);
router.post('/payout/:withdrawal_id', auth, processMxPayPayoutController);

// Callback routes for MxPay (public, accessed by payment gateway) - Rate limited
router.post('/collection-callback', rateLimiters.mxPayIntegration, mxPayCollectionCallbackController);
router.post('/transfer-callback', rateLimiters.mxPayIntegration, mxPayTransferCallbackController);

module.exports = router;