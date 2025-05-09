const { sequelize } = require('../config/db');
const { Op } = require('sequelize');
const User = require('../models/User');
const WalletRecharge = require('../models/WalletRecharge');
const WalletWithdrawal = require('../models/WalletWithdrawal');
const BankAccount = require('../models/BankAccount');
const UsdtAccount = require('../models/UsdtAccount');
const ReferralCommission = require('../models/ReferralCommission');
const GameTransaction = require('../models/GameTransaction');
const SeamlessTransaction = require('../models/SeamlessTransaction');

// Service to get user wallet balance
const getWalletBalance = async (userId) => {
  try {
    const user = await User.findByPk(userId, {
      attributes: ['user_id', 'wallet_balance']
    });

    if (!user) {
      return {
        success: false,
        message: 'User not found.'
      };
    }

    // Get recent transactions
    const recentRecharges = await WalletRecharge.findAll({
      where: { 
        user_id: userId,
        status: 'completed'
      },
      order: [['updated_at', 'DESC']],
      limit: 1,
      attributes: ['amount', 'updated_at']
    });

    const recentWithdrawals = await WalletWithdrawal.findAll({
      where: { 
        user_id: userId,
        status: 'completed'
      },
      order: [['updated_at', 'DESC']],
      limit: 1,
      attributes: ['amount', 'updated_at']
    });

    // Count successful transactions
    const totalRecharges = await WalletRecharge.count({
      where: { 
        user_id: userId,
        status: 'completed'
      }
    });

    const totalWithdrawals = await WalletWithdrawal.count({
      where: { 
        user_id: userId,
        status: 'completed'
      }
    });

    return {
      success: true,
      wallet: {
        balance: parseFloat(user.wallet_balance).toFixed(2),
        lastRecharge: recentRecharges.length > 0 ? {
          amount: parseFloat(recentRecharges[0].amount).toFixed(2),
          date: recentRecharges[0].updated_at
        } : null,
        lastWithdrawal: recentWithdrawals.length > 0 ? {
          amount: parseFloat(recentWithdrawals[0].amount).toFixed(2),
          date: recentWithdrawals[0].updated_at
        } : null,
        totalRecharges: totalRecharges,
        totalWithdrawals: totalWithdrawals
      }
    };
  } catch (error) {
    console.error('Error fetching wallet balance:', error);
    return {
      success: false,
      message: 'Server error fetching wallet balance.'
    };
  }
};

// Service to get transaction history (both recharges and withdrawals)
const getTransactionHistory = async (userId, page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get recharges
    const recharges = await WalletRecharge.findAll({
      where: { user_id: userId },
      attributes: [
        ['id', 'recharge_id'],
        'amount',
        'created_at',
        'updated_at',
        'status',
        ['id', 'order_id'],
        ['payment_gateway_id', 'payment_gateway'],
        [sequelize.literal('"recharge"'), 'type']
      ],
      order: [['created_at', 'DESC']]
    });
    
    // Get withdrawals
    const withdrawals = await WalletWithdrawal.findAll({
      where: { user_id: userId },
      attributes: [
        ['id', 'withdrawal_id'],
        'amount',
        'created_at',
        'updated_at',
        'status',
        ['id', 'order_id'],
        ['payment_gateway_id', 'payment_gateway'],
        'withdrawal_type',
        [sequelize.literal('"withdrawal"'), 'type']
      ],
      order: [['created_at', 'DESC']]
    });
    
    // Combine and sort
    const allTransactions = [...recharges, ...withdrawals].sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return dateB - dateA;
    });
    
    // Apply pagination
    const paginatedTransactions = allTransactions.slice(offset, offset + limit);
    
    return {
      success: true,
      transactions: paginatedTransactions,
      pagination: {
        total: allTransactions.length,
        page: page,
        limit: limit,
        pages: Math.ceil(allTransactions.length / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    return {
      success: false,
      message: 'Server error fetching transaction history.'
    };
  }
};

// Service to get recharge history
const getRechargeHistory = async (userId, page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get total count
    const total = await WalletRecharge.count({
      where: { user_id: userId }
    });
    
    // Get recharges with pagination
    const recharges = await WalletRecharge.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit: limit,
      offset: offset
    });
    
    return {
      success: true,
      recharges: recharges,
      pagination: {
        total: total,
        page: page,
        limit: limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching recharge history:', error);
    return {
      success: false,
      message: 'Server error fetching recharge history.'
    };
  }
};

