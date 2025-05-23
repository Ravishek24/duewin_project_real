const { body, param, validationResult } = require('express-validator');

// Validation middleware
const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    next();
};

// Validation rules for different endpoints
const validationRules = {
    // Signup validation
    signup: [
        body('phone_no')
            .matches(/^\d{10,15}$/)
            .withMessage('Phone number must be 10-15 digits'),
        body('password')
            .isLength({ min: 6 })
            .withMessage('Password must be at least 6 characters long'),
        body('referred_by')
            .notEmpty()
            .withMessage('Referral code is required'),
        body('email')
            .optional()
            .isEmail()
            .withMessage('Invalid email format'),
        body('user_name')
            .optional()
            .isString()
            .trim()
            .isLength({ min: 3, max: 50 })
            .withMessage('Username must be between 3 and 50 characters'),
        validate
    ],

    // Login validation
    login: [
        body('phone_no')
            .matches(/^\d{10,15}$/)
            .withMessage('Phone number must be 10-15 digits'),
        body('password')
            .notEmpty()
            .withMessage('Password is required'),
        validate
    ],

    // Profile update validation
    profileUpdate: [
        body('user_name')
            .optional()
            .isString()
            .trim()
            .isLength({ min: 3, max: 50 })
            .withMessage('Username must be between 3 and 50 characters'),
        body('phone_no')
            .optional()
            .matches(/^\d{10,15}$/)
            .withMessage('Phone number must be 10-15 digits'),
        validate
    ],

    // Wallet operations validation
    wallet: [
        body('amount')
            .isFloat({ min: 0.01 })
            .withMessage('Amount must be a positive number'),
        body('currency')
            .isIn(['INR', 'USDT'])
            .withMessage('Invalid currency'),
        validate
    ],

    // Gift code validation
    giftCode: [
        body('code')
            .isString()
            .trim()
            .isLength({ min: 6, max: 20 })
            .withMessage('Invalid gift code format'),
        validate
    ],

    // Bank account validation
    bankAccount: [
        body('bank_name')
            .isString()
            .trim()
            .isLength({ min: 2, max: 100 })
            .withMessage('Invalid bank name'),
        body('account_number')
            .matches(/^\d{9,18}$/)
            .withMessage('Invalid account number format'),
        body('ifsc_code')
            .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/)
            .withMessage('Invalid IFSC code format'),
        body('account_holder_name')
            .isString()
            .trim()
            .isLength({ min: 3, max: 100 })
            .withMessage('Invalid account holder name'),
        body('is_primary')
            .optional()
            .isBoolean()
            .withMessage('is_primary must be a boolean'),
        validate
    ],

    // USDT account validation
    usdtAccount: [
        body('address')
            .isString()
            .trim()
            .isLength({ min: 26, max: 35 })
            .withMessage('Invalid USDT address format'),
        body('network')
            .isIn(['TRC20', 'ERC20'])
            .withMessage('Invalid network type'),
        validate
    ],

    // New validations for other routes
    payment: [
        body('amount')
            .isFloat({ min: 0.01 })
            .withMessage('Amount must be a positive number'),
        body('payment_method')
            .isIn(['BANK_TRANSFER', 'USDT', 'UPI', 'OKPAY', 'WEPAY', 'MXPAY'])
            .withMessage('Invalid payment method'),
        body('transaction_id')
            .optional()
            .isString()
            .withMessage('Invalid transaction ID format'),
        validate
    ],

    withdrawal: [
        body('amount')
            .isFloat({ min: 0.01 })
            .withMessage('Amount must be a positive number'),
        body('withdrawal_method')
            .isIn(['BANK_TRANSFER', 'USDT'])
            .withMessage('Invalid withdrawal method'),
        body('account_id')
            .isInt()
            .withMessage('Invalid account ID'),
        validate
    ],

    game: [
        body('gameType')
            .isString()
            .isIn(['crash', 'dice'])
            .withMessage('Invalid game type'),
        body('amount')
            .isFloat({ min: 0.01 })
            .withMessage('Invalid bet amount'),
        body('betType')
            .isString()
            .isIn(['cashout', 'auto-cashout', 'over', 'under'])
            .withMessage('Invalid bet type'),
        body('target')
            .optional()
            .isFloat({ min: 1 })
            .withMessage('Invalid target value'),
        validate
    ],

    vip: [
        body('level')
            .isInt({ min: 0, max: 10 })
            .withMessage('Invalid VIP level'),
        validate
    ],

    referral: [
        body('referral_code')
            .isString()
            .trim()
            .isLength({ min: 6, max: 20 })
            .withMessage('Invalid referral code format'),
        validate
    ],

    otp: [
        body('phone_no')
            .matches(/^\d{10,15}$/)
            .withMessage('Phone number must be 10-15 digits'),
        body('otp')
            .isLength({ min: 6, max: 6 })
            .isNumeric()
            .withMessage('OTP must be 6 digits'),
        validate
    ],

    seamlessWallet: [
        body('amount')
            .isFloat({ min: 0.01 })
            .withMessage('Amount must be a positive number'),
        body('currency')
            .isIn(['INR', 'USDT'])
            .withMessage('Invalid currency'),
        body('transaction_type')
            .isIn(['DEPOSIT', 'WITHDRAWAL'])
            .withMessage('Invalid transaction type'),
        validate
    ],

    mxPay: [
        body('amount')
            .isFloat({ min: 0.01 })
            .withMessage('Amount must be a positive number'),
        body('currency')
            .isIn(['INR', 'USDT'])
            .withMessage('Invalid currency'),
        body('payment_method')
            .isIn(['UPI', 'BANK_TRANSFER'])
            .withMessage('Invalid payment method'),
        validate
    ]
};

module.exports = validationRules; 