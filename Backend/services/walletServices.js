const { sequelize, Op, waitForDatabase } = require('../config/db');
const { getModels } = require('../models');
const User = require('../models/User');
const WalletRecharge = require('../models/WalletRecharge');
const WalletWithdrawal = require('../models/WalletWithdrawal');
const BankAccount = require('../models/BankAccount');
const UsdtAccount = require('../models/UsdtAccount');
const ReferralCommission = require('../models/ReferralCommission');
const GameTransaction = require('../models/GameTransaction');
const SeamlessTransaction = require('../models/SeamlessTransaction');
const PaymentGateway = require('../models/PaymentGateway');
const { updateWalletBalance } = require('./walletBalanceUtils');

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

// Service to get transaction history (both recharges and withdrawals)// Service to get transaction history (both recharges and withdrawals)
const getTransactionHistory = async (userId, page = 1, limit = 10) => {
  try {
    // Wait for database to be ready
    await waitForDatabase();
    
    // Get initialized models
    const models = await getModels();
    if (!models) {
      throw new Error('Models not initialized');
    }

    const offset = (page - 1) * limit;
    
    // Get recharges with payment gateway info
    const recharges = await models.WalletRecharge.findAll({
      where: { user_id: userId },
      include: [{
        model: models.PaymentGateway,
        as: 'paymentGateway',
        attributes: ['gateway_id', 'name', 'code']
      }],
      attributes: [
        ['id', 'recharge_id'],
        'amount',
        'created_at',
        'updated_at',
        'status',
        ['id', 'order_id'],
        'payment_gateway_id',
        [sequelize.literal('"recharge"'), 'type']
      ],
      order: [['created_at', 'DESC']]
    });
    
    // Get withdrawals with payment gateway info - REMOVED withdrawal_type
    const withdrawals = await models.WalletWithdrawal.findAll({
      where: { user_id: userId },
      include: [{
        model: models.PaymentGateway,
        as: 'paymentGateway',
        attributes: ['gateway_id', 'name', 'code']
      }],
      attributes: [
        ['id', 'withdrawal_id'],
        'amount',
        'created_at',
        'updated_at',
        'status',
        ['id', 'order_id'],
        'payment_gateway_id',
        // REMOVED 'withdrawal_type' since it doesn't exist in database
        [sequelize.literal('"withdrawal"'), 'type']
      ],
      order: [['created_at', 'DESC']]
    });
    
    // Format transactions
    const formatTransactions = (transactions) => {
      return transactions.map(transaction => {
        try {
          const formattedTransaction = {
            id: transaction.recharge_id || transaction.withdrawal_id,
            type: transaction.type,
            amount: parseFloat(transaction.amount).toFixed(2),
            status: transaction.status,
            payment_method: transaction.paymentGateway ? transaction.paymentGateway.name : 'Unknown',
            payment_code: transaction.paymentGateway ? transaction.paymentGateway.code : null,
            created_at: transaction.created_at,
            updated_at: transaction.updated_at,
            order_id: transaction.order_id
          };

          // REMOVED withdrawal_type logic since column doesn't exist
          // if (transaction.type === 'withdrawal') {
          //   formattedTransaction.withdrawal_type = transaction.withdrawal_type;
          // }

          return formattedTransaction;
        } catch (err) {
          console.error('Error formatting transaction:', err, transaction);
          return null;
        }
      }).filter(Boolean); // Remove any null entries from formatting errors
    };
    
    // Combine and sort
    const allTransactions = [
      ...formatTransactions(recharges),
      ...formatTransactions(withdrawals)
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Apply pagination
    const paginatedTransactions = allTransactions.slice(offset, offset + limit);
    
    return {
      success: true,
      transactions: paginatedTransactions,
      pagination: {
        total: allTransactions.length,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(allTransactions.length / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    // Log more details about the error
    if (error.name === 'SequelizeDatabaseError') {
      console.error('Database error details:', error.original);
    }
    return {
      success: false,
      message: 'Server error fetching transaction history.'
    };
  }
};
// IMMEDIATE FIX - Replace these functions in your walletServices.js

/// CORRECTED VERSION - Replace these functions in your walletServices.js

// Service to get recharge history - FIXED
const getRechargeHistory = async (userId, page = 1, limit = 10) => {
  try {
    // Wait for database to be ready
    await waitForDatabase();
    
    // Get initialized models
    const models = await getModels();
    if (!models) {
      throw new Error('Models not initialized');
    }

    const offset = (page - 1) * limit;
    
    // Get total count
    const total = await models.WalletRecharge.count({
      where: { user_id: userId }
    });
    
    // FIXED: Corrected raw query format
    const recharges = await sequelize.query(`
      SELECT 
        wr.id,
        wr.user_id,
        wr.amount,
        wr.payment_gateway_id,
        wr.status,
        wr.bonus_amount,
        wr.order_id,
        wr.created_at,
        wr.updated_at,
        pg.name as payment_gateway_name,
        pg.code as payment_gateway_code
      FROM wallet_recharges wr
      LEFT JOIN payment_gateways pg ON wr.payment_gateway_id = pg.gateway_id
      WHERE wr.user_id = ?
      ORDER BY wr.created_at DESC
      LIMIT ? OFFSET ?
    `, {
      replacements: [userId, parseInt(limit), parseInt(offset)],
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log('Recharges query result:', recharges); // Debug log
    
    // Ensure recharges is an array
    const rechargesArray = Array.isArray(recharges) ? recharges : [];
    
    return {
      success: true,
      recharges: rechargesArray.map(recharge => ({
        id: recharge.id,
        order_id: recharge.order_id || `DEP${recharge.id}`,
        amount: parseFloat(recharge.amount).toFixed(2),
        bonus_amount: parseFloat(recharge.bonus_amount || 0).toFixed(2),
        status: recharge.status,
        payment_method: recharge.payment_gateway_name || 'Unknown',
        payment_code: recharge.payment_gateway_code || null,
        created_at: recharge.created_at,
        updated_at: recharge.updated_at
      })),
      pagination: {
        total: total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching recharge history:', error);
    console.error('Error stack:', error.stack);
    return {
      success: false,
      message: 'Server error fetching recharge history.'
    };
  }
};

// Service to get withdrawal history - FIXED
const getWithdrawalHistory = async (userId, page = 1, limit = 10) => {
  try {
    // Wait for database to be ready
    await waitForDatabase();
    
    // Get initialized models
    const models = await getModels();
    if (!models) {
      throw new Error('Models not initialized');
    }

    const offset = (page - 1) * limit;
    
    // Get total count
    const total = await models.WalletWithdrawal.count({
      where: { user_id: userId }
    });
    
    // FIXED: Corrected raw query format
    const withdrawals = await sequelize.query(`
      SELECT 
        ww.id,
        ww.user_id,
        ww.amount,
        ww.withdrawal_type,
        ww.payment_gateway_id,
        ww.transaction_id,
        ww.status,
        ww.admin_id,
        ww.rejection_reason,
        ww.created_at,
        ww.updated_at,
        pg.name as payment_gateway_name,
        pg.code as payment_gateway_code
      FROM wallet_withdrawals ww
      LEFT JOIN payment_gateways pg ON ww.payment_gateway_id = pg.gateway_id
      WHERE ww.user_id = ?
      ORDER BY ww.created_at DESC
      LIMIT ? OFFSET ?
    `, {
      replacements: [userId, parseInt(limit), parseInt(offset)],
      type: sequelize.QueryTypes.SELECT
    });
    
    console.log('Withdrawals query result:', withdrawals); // Debug log
    
    // Ensure withdrawals is an array
    const withdrawalsArray = Array.isArray(withdrawals) ? withdrawals : [];
    
    return {
      success: true,
      withdrawals: withdrawalsArray.map(withdrawal => ({
        id: withdrawal.id,
        amount: parseFloat(withdrawal.amount).toFixed(2),
        status: withdrawal.status,
        transaction_id: withdrawal.transaction_id,
        withdrawal_type: withdrawal.withdrawal_type || null,
        rejection_reason: withdrawal.rejection_reason,
        created_at: withdrawal.created_at,
        updated_at: withdrawal.updated_at
      })),
      pagination: {
        total: total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching withdrawal history:', error);
    console.error('Error stack:', error.stack);
    return {
      success: false,
      message: 'Server error fetching withdrawal history.'
    };
  }
};


// Service to process wallet recharge
const processRecharge = async (userId, amount, orderId, transactionId, paymentGateway) => {
  const t = await sequelize.transaction();

  try {
    // Get user's current deposit status
    const user = await User.findByPk(userId, {
      attributes: [
        'user_id', 
        'wallet_balance', 
        'actual_deposit_amount', 
        'bonus_amount',
        'has_received_first_bonus'
      ],
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

    // Check if this is first deposit and user hasn't received bonus yet
    const isFirstDeposit = parseFloat(user.actual_deposit_amount) === 0;
    const isEligibleForFirstBonus = isFirstDeposit && !user.has_received_first_bonus;
    let bonusAmount = 0;

    // Calculate first deposit bonus if applicable
    if (isEligibleForFirstBonus) {
      // Define bonus tiers
      const bonusTiers = [
        { amount: 100, bonus: 20 },
        { amount: 300, bonus: 60 },
        { amount: 1000, bonus: 150 },
        { amount: 3000, bonus: 300 },
        { amount: 10000, bonus: 600 },
        { amount: 30000, bonus: 2000 },
        { amount: 100000, bonus: 7000 },
        { amount: 200000, bonus: 15000 }
      ];

      // Find applicable bonus tier
      for (let i = bonusTiers.length - 1; i >= 0; i--) {
        if (parseFloat(amount) >= bonusTiers[i].amount) {
          bonusAmount = bonusTiers[i].bonus;
          break;
        }
      }
    }

    // Create recharge record
    const recharge = await WalletRecharge.create({
      user_id: userId,
      added_amount: amount,
      order_id: orderId,
      transaction_id: transactionId,
      payment_gateway: paymentGateway,
      payment_status: true,
      time_of_success: new Date(),
      bonus_amount: bonusAmount // Store bonus amount in recharge record
    }, { transaction: t });

    // Update user's actual deposit and bonus amounts
    const updateData = {
      actual_deposit_amount: parseFloat(user.actual_deposit_amount) + parseFloat(amount),
      wallet_balance: parseFloat(user.wallet_balance) + parseFloat(amount) + bonusAmount
    };

    // Only update bonus amount and flag if this is first bonus
    if (isEligibleForFirstBonus && bonusAmount > 0) {
      updateData.bonus_amount = parseFloat(user.bonus_amount) + bonusAmount;
      updateData.has_received_first_bonus = true;
    }

    await User.update(updateData, {
      where: { user_id: userId },
      transaction: t
    });

    await t.commit();

    return {
      success: true,
      message: 'Recharge processed successfully.',
      recharge: recharge,
      isFirstDeposit,
      isEligibleForFirstBonus,
      bonusAmount,
      totalAdded: parseFloat(amount) + bonusAmount
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
const processWithdrawal = async (userId, amount, orderId, transactionId, paymentGateway, withdrawalType, bank_account_id, usdt_account_id) => {
  const t = await sequelize.transaction();

  try {
    // Check if user has sufficient balance
    const user = await User.findByPk(userId, {
      attributes: ['user_id', 'wallet_balance', 'actual_deposit_amount', 'total_bet_amount'],
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

    // Check if user has sufficient balance
    if (parseFloat(user.wallet_balance) < parseFloat(amount)) {
      await t.rollback();
      return {
        success: false,
        message: 'Insufficient balance.'
      };
    }

    // Check if withdrawal amount exceeds actual deposit amount
    if (parseFloat(amount) > parseFloat(user.actual_deposit_amount)) {
      await t.rollback();
      return {
        success: false,
        message: 'Withdrawal amount cannot exceed your actual deposit amount.'
      };
    }

    // Check if user has bet their actual deposit amount
    if (parseFloat(user.total_bet_amount) < parseFloat(user.actual_deposit_amount)) {
      await t.rollback();
      return {
        success: false,
        message: 'You must bet your actual deposit amount before withdrawing.'
      };
    }

    // Get payment gateway ID
    const gateway = await PaymentGateway.findOne({
      where: { code: paymentGateway },
      transaction: t
    });

    if (!gateway) {
      await t.rollback();
      return {
        success: false,
        message: 'Invalid payment gateway.'
      };
    }

    // Prepare withdrawal data
    const withdrawalData = {
      user_id: userId,
      amount: amount,
      payment_gateway_id: gateway.gateway_id,
      transaction_id: transactionId,
      status: 'pending',
      withdrawal_type: withdrawalType,
      created_at: new Date(),
      updated_at: new Date()
    };
    if (withdrawalType === 'BANK') {
      withdrawalData.bank_account_id = bank_account_id;
    } else if (withdrawalType === 'USDT') {
      withdrawalData.usdt_account_id = usdt_account_id;
    }

    // Create withdrawal record
    const withdrawal = await WalletWithdrawal.create(withdrawalData, { transaction: t });

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