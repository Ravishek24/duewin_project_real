// controllers/thirdPartyWalletController.js - FIXED VERSION
const thirdPartyWalletService = require('../services/thirdPartyWalletService');

/**
 * FIXED: Get third-party wallet balance with better error handling
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getWalletBalance = async (req, res) => {
  try {
    const userId = req.user.user_id;
    console.log(`Getting wallet balance for user ${userId}`);
    
    const result = await thirdPartyWalletService.getBalance(userId);
    
    if (!result.success) {
      // FIXED: Return 0 balance instead of 404 if wallet doesn't exist
      return res.status(200).json({
        success: true,
        balance: 0,
        currency: 'EUR',
        message: 'No third-party wallet found'
      });
    }
    
    return res.status(200).json({
      success: true,
      balance: result.balance,
      currency: result.currency
    });
  } catch (error) {
    console.error('Error getting wallet balance:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get wallet balance'
    });
  }
};

/**
 * FIXED: Transfer funds to third-party wallet with better validation
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const transferToThirdPartyWallet = async (req, res) => {
  try {
    const userId = req.user.user_id;
    console.log(`Transfer to third-party wallet requested for user ${userId}`);
    
    // ADDED: Check if user already has a third-party wallet with balance
    const balanceCheck = await thirdPartyWalletService.getBalance(userId);
    if (balanceCheck.success && balanceCheck.balance > 0) {
      console.log(`User ${userId} already has balance in third-party wallet: ${balanceCheck.balance}`);
      return res.status(200).json({
        success: true,
        message: 'Funds already available in third-party wallet',
        thirdPartyWalletBalance: balanceCheck.balance,
        currency: balanceCheck.currency
      });
    }
    
    const result = await thirdPartyWalletService.transferToThirdPartyWallet(userId);
    
    if (!result.success) {
      // FIXED: Better error handling for different scenarios
      if (result.message === 'No funds available in main wallet') {
        return res.status(200).json({
          success: false,
          message: 'No funds available in main wallet to transfer',
          mainBalance: result.mainBalance || 0
        });
      }
      
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Funds transferred to third-party wallet successfully',
      mainWalletBalanceBefore: result.mainWalletBalanceBefore,
      mainWalletBalanceAfter: result.mainWalletBalanceAfter,
      thirdPartyWalletBalanceBefore: result.thirdPartyWalletBalanceBefore,
      thirdPartyWalletBalanceAfter: result.thirdPartyWalletBalanceAfter,
      transferAmount: result.transferAmount,
      thirdPartyWalletBalance: result.wallet ? result.wallet.balance : result.thirdPartyWalletBalanceAfter
    });
  } catch (error) {
    console.error('Error transferring to third-party wallet:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to transfer funds'
    });
  }
};

/**
 * Transfer funds back to main wallet
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const transferToMainWallet = async (req, res) => {
  try {
    const userId = req.user.user_id;
    console.log(`Transfer to main wallet requested for user ${userId}`);
    
    const result = await thirdPartyWalletService.transferToMainWallet(userId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Funds transferred to main wallet successfully',
      mainWalletBalanceBefore: result.mainWalletBalanceBefore,
      mainWalletBalanceAfter: result.mainWalletBalanceAfter,
      thirdPartyWalletBalanceBefore: result.thirdPartyWalletBalanceBefore,
      thirdPartyWalletBalanceAfter: result.thirdPartyWalletBalanceAfter,
      transferAmount: result.transferAmount
    });
  } catch (error) {
    console.error('Error transferring to main wallet:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to transfer funds'
    });
  }
};

/**
 * FIXED: Check if there are funds in the third-party wallet
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const checkThirdPartyFunds = async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    const result = await thirdPartyWalletService.getBalance(userId);
    
    // FIXED: Handle the case where wallet doesn't exist gracefully
    if (!result.success) {
      return res.status(200).json({
        hasFunds: false,
        balance: 0,
        currency: 'EUR',
        walletExists: false
      });
    }
    
    return res.status(200).json({
      hasFunds: result.balance > 0,
      balance: result.balance,
      currency: result.currency,
      walletExists: true
    });
  } catch (error) {
    console.error('Error checking third-party wallet funds:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check third-party wallet funds'
    });
  }
};

/**
 * ADDED: Create a third-party wallet for the user
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const createWallet = async (req, res) => {
  try {
    const userId = req.user.user_id;
    console.log(`Creating wallet for user ${userId}`);
    
    const result = await thirdPartyWalletService.createWallet(userId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
    return res.status(200).json({
      success: true,
      message: result.message,
      wallet: {
        id: result.wallet.wallet_id,
        balance: result.wallet.balance,
        currency: result.wallet.currency
      }
    });
  } catch (error) {
    console.error('Error creating wallet:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create wallet'
    });
  }
};

/**
 * ADDED: Get wallet status and balance info
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getWalletStatus = async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    const walletCheck = await thirdPartyWalletService.walletExists(userId);
    const balanceResult = await thirdPartyWalletService.getBalance(userId);
    
    return res.status(200).json({
      success: true,
      walletExists: walletCheck.exists,
      balance: walletCheck.balance,
      currency: walletCheck.currency,
      canPlay: walletCheck.balance > 0
    });
  } catch (error) {
    console.error('Error getting wallet status:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get wallet status'
    });
  }
};

module.exports = {
  getWalletBalance,
  transferToThirdPartyWallet,
  transferToMainWallet,
  checkThirdPartyFunds,
  createWallet, // ADDED
  getWalletStatus // ADDED
};