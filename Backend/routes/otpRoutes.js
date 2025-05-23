// routes/otpRoutes.js
const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { validateInput } = require('../middleware/inputValidation');
const { body } = require('express-validator');
const { otp: otpLimiter } = require('../middleware/rateLimiter');
const {
    sendOtpController,
    verifyOtpController,
    verifyPhoneUpdateOtpController,
    verifyBankAccountOtpController,
    checkOtpStatusController
} = require('../controllers/otpController');

// Send OTP
router.post('/send',
    otpLimiter,
    [
        body('phone_no').matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format')
    ],
    validateInput,
    sendOtpController
);

// Verify OTP
router.post('/verify',
    otpLimiter,
    [
        body('phone_no').matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format'),
        body('otp').isLength({ min: 4, max: 6 }).withMessage('OTP must be 4-6 digits')
    ],
    validateInput,
    verifyOtpController
);

// Protected routes (require authentication)
router.post('/verify-phone-update', 
    auth,
    [
        body('phone_no').matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format'),
        body('otp').isLength({ min: 4, max: 6 }).withMessage('OTP must be 4-6 digits')
    ],
    validateInput,
    verifyPhoneUpdateOtpController
);

router.post('/verify-bank-account', 
    auth,
    [
        body('otp').isLength({ min: 4, max: 6 }).withMessage('OTP must be 4-6 digits')
    ],
    validateInput,
    verifyBankAccountOtpController
);

router.get('/status/:otp_session_id',
    auth,
    checkOtpStatusController
);

module.exports = router;