// Service to get withdrawal history
const getWithdrawalHistory = async (userId, page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get total count
    const total = await WalletWithdrawal.count({
      where: { user_id: userId }
    });
    
    // Get withdrawals with pagination
    const withdrawals = await WalletWithdrawal.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit: limit,
      offset: offset
    });
    
    return {
      success: true,
      withdrawals: withdrawals,
      pagination: {
        total: total,
        page: page,
        limit: limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching withdrawal history:', error);
    return {
      success: false,
      message: 'Server error fetching withdrawal history.'
    };
  }
};

// Service to update wallet balance (internal use only)
const updateWalletBalance = async (userId, amount, type, transaction = null) => {
  const t = transaction || await sequelize.transaction();

  try {
    // Lock the user row for update to prevent race conditions
    const user = await User.findByPk(userId, {
      attributes: ['user_id', 'wallet_balance'],
      lock: true,
      transaction: t
    });

    if (!user) {
      if (!transaction) await t.rollback();
      return {
        success: false,
        message: 'User not found.'
      };
    }

    let newBalance;
    
    if (type === 'add') {
      // Credit to wallet
      newBalance = parseFloat(user.wallet_balance) + parseFloat(amount);
    } else if (type === 'subtract') {
      // Debit from wallet
      newBalance = parseFloat(user.wallet_balance) - parseFloat(amount);
      
      // Check for insufficient balance
      if (newBalance < 0) {
        if (!transaction) await t.rollback();
        return {
          success: false,
          message: 'Insufficient balance.'
        };
      }
    } else {
      if (!transaction) await t.rollback();
      return {
        success: false,
        message: 'Invalid operation type.'
      };
    }

    // Update balance
    await user.update({
      wallet_balance: newBalance
    }, { transaction: t });

    if (!transaction) await t.commit();

    return {
      success: true,
      newBalance: newBalance
    };
  } catch (error) {
    if (!transaction) await t.rollback();
    console.error('Error updating wallet balance:', error);
    return {
      success: false,
      message: 'Server error updating wallet balance.'
    };
  }
};

// Service to process wallet recharge
const processRecharge = async (userId, amount, orderId, transactionId, paymentGateway) => {
  const t = await sequelize.transaction();

  try {
    // Create recharge record
    const recharge = await WalletRecharge.create({
      user_id: userId,
      added_amount: amount,
      order_id: orderId,
      transaction_id: transactionId,
      payment_gateway: paymentGateway,
      payment_status: true,
      time_of_success: new Date()
    }, { transaction: t });

    // Update wallet balance
    const balanceResult = await updateWalletBalance(userId, amount, 'add', t);

    if (!balanceResult.success) {
      await t.rollback();
      return balanceResult;
    }

    await t.commit();

    return {
      success: true,
      message: 'Recharge processed successfully.',
      recharge: recharge,
      newBalance: balanceResult.newBalance
    };
  } catch (error) {
    await t.rollback();
    console.error('Error processing recharge:', error);
    return {
      success: false,
      message: 'Server error processing recharge.'
    };
  }
};

// Service to process wallet withdrawal
const processWithdrawal = async (userId, amount, orderId, transactionId, paymentGateway, withdrawalType) => {
  const t = await sequelize.transaction();

  try {
    // Check if user has sufficient balance
    const user = await User.findByPk(userId, {
      attributes: ['user_id', 'wallet_balance'],
      lock: true,
      transaction: t
    });

    if (!user) {
      await t.rollback();
      return {
        success: false,
        message: 'User not found.'
      };
    }

    if (parseFloat(user.wallet_balance) < parseFloat(amount)) {
      await t.rollback();
      return {
        success: false,
        message: 'Insufficient balance.'
      };
    }

    // Create withdrawal record
    const withdrawal = await WalletWithdrawal.create({
      user_id: userId,
      withdrawal_amount: amount,
      order_id: orderId,
      transaction_id: transactionId,
      payment_gateway: paymentGateway,
      withdrawal_type: withdrawalType,
      payment_status: true,
      time_of_success: new Date()
    }, { transaction: t });

    // Update wallet balance
    const balanceResult = await updateWalletBalance(userId, amount, 'subtract', t);

    if (!balanceResult.success) {
      await t.rollback();
      return balanceResult;
    }

    await t.commit();

    return {
      success: true,
      message: 'Withdrawal processed successfully.',
      withdrawal: withdrawal,
      newBalance: balanceResult.newBalance
    };
  } catch (error) {
    await t.rollback();
    console.error('Error processing withdrawal:', error);
    return {
      success: false,
      message: 'Server error processing withdrawal.'
    };
  }
};

