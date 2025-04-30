// routes/otpRoutes.js
import express from 'express';
import { 
    verifyOtpController, 
    resendOtpController, 
    verifyPhoneUpdateOtpController,
    otpWebhookController,
    checkOtpStatusController
} from '../controllers/otpController.js';
import { auth } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/webhook', otpWebhookController); // Webhook endpoint for ReverseOTP
router.get('/status/:otp_session_id', checkOtpStatusController); // Check OTP status (could be protected)

// Protected routes (require authentication)
router.post('/verify', auth, verifyOtpController);
router.post('/resend', auth, resendOtpController);
router.post('/verify-phone-update', auth, verifyPhoneUpdateOtpController);

export default router;