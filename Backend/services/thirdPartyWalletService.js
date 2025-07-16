// services/thirdPartyWalletService.js - FIXED VERSION
const { sequelize } = require('../config/db');
const ThirdPartyWallet = require('../models/ThirdPartyWallet');
const User = require('../models/User');

/**
 * FIXED: Create a third-party wallet for a user (method was missing)
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Creation result
 */
const createWallet = async (userId) => {
  const t = await sequelize.transaction();
  
  try {
    console.log(`Creating third-party wallet for user ${userId}`);
    
    // Check if wallet already exists
    const existingWallet = await ThirdPartyWallet.findOne({
      where: { user_id: userId },
      transaction: t
    });
    
    if (existingWallet) {
      await t.commit();
      console.log(`Wallet already exists for user ${userId}`);
      return {
        success: true,
        wallet: existingWallet,
        message: 'Wallet already exists'
      };
    }
    
    // Create new wallet with 0 balance
    const wallet = await ThirdPartyWallet.create({
      user_id: userId,
      balance: 0.00,
      currency: 'USD', // Changed from EUR to USD
      is_active: true,
      last_updated: new Date()
    }, { transaction: t });
    
    await t.commit();
    
    console.log(`Created third-party wallet for user ${userId} with ID ${wallet.wallet_id}`);
    
    return {
      success: true,
      wallet,
      message: 'Wallet created successfully'
    };
  } catch (error) {
    await t.rollback();
    console.error('Error creating third-party wallet:', error);
    
    return {
      success: false,
      message: error.message || 'Failed to create wallet'
    };
  }
};

/**
 * FIXED: Get or create a third-party wallet for a user
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
      console.log(`Creating new third-party wallet for user ${userId}`);
      wallet = await ThirdPartyWallet.create({
        user_id: userId,
        balance: 0.00,
        currency: 'USD', // Changed from EUR to USD
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
 * FIXED: Transfer balance from main wallet to third-party wallet
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Transfer result
 */
