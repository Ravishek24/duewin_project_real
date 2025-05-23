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
const { auth, authenticateAdmin, requirePhoneVerification } = require('../middleware/auth');

const router = express.Router();

// Protected routes (require authentication & phone verification)
router.post('/deposit', auth, requirePhoneVerification, mxPayDepositController);
router.get('/order-status/:order_id', auth, requirePhoneVerification, checkMxPayOrderStatusController);

// Admin-only routes
router.get('/banks', auth, authenticateAdmin, getMxPayBankListController);
router.get('/balance', auth, authenticateAdmin, checkMxPayMerchantBalanceController);
router.post('/payout/:withdrawal_id', auth, authenticateAdmin, processMxPayPayoutController);

// Callback routes for MxPay (public, accessed by payment gateway)
router.post('/collection-callback', mxPayCollectionCallbackController);
router.post('/transfer-callback', mxPayTransferCallbackController);

module.exports = router;