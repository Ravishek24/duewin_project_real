// routes/otpRoutes.js
const express = require('express');
const { 
    verifyOtpController, 
    resendOtpController, 
    verifyPhoneUpdateOtpController,
    otpWebhookController,
    checkOtpStatusController
} = require('../controllers/otpController');
const { auth } = require('../middlewares/authMiddleware');

const router = express.Router();

// Public routes
router.post('/webhook', otpWebhookController); // Webhook endpoint for ReverseOTP
router.get('/status/:otp_session_id', checkOtpStatusController); // Check OTP status (could be protected)

// Protected routes (require authentication)
router.post('/verify', auth, verifyOtpController);
router.post('/resend', auth, resendOtpController);
router.post('/verify-phone-update', auth, verifyPhoneUpdateOtpController);

module.exports = router;