const transferToThirdPartyWallet = async (userId) => {
  let retryCount = 0;
  const maxRetries = 3;
  
  const executeTransfer = async () => {
    const t = await sequelize.transaction();
    
    try {
      console.log(`Starting transfer to third-party wallet for user ${userId}`);
      
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
      
      console.log(`User ${userId} main wallet balance: ${user.wallet_balance}`);
      
      // Check if user has any balance to transfer
      const mainBalance = parseFloat(user.wallet_balance);
      if (mainBalance <= 0) {
        await t.rollback();
        console.log(`No funds to transfer for user ${userId}`);
        return {
          success: false,
          message: 'No funds available in main wallet',
          mainBalance
        };
      }
      
      // Get or create wallet - pass the transaction to avoid nested transactions
      const walletResult = await getOrCreateWallet(userId, t);
      if (!walletResult.success) {
        await t.rollback();
        return walletResult; // Return error
      }
      
      const wallet = walletResult.wallet;
      console.log(`Third-party wallet current balance: ${wallet.balance}`);
      
      // FIXED: Always transfer funds, even if wallet has balance
      // This ensures the user can play with their full balance
      const currentThirdPartyBalance = parseFloat(wallet.balance);
      const newThirdPartyBalance = currentThirdPartyBalance + mainBalance;
      
      // Transfer balance to third-party wallet
      await wallet.update({
        balance: newThirdPartyBalance,
        last_updated: new Date()
      }, { transaction: t });
      
      // Reset main wallet balance to zero
      await user.update({
        wallet_balance: 0.00
      }, { transaction: t });
      
      await t.commit();
      
      console.log(`Transfer successful for user ${userId}: ${mainBalance} transferred to third-party wallet`);
      
      return {
        success: true,
        wallet: await ThirdPartyWallet.findByPk(wallet.wallet_id),
        mainWalletBalanceBefore: mainBalance,
        mainWalletBalanceAfter: 0.00,
        thirdPartyWalletBalanceBefore: currentThirdPartyBalance,
        thirdPartyWalletBalanceAfter: newThirdPartyBalance,
        transferAmount: mainBalance
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
      console.log(`Starting transfer to main wallet for user ${userId}`);
      
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
      
      // Get balances
      const thirdPartyBalance = parseFloat(wallet.balance);
      const mainBalance = parseFloat(user.wallet_balance);
      
      console.log(`Transferring ${thirdPartyBalance} from third-party to main wallet for user ${userId}`);
      
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
      
      console.log(`Transfer to main wallet successful for user ${userId}`);
      
      return {
        success: true,
        mainWalletBalanceBefore: mainBalance,
        mainWalletBalanceAfter: mainBalance + thirdPartyBalance,
        thirdPartyWalletBalanceBefore: thirdPartyBalance,
        thirdPartyWalletBalanceAfter: 0.00,
        transferAmount: thirdPartyBalance
      };
    } catch (error) {
      await t.rollback();
      
      // Check if error is a lock timeout
      if (error.message && error.message.includes('Lock wait timeout exceeded')) {
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retry attempt ${retryCount} for user ${userId} due to lock timeout`);
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
  
  if (result === null) {
    return {
      success: false,
      message: 'Failed to transfer balance after multiple attempts'
    };
  }
  
  return result;
};

/**
 * FIXED: Get balance from third-party wallet with better error handling
 * @param {number} userId - User ID
 * @param {string} currency - Currency code (USD or EUR)
 * @returns {Promise<Object>} Balance info
 */
const getBalance = async (userId, currency = 'USD') => {
  try {
    console.log(`Getting balance for user ${userId} in ${currency}`);
    
    // Try to find wallet
    const wallet = await ThirdPartyWallet.findOne({
      where: { user_id: userId }
    });
    
    if (!wallet) {
      console.log(`No third-party wallet found for user ${userId}`);
      return {
        success: false,
        message: 'Third-party wallet not found',
        balance: 0
      };
    }
    
    const balance = parseFloat(wallet.balance);
    console.log(`Third-party wallet balance for user ${userId}: ${balance} ${wallet.currency}`);
    
    // If requested currency matches wallet currency, return as is
    if (wallet.currency === currency) {
      return {
        success: true,
        balance: balance,
        currency: currency
      };
    }
    
    // Convert between EUR and USD
    const conversionRate = 1.0; // 1 EUR = 1.08 USD
    
    if (wallet.currency === 'EUR' && currency === 'USD') {
      const usdBalance = balance * conversionRate;
      console.log(`Converted balance from EUR to USD: ${balance} EUR = ${usdBalance} USD`);
      return {
        success: true,
        balance: usdBalance,
        currency: 'USD'
      };
    }
    
    if (wallet.currency === 'USD' && currency === 'EUR') {
      const eurBalance = balance / conversionRate;
      console.log(`Converted balance from USD to EUR: ${balance} USD = ${eurBalance} EUR`);
      return {
        success: true,
        balance: eurBalance,
        currency: 'EUR'
      };
    }
    
    // If currencies don't match and can't be converted, return error
    return {
      success: false,
      message: `Cannot convert from ${wallet.currency} to ${currency}`,
      balance: 0
    };
  } catch (error) {
    console.error('Error getting third-party wallet balance:', error);
    
    return {
      success: false,
      message: error.message || 'Failed to get balance',
      balance: 0
    };
  }
};

/**
 * FIXED: Update balance in third-party wallet with better logging
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
      console.log(`Updating balance for user ${userId}: ${amount > 0 ? '+' : ''}${amount}`);
      
      // Get wallet with locking
      const wallet = await ThirdPartyWallet.findOne({
        where: { user_id: userId },
        lock: true,
        transaction: t
      });
      
      if (!wallet) {
        await t.rollback();
        console.error(`Third-party wallet not found for user ${userId}`);
        return {
          success: false,
          message: 'Third-party wallet not found'
        };
      }
      
      // Calculate new balance
      const currentBalance = parseFloat(wallet.balance);
      const newBalance = currentBalance + parseFloat(amount);
      
      console.log(`Current balance: ${currentBalance}, Change: ${amount}, New balance: ${newBalance}`);
      
      // Check for negative balance
      if (newBalance < 0) {
        await t.rollback();
        console.error(`Insufficient funds for user ${userId}: current ${currentBalance}, requested ${amount}`);
        return {
          success: false,
          message: 'Insufficient funds',
          currentBalance
        };
      }
      
      // Update balance
      await wallet.update({
        balance: newBalance.toFixed(2), // Ensure proper decimal formatting
        last_updated: new Date()
      }, { transaction: t });
      
      await t.commit();
      
      console.log(`Balance update successful for user ${userId}: ${currentBalance} -> ${newBalance}`);
      
      return {
        success: true,
        oldBalance: currentBalance,
        newBalance: parseFloat(newBalance.toFixed(2)),
        currency: wallet.currency
      };
    } catch (error) {
      await t.rollback();
      
      // Check if error is a lock timeout
      if (error.message && error.message.includes('Lock wait timeout exceeded')) {
        if (retryCount < maxRetries) {
          retryCount++;
          console.log(`Retry attempt ${retryCount} for user ${userId} due to lock timeout`);
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
  
  if (result === null) {
    return {
      success: false,
      message: 'Failed to update balance after multiple attempts'
    };
  }
  
  return result;
};

/**
 * ADDED: Check if wallet exists and has balance
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Wallet status
 */
const walletExists = async (userId) => {
  try {
    const wallet = await ThirdPartyWallet.findOne({
      where: { user_id: userId }
    });
    
    return {
      exists: !!wallet,
      balance: wallet ? parseFloat(wallet.balance) : 0,
      currency: wallet ? wallet.currency : 'USD'
    };
  } catch (error) {
    console.error('Error checking wallet existence:', error);
    return {
      exists: false,
      balance: 0,
      currency: 'USD'
    };
  }
};

module.exports = {
  createWallet, // ADDED: This method was missing
  getOrCreateWallet,
  transferToThirdPartyWallet,
  transferToMainWallet,
  getBalance,
  updateBalance,
  walletExists // ADDED: Helper method
};