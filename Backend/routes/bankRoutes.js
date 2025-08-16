const express = require('express');
const router = express.Router();
const rateLimiters = require('../middleware/rateLimiter');
const validationRules = require('../middleware/inputValidator');
const {
    getBankAccountsController,
    addBankAccountController,
    updateBankAccountController,
    deleteBankAccountController
} = require('../controllers/bankAccountController');

// NOTE: All bank routes are already protected by authMiddleware.auth at the router level in index.js

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