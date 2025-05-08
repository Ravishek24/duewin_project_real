const { 
    getWalletBalance, 
    getTransactionHistory, 
    getRechargeHistory,
    getWithdrawalHistory,
} = require('../services/walletServices');

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

// Controller to get user's recharge history
const getRechargeHistoryController = async (req, res) => {
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
        console.error('Error fetching recharge history:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error fetching recharge history.' 
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

module.exports = {
    getWalletBalanceController,
    getTransactionHistoryController,
    getRechargeHistoryController,
    getWithdrawalHistoryController
};