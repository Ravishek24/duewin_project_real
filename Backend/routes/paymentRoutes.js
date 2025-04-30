import express from 'express';
import {
  payInController,
  initiateWithdrawalController,
  verifyWithdrawalOtpController,
  payInCallbackController,
  payOutCallbackController,
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

// Callback routes (public, accessed by payment gateway)
router.post('/payin-callback', payInCallbackController);
router.post('/payout-callback', payOutCallbackController);

export default router;