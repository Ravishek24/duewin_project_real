import express from 'express';
import {
  payInController,
  initiateWithdrawalController,
  verifyWithdrawalOtpController,
  payInCallbackController,
  payOutCallbackController,
  wePayCollectionCallbackController,
  wePayTransferCallbackController,
  getPaymentStatusController
} from '../controllers/paymentController.js';
import { auth, requirePhoneVerification } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Protected routes (require authentication & phone verification)
router.post('/payin', auth, requirePhoneVerification, payInController);

// New two-step withdrawal with OTP verification
router.post('/withdrawal/initiate', auth, requirePhoneVerification, initiateWithdrawalController);
router.post('/withdrawal/verify', auth, verifyWithdrawalOtpController);

// Payment status
router.get('/status/:order_id', auth, getPaymentStatusController);

// Callback routes for OKPAY (public, accessed by payment gateway)
router.post('/okpay/payin-callback', payInCallbackController);
router.post('/okpay/payout-callback', payOutCallbackController);

// Callback routes for WePayGlobal (public, accessed by payment gateway)
router.post('/wepay/payin-callback', wePayCollectionCallbackController);
router.post('/wepay/payout-callback', wePayTransferCallbackController);

export default router;