const { sequelize } = require('../config/db');
const ThirdPartyWallet = require('../models/ThirdPartyWallet');
const User = require('../models/User');

/**
 * Get or create a third-party wallet for a user
 * @param {number} userId - User ID
 * @param {Transaction} existingTransaction - Optional existing transaction
 * @returns {Promise<Object>} Wallet info
 */
const getOrCreateWallet = async (userId, existingTransaction = null) => {
  let t = existingTransaction;
  let shouldCommit = false;
  
  if (!t) {
    t = await sequelize.transaction();
    shouldCommit = true;
  }
  
  try {
    // Check if wallet exists
    let wallet = await ThirdPartyWallet.findOne({
      where: { user_id: userId },
      transaction: t
    });
    
    // If wallet doesn't exist, create it
    if (!wallet) {
      wallet = await ThirdPartyWallet.create({
        user_id: userId,
        balance: 0.00,
        currency: 'EUR', // Updated to EUR as per our configuration change
        is_active: true,
        last_updated: new Date()
      }, { transaction: t });
    }
    
    if (shouldCommit) {
      await t.commit();
    }
    
    return {
      success: true,
      wallet
    };
  } catch (error) {
    if (shouldCommit) {
      await t.rollback();
    }
    console.error('Error getting or creating third-party wallet:', error);
    
    return {
      success: false,
      message: error.message || 'Failed to get or create wallet'
    };
  }
};

/**
 * Transfer balance from main wallet to third-party wallet
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Transfer result
 */
const transferToThirdPartyWallet = async (userId) => {
  let retryCount = 0;
  const maxRetries = 3;
  
  const executeTransfer = async () => {
    const t = await sequelize.transaction();
    
    try {
      // Get user with locking
      const user = await User.findByPk(userId, {
        lock: true,
        transaction: t
      });
      
      if (!user) {
        await t.rollback();
        return {
          success: false,
          message: 'User not found'
        };
      }
      
      // Check if user has any balance to transfer
      const mainBalance = parseFloat(user.wallet_balance);
      if (mainBalance <= 0) {
        await t.rollback();
        return {
          success: false,
          message: 'No funds available in main wallet',
          mainBalance
        };
      }
      
      // Get wallet with locking - pass the transaction to avoid nested transactions
      const walletResult = await getOrCreateWallet(userId, t);
      if (!walletResult.success) {
        await t.rollback();
        return walletResult; // Return error
      }
      
      const wallet = walletResult.wallet;
      
      // Check if there's already balance in the third-party wallet
      if (parseFloat(wallet.balance) > 0) {
        await t.commit();
        return {
          success: true,
          wallet,
          message: 'Wallet already has balance'
        };
      }
      
      // Transfer all balance to third-party wallet
      await wallet.update({
        balance: mainBalance,
        last_updated: new Date()
      }, { transaction: t });
      
      // Reset main wallet balance to zero
      await user.update({
        wallet_balance: 0.00
      }, { transaction: t });
      
      await t.commit();
      
      return {
        success: true,
        wallet: await ThirdPartyWallet.findByPk(wallet.wallet_id),
        mainWalletBalanceBefore: mainBalance,
        mainWalletBalanceAfter: 0.00
      };
    } catch (error) {
      await t.rollback();
      
      // Check if error is a lock timeout
      if (error.message && error.message.includes('Lock wait timeout exceeded')) {
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retry attempt ${retryCount} for user ${userId} due to lock timeout`);
          // Wait for a random time between 100-300ms before retrying
          await new Promise(resolve => setTimeout(resolve, 100 + Math.floor(Math.random() * 200)));
          return null; // Signal for retry
        }
      }
      
      console.error('Error transferring to third-party wallet:', error);
      return {
        success: false,
        message: error.message || 'Failed to transfer balance'
      };
    }
  };
  
  // Execute with retries
  let result = null;
  do {
    result = await executeTransfer();
  } while (result === null && retryCount < maxRetries);
  
  // If still null after all retries, return an error
  if (result === null) {
    return {
      success: false,
      message: 'Failed to transfer balance after multiple attempts'
    };
  }
  
  return result;
};

/**
 * Transfer balance from third-party wallet back to main wallet
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Transfer result
 */
const transferToMainWallet = async (userId) => {
  let retryCount = 0;
  const maxRetries = 3;
  
  const executeTransfer = async () => {
    const t = await sequelize.transaction();
    
    try {
      // Get wallet with locking
      const wallet = await ThirdPartyWallet.findOne({
        where: { user_id: userId },
        lock: true,
        transaction: t
      });
      
      if (!wallet) {
        await t.rollback();
        return {
          success: false,
          message: 'Third-party wallet not found'
        };
      }
      
      // Get user with locking
      const user = await User.findByPk(userId, {
        lock: true,
        transaction: t
      });
      
      if (!user) {
        await t.rollback();
        return {
          success: false,
          message: 'User not found'
        };
      }
      
      // Get third-party wallet balance
      const thirdPartyBalance = parseFloat(wallet.balance);
      const mainBalance = parseFloat(user.wallet_balance);
      
      // Transfer all balance to main wallet
      await user.update({
        wallet_balance: mainBalance + thirdPartyBalance
      }, { transaction: t });
      
      // Reset third-party wallet balance to zero
      await wallet.update({
        balance: 0.00,
        last_updated: new Date()
      }, { transaction: t });
      
      await t.commit();
      
      return {
        success: true,
        mainWalletBalanceBefore: mainBalance,
        mainWalletBalanceAfter: mainBalance + thirdPartyBalance,
        thirdPartyWalletBalanceBefore: thirdPartyBalance,
        thirdPartyWalletBalanceAfter: 0.00
      };
    } catch (error) {
      await t.rollback();
      
      // Check if error is a lock timeout
      if (error.message && error.message.includes('Lock wait timeout exceeded')) {
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retry attempt ${retryCount} for user ${userId} due to lock timeout`);
          // Wait for a random time between 100-300ms before retrying
          await new Promise(resolve => setTimeout(resolve, 100 + Math.floor(Math.random() * 200)));
          return null; // Signal for retry
        }
      }
      
      console.error('Error transferring to main wallet:', error);
      return {
        success: false,
        message: error.message || 'Failed to transfer balance'
      };
    }
  };
  
  // Execute with retries
  let result = null;
  do {
    result = await executeTransfer();
  } while (result === null && retryCount < maxRetries);
  
  // If still null after all retries, return an error
  if (result === null) {
    return {
      success: false,
      message: 'Failed to transfer balance after multiple attempts'
    };
  }
  
  return result;
};

