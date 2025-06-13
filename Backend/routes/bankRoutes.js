const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/authMiddleware');
const rateLimiters = require('../middleware/rateLimiter');
const validationRules = require('../middleware/inputValidator');
const {
    getBankAccountsController,
    addBankAccountController,
    updateBankAccountController,
    deleteBankAccountController
} = require('../controllers/bankAccountController');

// All bank routes require authentication
router.use(auth);

// Add bank account
router.post('/accounts',
    rateLimiters.bankAccount,
    validationRules.bankAccount,
    addBankAccountController
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