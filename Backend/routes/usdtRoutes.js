const express = require('express');
const { 
    getUsdtAccounts, 
    addUsdtAccount, 
    updateUsdtAccount, 
    deleteUsdtAccount 
} = require('../controllers/usdtAccountController');
const { auth } = require('../middlewares/authMiddleware');

const router = express.Router();

// All USDT account routes require authentication
router.use(auth);

// Get all USDT accounts for the authenticated user
router.get('/', getUsdtAccounts);

// Add a new USDT account
router.post('/', addUsdtAccount);

// Update a USDT account
router.put('/:id', updateUsdtAccount);

// Delete a USDT account
router.delete('/:id', deleteUsdtAccount);

module.exports = router;
