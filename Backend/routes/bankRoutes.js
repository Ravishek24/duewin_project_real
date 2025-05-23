const express = require('express');
const router = express.Router();
const { auth, requirePhoneVerification } = require('../middlewares/authMiddleware');
const rateLimiters = require('../middleware/rateLimiter');
const validationRules = require('../middleware/inputValidator');
const {
    getBankAccountsController,
    initBankAccountController,
    completeBankAccountController,
    updateBankAccountController,
    deleteBankAccountController
} = require('../controllers/bankAccountController');

// All bank routes require authentication and phone verification
router.use(auth);
router.use(requirePhoneVerification);

// Initialize bank account addition (send OTP)
router.post('/accounts/init',
    rateLimiters.bankAccount,
    validationRules.bankAccount,
    initBankAccountController
);

// Complete bank account addition (verify OTP)
router.post('/accounts/complete',
    rateLimiters.bankAccount,
    completeBankAccountController
);

// Update bank account
router.put('/accounts/:id',
    rateLimiters.bankAccount,
    validationRules.bankAccount,
    updateBankAccountController
);

// Delete bank account
router.delete('/accounts/:id',
    rateLimiters.bankAccount,
    deleteBankAccountController
);

// Get bank accounts
router.get('/accounts',
    rateLimiters.general,
    getBankAccountsController
);

module.exports = router;