/**
 * Get balance from third-party wallet
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Balance info
 */
const getBalance = async (userId) => {
  try {
    // Try to find wallet
    const wallet = await ThirdPartyWallet.findOne({
      where: { user_id: userId }
    });
    
    if (!wallet) {
      return {
        success: false,
        message: 'Third-party wallet not found'
      };
    }
    
    return {
      success: true,
      balance: parseFloat(wallet.balance),
      currency: wallet.currency
    };
  } catch (error) {
    console.error('Error getting third-party wallet balance:', error);
    
    return {
      success: false,
      message: error.message || 'Failed to get balance'
    };
  }
};

/**
 * Update balance in third-party wallet (for game transactions)
 * @param {number} userId - User ID
 * @param {number} amount - Amount to add (positive) or subtract (negative)
 * @returns {Promise<Object>} Update result
 */
const updateBalance = async (userId, amount) => {
  let retryCount = 0;
  const maxRetries = 3;
  
  const executeUpdate = async () => {
    const t = await sequelize.transaction();
    
    try {
      // Get wallet with locking
      const wallet = await ThirdPartyWallet.findOne({
        where: { user_id: userId },
        lock: true,
        transaction: t
      });
      
      if (!wallet) {
        await t.rollback();
        return {
          success: false,
          message: 'Third-party wallet not found'
        };
      }
      
      // Calculate new balance
      const currentBalance = parseFloat(wallet.balance);
      const newBalance = currentBalance + parseFloat(amount);
      
      // Check for negative balance
      if (newBalance < 0) {
        await t.rollback();
        return {
          success: false,
          message: 'Insufficient funds',
          currentBalance
        };
      }
      
      // Update balance
      await wallet.update({
        balance: newBalance,
        last_updated: new Date()
      }, { transaction: t });
      
      await t.commit();
      
      return {
        success: true,
        oldBalance: currentBalance,
        newBalance,
        currency: wallet.currency
      };
    } catch (error) {
      await t.rollback();
      
      // Check if error is a lock timeout
      if (error.message && error.message.includes('Lock wait timeout exceeded')) {
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retry attempt ${retryCount} for user ${userId} due to lock timeout`);
          // Wait for a random time between 100-300ms before retrying
          await new Promise(resolve => setTimeout(resolve, 100 + Math.floor(Math.random() * 200)));
          return null; // Signal for retry
        }
      }
      
      console.error('Error updating third-party wallet balance:', error);
      return {
        success: false,
        message: error.message || 'Failed to update balance'
      };
    }
  };
  
  // Execute with retries
  let result = null;
  do {
    result = await executeUpdate();
  } while (result === null && retryCount < maxRetries);
  
  // If still null after all retries, return an error
  if (result === null) {
    return {
      success: false,
      message: 'Failed to update balance after multiple attempts'
    };
  }
  
  return result;
};

module.exports = {
  getOrCreateWallet,
  transferToThirdPartyWallet,
  transferToMainWallet,
  getBalance,
  updateBalance
}; 