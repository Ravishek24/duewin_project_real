// routes/otpRoutes.js
const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/authMiddleware');
const { validateInput } = require('../middleware/inputValidation');
const { body } = require('express-validator');
const rateLimiters = require('../middleware/rateLimiter');
const rateLimit = require('express-rate-limit');
// Stricter OTP rate limiter: max 5 requests per hour per IP
const otpLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: { success: false, message: 'Too many OTP requests from this IP, please try again later.' }
});

// Import controllers with error handling
let controllers;
try {
    controllers = require('../controllers/otpController');
    if (!controllers.sendOtpController || !controllers.verifyOtpController || 
        !controllers.verifyPhoneUpdateOtpController || !controllers.verifyBankAccountOtpController || 
        !controllers.checkOtpStatusController) {
        throw new Error('One or more controller functions are undefined');
    }
} catch (error) {
    console.error('Error loading OTP controllers:', error);
    process.exit(1);
}

const {
    sendOtpController,
    verifyOtpController,
    verifyPhoneUpdateOtpController,
    verifyBankAccountOtpController,
    checkOtpStatusController
} = controllers;

// Send OTP
router.post('/send',
    otpLimiter,
    [
        body('phone').matches(/^[+]?\d{10,15}$/).withMessage('Invalid phone number format'),
        body('purpose').isIn(['registration', 'login', 'phone_update', 'bank_account', 'withdrawal']).withMessage('Invalid purpose'),
        body('countryCode').optional().isString().isLength({ min: 1, max: 4 })
    ],
    validateInput,
    sendOtpController
);

// Verify OTP
router.post('/verify',
    [
        body('otp_session_id').isString().notEmpty(),
        body('phone').matches(/^[+]?\d{10,15}$/).withMessage('Invalid phone number format'),
        body('code').isString().notEmpty()
    ],
    validateInput,
    verifyOtpController
);

// Protected routes (require authentication)
router.post('/verify-phone-update', 
    auth,
    [
        body('otp_session_id').notEmpty().withMessage('OTP session ID is required'),
        body('new_phone').matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format')
    ],
    validateInput,
    verifyPhoneUpdateOtpController
);

router.post('/verify-bank-account', 
    auth,
    [
        body('otp_session_id').notEmpty().withMessage('OTP session ID is required')
    ],
    validateInput,
    verifyBankAccountOtpController
);

router.get('/status/:otp_session_id',
    auth,
    checkOtpStatusController
);

module.exports = router;