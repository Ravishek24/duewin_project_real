// routes/thirdPartyWalletRoutes.js
const express = require('express');
const router = express.Router();
const thirdPartyWalletController = require('../controllers/thirdPartyWalletController');

// Temporarily removing auth middleware for testing
// Will add it back once we confirm routes are working

// Get wallet balance
router.get('/balance', thirdPartyWalletController.getWalletBalance);

// Check if there are funds in the third-party wallet
router.get('/check-funds', thirdPartyWalletController.checkThirdPartyFunds);

// Transfer funds to third-party wallet
router.post('/transfer-to-third-party', thirdPartyWalletController.transferToThirdPartyWallet);

// Transfer funds back to main wallet
router.post('/transfer-to-main', thirdPartyWalletController.transferToMainWallet);

module.exports = router; 