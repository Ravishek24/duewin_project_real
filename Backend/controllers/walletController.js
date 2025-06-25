const { 
    getWalletBalance, 
    getTransactionHistory, 
    getRechargeHistory,
    getWithdrawalHistory,
    processWithdrawal
} = require('../services/walletServices');
const User = require('../models/User');

// Controller to get user's wallet balance
const getWalletBalanceController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const result = await getWalletBalance(userId);
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(404).json(result);
        }
    } catch (error) {
        console.error('Error fetching wallet balance:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching wallet balance.' 
        });
    }
};

// Controller to get user's transaction history
const getTransactionHistoryController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { page = 1, limit = 10 } = req.query;
        
        const result = await getTransactionHistory(userId, parseInt(page), parseInt(limit));
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error fetching transaction history:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching transaction history.' 
        });
    }
};

// Controller to get user's deposit history
const getDepositHistoryController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { page = 1, limit = 10 } = req.query;
        
        const result = await getRechargeHistory(userId, parseInt(page), parseInt(limit));
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error fetching deposit history:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching deposit history.' 
        });
    }
};

// Controller to get user's withdrawal history
const getWithdrawalHistoryController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { page = 1, limit = 10 } = req.query;
        
        const result = await getWithdrawalHistory(userId, parseInt(page), parseInt(limit));
        
        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error fetching withdrawal history:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching withdrawal history.' 
        });
    }
};

// Controller to check first recharge bonus status
const getFirstBonusStatusController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        
        const user = await User.findByPk(userId, {
            attributes: ['has_received_first_bonus', 'actual_deposit_amount']
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found.'
            });
        }

        return res.status(200).json({
            success: true,
            hasReceivedFirstBonus: user.has_received_first_bonus,
            actualDepositAmount: parseFloat(user.actual_deposit_amount)
        });
    } catch (error) {
        console.error('Error checking first bonus status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error checking first bonus status.' 
        });
    }
};

// Controller to initiate withdrawal
const initiateWithdrawalController = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const { amount, bank_account_id, usdt_account_id, withdrawal_type = 'BANK' } = req.body;

        if (!amount || parseFloat(amount) <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid amount provided'
            });
        }

        if (withdrawal_type === 'BANK') {
            if (!bank_account_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Bank account ID is required'
                });
            }
        } else if (withdrawal_type === 'USDT') {
            if (!usdt_account_id) {
                return res.status(400).json({
                    success: false,
                    message: 'USDT account ID is required'
                });
            }
        } else {
            return res.status(400).json({
                success: false,
                message: 'Invalid withdrawal type'
            });
        }

        // Generate unique order ID
        const orderId = `WD${Date.now()}${userId}`;
        const transactionId = `TXN${Date.now()}${userId}`;

        const result = await processWithdrawal(
            userId, 
            amount, 
            orderId, 
            transactionId, 
            'OKPAY', // Default payment gateway
            withdrawal_type,
            bank_account_id,
            usdt_account_id
        );

        if (result.success) {
            return res.status(200).json(result);
        } else {
            return res.status(400).json(result);
        }
    } catch (error) {
        console.error('Error initiating withdrawal:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error initiating withdrawal'
        });
    }
};

/**
 * Get both main wallet and third-party wallet balances
 * @param {Object} req - Express request object 
 * @param {Object} res - Express response object
 */
const getAllWalletBalances = async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Get main wallet balance from user table
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Get third-party wallet balance
    const thirdPartyWalletService = require('../services/thirdPartyWalletService');
    const thirdPartyWallet = await thirdPartyWalletService.getBalance(userId);
    
    return res.status(200).json({
      success: true,
      mainWallet: {
        balance: parseFloat(user.wallet_balance),
        currency: user.currency || 'EUR'
      },
      thirdPartyWallet: {
        balance: thirdPartyWallet.success ? parseFloat(thirdPartyWallet.balance) : 0,
        currency: thirdPartyWallet.success ? thirdPartyWallet.currency : 'EUR',
        exists: thirdPartyWallet.success
      }
    });
  } catch (error) {
    console.error('Error getting all wallet balances:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching wallet balances'
    });
  }
};

/**
 * Force transfer all funds from third-party wallet to main wallet
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const transferFromThirdPartyToMain = async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Import third-party wallet service
    const thirdPartyWalletService = require('../services/thirdPartyWalletService');
    
    // Perform the transfer
    const result = await thirdPartyWalletService.transferToMainWallet(userId);
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'Funds transferred successfully from third-party wallet to main wallet',
        ...result
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to transfer funds'
      });
    }
  } catch (error) {
    console.error('Error transferring from third-party to main wallet:', error);
    res.status(500).json({
      success: false,
      message: 'Server error transferring funds'
    });
  }
};

module.exports = {
    getWalletBalanceController,
    getTransactionHistoryController,
    getDepositHistoryController,
    getWithdrawalHistoryController,
    getFirstBonusStatusController,
    initiateWithdrawalController,
    getAllWalletBalances,
    transferFromThirdPartyToMain
};