// Service to get user's bank accounts
const getBankAccounts = async (userId) => {
  try {
    const bankAccounts = await BankAccount.findAll({
      where: { user_id: userId },
      order: [['is_primary', 'DESC'], ['created_at', 'DESC']]
    });

    return {
      success: true,
      bankAccounts: bankAccounts
    };
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    return {
      success: false,
      message: 'Server error fetching bank accounts.'
    };
  }
};

// Service to get user's USDT accounts
const getUsdtAccounts = async (userId) => {
  try {
    const usdtAccounts = await UsdtAccount.findAll({
      where: { user_id: userId },
      order: [['is_primary', 'DESC'], ['created_at', 'DESC']]
    });

    return {
      success: true,
      usdtAccounts: usdtAccounts
    };
  } catch (error) {
    console.error('Error fetching USDT accounts:', error);
    return {
      success: false,
      message: 'Server error fetching USDT accounts.'
    };
  }
};

// Service to add a bank account
const addBankAccount = async (userId, accountData) => {
  const t = await sequelize.transaction();

  try {
    const { 
      bank_name, 
      account_number,
      account_holder_name,
      ifsc_code,
      is_primary = false 
    } = accountData;

    // Check if this is the first account (should be primary)
    const existingAccounts = await BankAccount.count({
      where: { user_id: userId },
      transaction: t
    });

    const shouldBePrimary = existingAccounts === 0 ? true : is_primary;

    // If this account should be primary, unset primary from all other accounts
    if (shouldBePrimary) {
      await BankAccount.update(
        { is_primary: false },
        { 
          where: { user_id: userId },
          transaction: t 
        }
      );
    }

    // Create the new bank account
    const newBankAccount = await BankAccount.create({
      user_id: userId,
      bank_name,
      account_number,
      account_holder_name,
      ifsc_code,
      is_primary: shouldBePrimary
    }, { transaction: t });

    await t.commit();

    return {
      success: true,
      message: 'Bank account added successfully.',
      bankAccount: newBankAccount
    };
  } catch (error) {
    await t.rollback();
    console.error('Error adding bank account:', error);
    return {
      success: false,
      message: 'Server error adding bank account.'
    };
  }
};

// Service to add a USDT account
const addUsdtAccount = async (userId, accountData) => {
  const t = await sequelize.transaction();

  try {
    const { 
      wallet_address, 
      network_type,
      is_primary = false 
    } = accountData;

    // Check if this is the first account (should be primary)
    const existingAccounts = await UsdtAccount.count({
      where: { user_id: userId },
      transaction: t
    });

    const shouldBePrimary = existingAccounts === 0 ? true : is_primary;

    // If this account should be primary, unset primary from all other accounts
    if (shouldBePrimary) {
      await UsdtAccount.update(
        { is_primary: false },
        { 
          where: { user_id: userId },
          transaction: t 
        }
      );
    }

    // Create the new USDT account
    const newUsdtAccount = await UsdtAccount.create({
      user_id: userId,
      wallet_address,
      network_type,
      is_primary: shouldBePrimary
    }, { transaction: t });

    await t.commit();

    return {
      success: true,
      message: 'USDT account added successfully.',
      usdtAccount: newUsdtAccount
    };
  } catch (error) {
    await t.rollback();
    console.error('Error adding USDT account:', error);
    return {
      success: false,
      message: 'Server error adding USDT account.'
    };
  }
};

