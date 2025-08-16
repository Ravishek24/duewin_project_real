// routes/thirdPartyWalletRoutes.js - FIXED VERSION
const express = require('express');
const router = express.Router();
const thirdPartyWalletController = require('../controllers/thirdPartyWalletController');
const rateLimiters = require('../middleware/rateLimiter');

// Note: Authentication is handled at the router level in index.js
// All routes here will have auth middleware applied

// Health check for third-party wallet service - Rate limited
router.get('/health', rateLimiters.thirdPartyWallet, (req, res) => {
  res.json({
    success: true,
    message: 'Third-party wallet service is healthy',
    timestamp: new Date().toISOString()
  });
});

// FIXED: Get wallet balance - Rate limited
router.get('/balance', rateLimiters.thirdPartyWallet, thirdPartyWalletController.getWalletBalance);

// FIXED: Get wallet status (new route for better debugging) - Rate limited
router.get('/status', rateLimiters.thirdPartyWallet, thirdPartyWalletController.getWalletStatus);

// FIXED: Check if there are funds in the third-party wallet - Rate limited
router.get('/check-funds', rateLimiters.thirdPartyWallet, thirdPartyWalletController.checkThirdPartyFunds);

// ADDED: Create wallet route (was missing) - Rate limited
router.post('/create', rateLimiters.thirdPartyWallet, thirdPartyWalletController.createWallet);

// FIXED: Transfer funds to third-party wallet - Rate limited
router.post('/transfer-to-third-party', rateLimiters.thirdPartyWallet, thirdPartyWalletController.transferToThirdPartyWallet);

// FIXED: Transfer funds back to main wallet - Rate limited
router.post('/transfer-to-main', rateLimiters.thirdPartyWallet, thirdPartyWalletController.transferToMainWallet);

// ADDED: Debug route to check complete wallet info - Rate limited
router.get('/debug', rateLimiters.thirdPartyWallet, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const thirdPartyWalletService = require('../services/thirdPartyWalletService');
    const User = require('../models/User');
    
    // Get user info
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get wallet info
    const walletExists = await thirdPartyWalletService.walletExists(userId);
    const balanceResult = await thirdPartyWalletService.getBalance(userId);
    
    res.json({
      success: true,
      user: {
        id: user.user_id,
        name: user.user_name,
        mainWalletBalance: parseFloat(user.wallet_balance)
      },
      thirdPartyWallet: {
        exists: walletExists.exists,
        balance: walletExists.balance,
        currency: walletExists.currency,
        balanceCheck: balanceResult
      },
      canPlay: walletExists.balance > 0,
      needsTransfer: !walletExists.exists || walletExists.balance <= 0
    });
  } catch (error) {
    console.error('Third-party wallet debug error:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting wallet debug info',
      error: error.message
    });
  }
});

// ADDED: Test route to simulate the full transfer flow - Rate limited
router.post('/test-flow', rateLimiters.thirdPartyWallet, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const thirdPartyWalletService = require('../services/thirdPartyWalletService');
    
    console.log(`=== TESTING WALLET FLOW FOR USER ${userId} ===`);
    
    // Step 1: Check current status
    const initialStatus = await thirdPartyWalletService.walletExists(userId);
    console.log('1. Initial status:', initialStatus);
    
    // Step 2: Create wallet if it doesn't exist
    if (!initialStatus.exists) {
      const createResult = await thirdPartyWalletService.createWallet(userId);
      console.log('2. Create wallet result:', createResult);
      
      if (!createResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Failed to create wallet',
          error: createResult.message
        });
      }
    }
    
    // Step 3: Transfer funds if needed
    const transferResult = await thirdPartyWalletService.transferToThirdPartyWallet(userId);
    console.log('3. Transfer result:', transferResult);
    
    // Step 4: Check final status
    const finalStatus = await thirdPartyWalletService.getBalance(userId);
    console.log('4. Final status:', finalStatus);
    
    res.json({
      success: true,
      message: 'Wallet flow test completed',
      steps: {
        initialStatus,
        transferResult,
        finalStatus
      }
    });
  } catch (error) {
    console.error('Wallet flow test error:', error);
    res.status(500).json({
      success: false,
      message: 'Wallet flow test failed',
      error: error.message
    });
  }
});

module.exports = router;