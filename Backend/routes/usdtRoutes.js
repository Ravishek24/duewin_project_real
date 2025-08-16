const express = require('express');
const { 
    getUsdtAccounts, 
    addUsdtAccount, 
    updateUsdtAccount, 
    deleteUsdtAccount 
} = require('../controllers/usdtAccountController');
const rateLimiters = require('../middleware/rateLimiter');

const router = express.Router();

// NOTE: All USDT account routes are already protected by authMiddleware.auth at the router level in index.js

// Get all USDT accounts for the authenticated user - Rate limited
router.get('/', rateLimiters.usdtOperations, getUsdtAccounts);

// Add a new USDT account - Rate limited
router.post('/', rateLimiters.usdtOperations, addUsdtAccount);

// Update a USDT account - Rate limited
router.put('/:id', rateLimiters.usdtOperations, updateUsdtAccount);

// Delete a USDT account - Rate limited
router.delete('/:id', rateLimiters.usdtOperations, deleteUsdtAccount);

module.exports = router;
