// routes/otpRoutes.js
const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/authMiddleware');
const { validateInput } = require('../middleware/inputValidation');
const { body } = require('express-validator');
const rateLimiters = require('../middleware/rateLimiter');

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
    rateLimiters.otp,
    [
        body('phone').matches(/^\+?[1-9]\d{1,14}$/).withMessage('Invalid phone number format'),
        body('purpose').isIn(['registration', 'login', 'phone_update', 'bank_account', 'withdrawal']).withMessage('Invalid purpose')
    ],
    validateInput,
    sendOtpController
);

// Verify OTP
router.post('/verify',
    rateLimiters.otp,
    [
        body('otp_session_id').notEmpty().withMessage('OTP session ID is required')
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