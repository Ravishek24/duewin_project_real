import express from 'express';
import {
  payInController,
  payOutController,
  payInCallbackController,
  payOutCallbackController,
  getPaymentStatusController
} from '../controllers/paymentController.js';
import { auth, requireEmailVerification } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Protected routes (require authentication & email verification)
router.post('/payin', auth, requireEmailVerification, payInController);
router.post('/payout', auth, requireEmailVerification, payOutController);
router.get('/status/:order_id', auth, getPaymentStatusController);

// Callback routes (public, accessed by payment gateway)
router.post('/payin-callback', payInCallbackController);
router.post('/payout-callback', payOutCallbackController);

export default router;