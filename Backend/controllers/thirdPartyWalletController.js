const thirdPartyWalletService = require('../services/thirdPartyWalletService');

/**
 * Get third-party wallet balance
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getWalletBalance = async (req, res) => {
  try {
    const userId = req.user.user_id; // Assuming authentication middleware sets req.user
    
    const result = await thirdPartyWalletService.getBalance(userId);
    
    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.message
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
 * Transfer funds to third-party wallet
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const transferToThirdPartyWallet = async (req, res) => {
  try {
    const userId = req.user.user_id; // Assuming authentication middleware sets req.user
    
    const result = await thirdPartyWalletService.transferToThirdPartyWallet(userId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Funds transferred to third-party wallet',
      mainWalletBalanceBefore: result.mainWalletBalanceBefore,
      mainWalletBalanceAfter: result.mainWalletBalanceAfter,
      thirdPartyWalletBalance: result.wallet ? result.wallet.balance : null
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
    const userId = req.user.user_id; // Assuming authentication middleware sets req.user
    
    const result = await thirdPartyWalletService.transferToMainWallet(userId);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Funds transferred to main wallet',
      mainWalletBalanceBefore: result.mainWalletBalanceBefore,
      mainWalletBalanceAfter: result.mainWalletBalanceAfter,
      thirdPartyWalletBalanceBefore: result.thirdPartyWalletBalanceBefore,
      thirdPartyWalletBalanceAfter: result.thirdPartyWalletBalanceAfter
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
 * Check if there are funds in the third-party wallet
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const checkThirdPartyFunds = async (req, res) => {
  try {
    const userId = req.user.user_id; // Assuming authentication middleware sets req.user
    
    const result = await thirdPartyWalletService.getBalance(userId);
    
    if (!result.success) {
      // If wallet doesn't exist, return false for hasFunds
      return res.status(200).json({
        hasFunds: false,
        balance: 0,
        currency: 'INR'
      });
    }
    
    return res.status(200).json({
      hasFunds: result.balance > 0,
      balance: result.balance,
      currency: result.currency
    });
  } catch (error) {
    console.error('Error checking third-party wallet funds:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check third-party wallet funds'
    });
  }
};

module.exports = {
  getWalletBalance,
  transferToThirdPartyWallet,
  transferToMainWallet,
  checkThirdPartyFunds
}; 