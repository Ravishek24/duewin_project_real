import User from '../models/User.js';
import WalletRecharge from '../models/WalletRecharge.js';
import WalletWithdrawal from '../models/WalletWithdrawal.js';
import { sequelize } from '../config/db.js';
import { Op } from 'sequelize';

// Service to get user wallet balance
export const getWalletBalance = async (userId) => {
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
        payment_status: true
      },
      order: [['time_of_success', 'DESC']],
      limit: 1,
      attributes: ['added_amount', 'time_of_success']
    });

    const recentWithdrawals = await WalletWithdrawal.findAll({
      where: { 
        user_id: userId,
        payment_status: true
      },
      order: [['time_of_success', 'DESC']],
      limit: 1,
      attributes: ['withdrawal_amount', 'time_of_success']
    });

    // Count successful transactions
    const totalRecharges = await WalletRecharge.count({
      where: { 
        user_id: userId,
        payment_status: true
      }
    });

    const totalWithdrawals = await WalletWithdrawal.count({
      where: { 
        user_id: userId,
        payment_status: true
      }
    });

    return {
      success: true,
      wallet: {
        balance: parseFloat(user.wallet_balance).toFixed(2),
        lastRecharge: recentRecharges.length > 0 ? {
          amount: parseFloat(recentRecharges[0].added_amount).toFixed(2),
          date: recentRecharges[0].time_of_success
        } : null,
        lastWithdrawal: recentWithdrawals.length > 0 ? {
          amount: parseFloat(recentWithdrawals[0].withdrawal_amount).toFixed(2),
          date: recentWithdrawals[0].time_of_success
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
export const getTransactionHistory = async (userId, page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get recharges
    const recharges = await WalletRecharge.findAll({
      where: { user_id: userId },
      attributes: [
        'recharge_id',
        'added_amount',
        'time_of_request',
        'time_of_success',
        'payment_status',
        'order_id',
        'transaction_id',
        'payment_gateway',
        [sequelize.literal('"recharge"'), 'type']
      ],
      order: [['time_of_request', 'DESC']]
    });
    
    // Get withdrawals
    const withdrawals = await WalletWithdrawal.findAll({
      where: { user_id: userId },
      attributes: [
        'withdrawal_id',
        'withdrawal_amount',
        'time_of_request',
        'time_of_success',
        'time_of_failed',
        'payment_status',
        'order_id',
        'transaction_id',
        'payment_gateway',
        'withdrawal_type',
        [sequelize.literal('"withdrawal"'), 'type']
      ],
      order: [['time_of_request', 'DESC']]
    });
    
    // Combine and sort
    const allTransactions = [...recharges, ...withdrawals].sort((a, b) => {
      const dateA = new Date(a.time_of_request);
      const dateB = new Date(b.time_of_request);
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
export const getRechargeHistory = async (userId, page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get total count
    const total = await WalletRecharge.count({
      where: { user_id: userId }
    });
    
    // Get recharges with pagination
    const recharges = await WalletRecharge.findAll({
      where: { user_id: userId },
      order: [['time_of_request', 'DESC']],
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
export const getWithdrawalHistory = async (userId, page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get total count
    const total = await WalletWithdrawal.count({
      where: { user_id: userId }
    });
    
    // Get withdrawals with pagination
    const withdrawals = await WalletWithdrawal.findAll({
      where: { user_id: userId },
      order: [['time_of_request', 'DESC']],
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
export const updateWalletBalance = async (userId, amount, type, transaction = null) => {
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
      if (parseFloat(user.wallet_balance) < parseFloat(amount)) {
        if (!transaction) await t.rollback();
        return {
          success: false,
          message: 'Insufficient wallet balance.'
        };
      }
      newBalance = parseFloat(user.wallet_balance) - parseFloat(amount);
    } else {
      if (!transaction) await t.rollback();
      return {
        success: false,
        message: 'Invalid operation type.'
      };
    }

    // Update user wallet balance
    await User.update(
      { wallet_balance: newBalance },
      { 
        where: { user_id: userId },
        transaction: t 
      }
    );

    // If no external transaction was provided, commit this one
    if (!transaction) await t.commit();

    return {
      success: true,
      newBalance: newBalance
    };
  } catch (error) {
    // If no external transaction was provided, rollback this one
    if (!transaction) await t.rollback();
    
    console.error('Error updating wallet balance:', error);
    return {
      success: false,
      message: 'Server error updating wallet balance.'
    };
  }
};

export default {
  getWalletBalance,
  getTransactionHistory,
  getRechargeHistory,
  getWithdrawalHistory,
  updateWalletBalance
};