// Service to delete a bank account
const deleteBankAccount = async (userId, accountId) => {
  const t = await sequelize.transaction();

  try {
    // Check if the account exists and belongs to the user
    const bankAccount = await BankAccount.findOne({
      where: {
        bank_account_id: accountId,
        user_id: userId
      },
      transaction: t
    });

    if (!bankAccount) {
      await t.rollback();
      return {
        success: false,
        message: 'Bank account not found or does not belong to the user.'
      };
    }

    const wasPrimary = bankAccount.is_primary;

    // Delete the bank account
    await BankAccount.destroy({
      where: {
        bank_account_id: accountId,
        user_id: userId
      },
      transaction: t
    });

    // If this was a primary account, set another account as primary
    if (wasPrimary) {
      const anotherAccount = await BankAccount.findOne({
        where: { user_id: userId },
        order: [['created_at', 'DESC']],
        transaction: t
      });

      if (anotherAccount) {
        await BankAccount.update(
          { is_primary: true },
          { 
            where: { bank_account_id: anotherAccount.bank_account_id },
            transaction: t 
          }
        );
      }
    }

    await t.commit();

    return {
      success: true,
      message: 'Bank account deleted successfully.'
    };
  } catch (error) {
    await t.rollback();
    console.error('Error deleting bank account:', error);
    return {
      success: false,
      message: 'Server error deleting bank account.'
    };
  }
};

// Service to delete a USDT account
const deleteUsdtAccount = async (userId, accountId) => {
  const t = await sequelize.transaction();

  try {
    // Check if the account exists and belongs to the user
    const usdtAccount = await UsdtAccount.findOne({
      where: {
        usdt_account_id: accountId,
        user_id: userId
      },
      transaction: t
    });

    if (!usdtAccount) {
      await t.rollback();
      return {
        success: false,
        message: 'USDT account not found or does not belong to the user.'
      };
    }

    const wasPrimary = usdtAccount.is_primary;

    // Delete the USDT account
    await UsdtAccount.destroy({
      where: {
        usdt_account_id: accountId,
        user_id: userId
      },
      transaction: t
    });

    // If this was a primary account, set another account as primary
    if (wasPrimary) {
      const anotherAccount = await UsdtAccount.findOne({
        where: { user_id: userId },
        order: [['created_at', 'DESC']],
        transaction: t
      });

      if (anotherAccount) {
        await UsdtAccount.update(
          { is_primary: true },
          { 
            where: { usdt_account_id: anotherAccount.usdt_account_id },
            transaction: t 
          }
        );
      }
    }

    await t.commit();

    return {
      success: true,
      message: 'USDT account deleted successfully.'
    };
  } catch (error) {
    await t.rollback();
    console.error('Error deleting USDT account:', error);
    return {
      success: false,
      message: 'Server error deleting USDT account.'
    };
  }
};

// Service to get commission history
const getCommissionHistory = async (userId, page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get total count
    const total = await ReferralCommission.count({
      where: { user_id: userId }
    });
    
    // Get commissions with pagination
    const commissions = await ReferralCommission.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit: limit,
      offset: offset
    });
    
    return {
      success: true,
      commissions: commissions,
      pagination: {
        total: total,
        page: page,
        limit: limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching commission history:', error);
    return {
      success: false,
      message: 'Server error fetching commission history.'
    };
  }
};

// Service to get game transaction history
const getGameTransactionHistory = async (userId, page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get total count
    const total = await GameTransaction.count({
      where: { user_id: userId }
    });
    
    // Get transactions with pagination
    const transactions = await GameTransaction.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit: limit,
      offset: offset
    });
    
    return {
      success: true,
      transactions: transactions,
      pagination: {
        total: total,
        page: page,
        limit: limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching game transaction history:', error);
    return {
      success: false,
      message: 'Server error fetching game transaction history.'
    };
  }
};

// Service to get seamless transaction history
const getSeamlessTransactionHistory = async (userId, page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get total count
    const total = await SeamlessTransaction.count({
      where: { user_id: userId }
    });
    
    // Get transactions with pagination
    const transactions = await SeamlessTransaction.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit: limit,
      offset: offset
    });
    
    return {
      success: true,
      transactions: transactions,
      pagination: {
        total: total,
        page: page,
        limit: limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching seamless transaction history:', error);
    return {
      success: false,
      message: 'Server error fetching seamless transaction history.'
    };
  }
};

module.exports = {
  getWalletBalance,
  getTransactionHistory,
  getRechargeHistory,
  getWithdrawalHistory,
  updateWalletBalance,
  processRecharge,
  processWithdrawal,
  getBankAccounts,
  getUsdtAccounts,
  addBankAccount,
  addUsdtAccount,
  deleteBankAccount,
  deleteUsdtAccount,
  getCommissionHistory,
  getGameTransactionHistory,
  getSeamlessTransactionHistory
};