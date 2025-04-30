// routes/mxPayRoutes.js
import express from 'express';
import {
  mxPayDepositController,
  mxPayCollectionCallbackController,
  checkMxPayOrderStatusController,
  mxPayTransferCallbackController,
  getMxPayBankListController,
  checkMxPayMerchantBalanceController,
  processMxPayPayoutController
} from '../controllers/mxPayController.js';
import { auth, requirePhoneVerification } from '../middlewares/authMiddleware.js';
import { isAdmin } from '../middlewares/adminMiddleware.js';

const router = express.Router();

// Protected routes (require authentication & phone verification)
router.post('/deposit', auth, requirePhoneVerification, mxPayDepositController);
router.get('/order-status/:order_id', auth, checkMxPayOrderStatusController);

// Admin-only routes
router.get('/banks', auth, isAdmin, getMxPayBankListController);
router.get('/balance', auth, isAdmin, checkMxPayMerchantBalanceController);
router.post('/payout/:withdrawal_id', auth, isAdmin, processMxPayPayoutController);

// Callback routes for MxPay (public, accessed by payment gateway)
router.post('/collection-callback', mxPayCollectionCallbackController);
router.post('/transfer-callback', mxPayTransferCallbackController);

export default router;