const axios = require('axios');
const { sequelize } = require('../config/db');
const { paymentConfig } = require('../config/paymentConfig');
const { generateSignature } = require('../utils/generateSignature');
const User = require('../models/User');
const WalletRecharge = require('../models/WalletRecharge');
const WalletWithdrawal = require('../models/WalletWithdrawal');
const BankAccount = require('../models/BankAccount');
const WithdrawalAdmin = require('../models/WithdrawalAdmin');
const referralService = require('./referralService');
const otpService = require('./otpService');
const { processWePayTransfer } = require('./wePayService');
const { processMxPayTransfer } = require('./mxPayService');
const { Op } = require('sequelize');

/**
 * Creates a PayIn order (deposit)
 * @param {number} userId - User ID
 * @param {string} orderId - Unique order number
 * @param {string} payType - Payment method (UPI)
 * @param {number} amount - Amount (Integer)
 * @param {string} notifyUrl - Callback URL for notifications
 * @returns {Object} - API response
 */
const createPayInOrder = async (userId, orderId, payType, amount, notifyUrl) => {
  const t = await sequelize.transaction();
  
  try {
    // Get user info
    const user = await User.findByPk(userId, { transaction: t });
    if (!user) {
      await t.rollback();
      return {
        success: false, 
        message: "User not found"
      };
    }
    
    // Create recharge record
    await WalletRecharge.create({
      user_id: userId,
      phone_no: user.phone_no,
      amount: amount,
      order_id: orderId,
      payment_gateway: 'OKPAY',
      status: false
    }, { transaction: t });
    
    // Prepare request data
    const requestData = {
      mchId: paymentConfig.mchId,
      currency: "INR",
      out_trade_no: orderId,
      pay_type: payType,
      money: parseInt(amount), // Must be integer
      attach: `Wallet recharge for user ${userId}`,
      notify_url: notifyUrl,
      returnUrl: process.env.FRONTEND_URL || "https://www.yourdomain.com/wallet",
    };

    // Generate the signature
    requestData.sign = generateSignature(requestData);

    // Call the payment gateway API
    const response = await axios.post(`${paymentConfig.host}/v1/Collect`, requestData, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    
    // Check API response
    if (response.data.code === 0) {
      // Update recharge record with transaction ID
      await WalletRecharge.update(
        { transaction_id: response.data.data.transaction_Id },
        { 
          where: { order_id: orderId },
          transaction: t 
        }
      );
      
      await t.commit();
      
      return {
        success: true,
        message: "Payment order created successfully",
        paymentUrl: response.data.data.url,
        transactionId: response.data.data.transaction_Id,
        orderId: orderId
      };
    } else {
      await t.rollback();
      
      return {
        success: false,
        message: `Payment gateway error: ${response.data.msg}`,
        errorCode: response.data.code
      };
    }
  } catch (error) {
    await t.rollback();
    console.error("Error creating PayIn order:", error.message);
    
    return {
      success: false,
      message: "Failed to create payment order"
    };
  }
};

/**
 * Initial step for withdrawal - create a withdrawal request
 * @param {number} userId - User ID
 * @param {number} bankAccountId - Bank account ID
 * @param {number} amount - Withdrawal amount
 * @param {string} withdrawalType - BANK or UPI
 * @returns {Object} - Response with withdrawal details
 */
const initiateWithdrawal = async (userId, bankAccountId, amount, withdrawalType = 'BANK') => {
  const t = await sequelize.transaction();
  
  try {
    // Get user
    const user = await User.findByPk(userId, {
      transaction: t
    });
    
    if (!user) {
      await t.rollback();
      return {
        success: false,
        message: "User not found"
      };
    }
    
    // Check wallet balance
    if (parseFloat(user.wallet_balance) < parseFloat(amount)) {
      await t.rollback();
      return {
        success: false,
        message: "Insufficient wallet balance"
      };
    }
    
    // Get bank account details
    const bankAccount = await BankAccount.findOne({
      where: {
        bank_account_id: bankAccountId,
        user_id: userId
      },
      transaction: t
    });
    
    if (!bankAccount) {
      await t.rollback();
      return {
        success: false,
        message: "Bank account not found"
      };
    }
    
    // Create order ID
    const orderId = `PO${Date.now()}${userId}`;
    
    // Create withdrawal record
    const withdrawal = await WalletWithdrawal.create({
      user_id: userId,
      amount: amount,
      status: 'pending',
      payment_gateway_id: 1, // Default gateway ID
      withdrawal_type: withdrawalType,
      transaction_id: orderId,
      bank_account_id: bankAccountId
    }, { transaction: t });
    
    // Create admin approval record
    await WithdrawalAdmin.create({
      withdrawal_id: withdrawal.id,
      status: 'pending',
      notes: `Withdrawal request initiated by user. Amount: ${amount} INR.`
    }, { transaction: t });
    
    // Deduct amount from wallet
    const newBalance = parseFloat(user.wallet_balance) - parseFloat(amount);
    await User.update(
      { wallet_balance: newBalance },
      { where: { user_id: userId }, transaction: t }
    );
    
    await t.commit();
    
    return {
      success: true,
      message: "Withdrawal request submitted successfully. Awaiting admin approval.",
      withdrawal: {
        id: withdrawal.id,
        amount,
        status: 'pending',
        created_at: withdrawal.created_at
      }
    };
  } catch (error) {
    await t.rollback();
    console.error("Error initiating withdrawal:", error);
    
    return {
      success: false,
      message: "Failed to initiate withdrawal"
    };
  }
};

/**
 * Process admin approval/rejection for a withdrawal
 * @param {number} adminId - Admin user ID
 * @param {number} withdrawalId - Withdrawal ID
 * @param {string} action - 'approve' or 'reject'
 * @param {string} notes - Admin notes or rejection reason
 * @returns {Object} - Processing result
 */
const processWithdrawalAdminAction = async (adminId, withdrawalId, action, notes = '', selectedGateway = null) => {
  const t = await sequelize.transaction();
  
  try {
    // Get withdrawal
    const withdrawal = await WalletWithdrawal.findByPk(withdrawalId, {
      transaction: t
    });
    
    if (!withdrawal) {
      await t.rollback();
      return {
        success: false,
        message: "Withdrawal not found"
      };
    }
    
    // Check if withdrawal can be processed
    if (withdrawal.status !== 'pending') {
      await t.rollback();
      return {
        success: false,
        message: `This withdrawal has already been ${withdrawal.status}`
      };
    }
    
    // OTP verification is not required in current implementation
    // if (!withdrawal.otp_verified) {
    //   await t.rollback();
    //   return {
    //     success: false,
    //     message: "This withdrawal has not been verified by the user yet"
    //   };
    // }
    
    // Get the admin record
    const adminRecord = await WithdrawalAdmin.findOne({
      where: { withdrawal_id: withdrawalId },
      transaction: t
    });
    
    if (!adminRecord) {
      await t.rollback();
      return {
        success: false,
        message: "Admin record not found for this withdrawal"
      };
    }
    
    // Update admin record
    await adminRecord.update({
      admin_id: adminId,
      status: action === 'approve' ? 'approved' : 'rejected',
      notes: notes,
      processed_at: new Date(),
      updated_at: new Date()
    }, { transaction: t });
    
    // Update withdrawal record based on admin action
    if (action === 'approve') {
      // Use the selected gateway
      const gateway = selectedGateway || 'OKPAY'; // Default to OKPAY
      
      // Update withdrawal status to approved
      await withdrawal.update({
        status: 'approved',
        payment_gateway_id: 1 // Default gateway ID
      }, { transaction: t });
      
      await t.commit();
      
      // After committing the DB transaction, process the actual transfer
      let transferResult;
      const host = process.env.API_BASE_URL || 'http://localhost:8000';
      let notifyUrl = '';
      
      // Set the appropriate callback URL based on gateway
      switch (gateway) {
        case 'WEPAY':
          notifyUrl = `${host}/api/payments/wepay/payout-callback`;
          transferResult = await processWePayTransfer(withdrawalId, notifyUrl);
          break;
        case 'MXPAY':
          notifyUrl = `${host}/api/payments/mxpay/transfer-callback`;
          transferResult = await processMxPayTransfer(withdrawalId, notifyUrl);
          break;
        default: // OKPAY
          notifyUrl = `${host}/api/payments/okpay/payout-callback`;
          transferResult = await processOkPayTransfer(withdrawalId, notifyUrl);
          break;
      }
      
      return transferResult;
    } else {
      // Rejection - refund the user's wallet
      const user = await User.findByPk(withdrawal.user_id, {
        transaction: t
      });
      
      if (!user) {
        await t.rollback();
        return {
          success: false,
          message: "User not found for refund"
        };
      }
      
      // Update user wallet balance (refund)
      const newBalance = parseFloat(user.wallet_balance) + parseFloat(withdrawal.amount);
      await User.update(
        { wallet_balance: newBalance },
        { 
          where: { user_id: withdrawal.user_id },
          transaction: t 
        }
      );
      
      // Update withdrawal status
      await withdrawal.update({
        status: 'rejected'
      }, { transaction: t });
      
      await t.commit();
      
      return {
        success: true,
        message: "Withdrawal rejected and amount refunded to user's wallet"
      };
    }
  } catch (error) {
    await t.rollback();
    console.error("Error processing admin action:", error);
    
    return {
      success: false,
      message: "Failed to process admin action"
    };
  }
};

/**
 * Process a transfer via OKPAY after admin approval
 * @param {number} withdrawalId - Withdrawal ID
 * @param {string} notifyUrl - Notification URL for callbacks
 * @returns {Object} - Processing result
 */
const processOkPayTransfer = async (withdrawalId, notifyUrl) => {
  const t = await sequelize.transaction();
  
  try {
    // Get withdrawal
    const withdrawal = await WalletWithdrawal.findByPk(withdrawalId, {
      transaction: t
    });
    
    if (!withdrawal) {
      await t.rollback();
      return {
        success: false,
        message: "Withdrawal not found"
      };
    }
    
    // Check if withdrawal is already processed
    if (withdrawal.status === 'completed' || withdrawal.status === 'failed') {
      await t.rollback();
      return {
        success: false,
        message: "Withdrawal already processed"
      };
    }
    
    // Get bank account details
    const bankAccount = await BankAccount.findOne({
      where: {
        user_id: withdrawal.user_id,
        is_primary: true
      },
      transaction: t
    });
    
    if (!bankAccount) {
      await t.rollback();
      return {
        success: false,
        message: "Bank account not found for withdrawal"
      };
    }
    
    // Prepare request data for payment gateway
    const requestData = {
      mchId: paymentConfig.mchId,
      currency: "INR",
      out_trade_no: withdrawal.transaction_id,
      pay_type: withdrawal.withdrawal_type, // BANK or UPI
      account: bankAccount.account_number,
      userName: bankAccount.account_holder,
      money: parseInt(withdrawal.amount), // Must be integer
      attach: `Withdrawal for user ${withdrawal.user_id}`,
      notify_url: notifyUrl,
      reserve1: withdrawal.withdrawal_type === 'BANK' ? bankAccount.ifsc_code : '' // IFSC for BANK type
    };
    
    // Generate signature
    requestData.sign = generateSignature(requestData);
    
    // Call the payment gateway API
    const response = await axios.post(`${paymentConfig.host}/v1/Payout`, requestData, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    
    // Check API response
    if (response.data.code === 0) {
      // Update withdrawal with transaction ID
      await withdrawal.update({
        transaction_id: response.data.data.transaction_Id
      }, { transaction: t });
      
      await t.commit();
      
      return {
        success: true,
        message: "Withdrawal approved and payment processing initiated",
        transactionId: response.data.data.transaction_Id
      };
    } else {
      // Payment gateway error
      await t.rollback();
      
      return {
        success: false,
        message: `Payment gateway error: ${response.data.msg}`,
        errorCode: response.data.code
      };
    }
  } catch (error) {
    await t.rollback();
    console.error("Payment gateway API error:", error);
    
    return {
      success: false,
      message: "Error calling payment gateway"
    };
  }
};

/**
 * Process PayIn callback from payment gateway
 * @param {Object} callbackData - Callback data from payment gateway
 * @returns {Object} - Processing result
 */
const processPayInCallback = async (callbackData) => {
  // Extract callback data
  const {
      mchId,
      out_trade_no,
      transaction_Id,
      status,
      money,
      pay_money,
      sign,
      ...otherParams
  } = callbackData;
  
  // 1. Verify merchant ID
  if (mchId !== paymentConfig.mchId) {
      return {
          success: false,
          message: "Invalid merchant ID"
      };
  }
  
  // 2. Verify signature
  const dataToVerify = { ...callbackData };
  delete dataToVerify.sign;
  
  const calculatedSign = generateSignature(dataToVerify);
  if (sign !== calculatedSign) {
      return {
          success: false,
          message: "Invalid signature"
      };
  }
  
  // Start a transaction
  const t = await sequelize.transaction();
  
  try {
      // 3. Find the recharge record
      const rechargeRecord = await WalletRecharge.findOne({
          where: { order_id: out_trade_no },
          transaction: t
      });
      
      if (!rechargeRecord) {
          await t.rollback();
          return {
              success: false,
              message: "Order not found"
          };
      }
      
      // 4. Check if already processed
      if (rechargeRecord.status === 'completed') {
          await t.rollback();
          return {
              success: true,
              message: "Payment already processed"
          };
      }
      
      // 5. Process payment based on status
      if (status === "1") { // Payment successful
          // Update recharge record
          await WalletRecharge.update({
              status: 'completed',
              transaction_id: transaction_Id
          }, {
              where: { order_id: out_trade_no },
              transaction: t
          });
          
          // Get user
          const user = await User.findByPk(rechargeRecord.user_id, {
              transaction: t
          });
          
          if (!user) {
              await t.rollback();
              return {
                  success: false,
                  message: "User not found"
              };
          }
          
          // Update wallet balance
          // Use pay_money (actual amount paid) if available, otherwise use money (order amount)
          const addAmount = parseFloat(pay_money || money);
          const newBalance = parseFloat(user.wallet_balance) + addAmount;
          
          await User.update({
              wallet_balance: newBalance
          }, {
              where: { user_id: rechargeRecord.user_id },
              transaction: t
          });
          
          // Process first recharge bonus if applicable
          if (rechargeRecord.status === 'pending') {
              await referralService.processFirstRechargeBonus(rechargeRecord.user_id, addAmount);
          }
          
          await t.commit();
          
          // IMPORTANT: These additional operations are performed AFTER the transaction is committed
          // to avoid prolonging the transaction and risking deadlocks
          
          // NEW: Update attendance record with recharge info
          // await autoProcessRechargeForAttendance(rechargeRecord.user_id, addAmount);
          
          // NEW: Update referral status for this user's referrer
          // await updateReferralOnRecharge(rechargeRecord.user_id, addAmount);
          
          return {
              success: true,
              message: "Payment processed successfully"
          };
      } else { // Payment failed
          await WalletRecharge.update({
              status: 'failed'
          }, {
              where: { order_id: out_trade_no },
              transaction: t
          });
          
          await t.commit();
          
          return {
              success: true,
              message: "Payment failure recorded"
          };
      }
  } catch (error) {
      await t.rollback();
      console.error("Error processing payment callback:", error);
      
      return {
          success: false,
          message: "Error processing payment callback"
      };
  }
};

/**
 * Process PayOut callback from payment gateway
 * @param {Object} callbackData - Callback data from payment gateway
 * @returns {Object} - Processing result
 */
const processPayOutCallback = async (callbackData) => {
  // Extract callback data
  const {
    mchId,
    out_trade_no,
    transaction_Id,
    status,
    money,
    sign,
    ...otherParams
  } = callbackData;
  
  // 1. Verify merchant ID
  if (mchId !== paymentConfig.mchId) {
    return {
      success: false,
      message: "Invalid merchant ID"
    };
  }
  
  // 2. Verify signature (remove sign from verification)
  const dataToVerify = { ...callbackData };
  delete dataToVerify.sign;
  
  const calculatedSign = generateSignature(dataToVerify);
  if (sign !== calculatedSign) {
    return {
      success: false,
      message: "Invalid signature"
    };
  }
  
  // Start a transaction
  const t = await sequelize.transaction();
  
  try {
    // 3. Find the withdrawal record
    const withdrawalRecord = await WalletWithdrawal.findOne({
      where: { transaction_id: out_trade_no },
      transaction: t
    });
    
    if (!withdrawalRecord) {
      await t.rollback();
      return {
        success: false,
        message: "Order not found"
      };
    }
    
    // 4. Check if already processed
    if (withdrawalRecord.status === 'completed' || withdrawalRecord.status === 'failed') {
      await t.rollback();
      return {
        success: true,
        message: "Withdrawal already processed"
      };
    }
    
    // 5. Process withdrawal based on status
    if (status === "1") { // Withdrawal successful
      // Update withdrawal record
      await WalletWithdrawal.update({
        status: 'completed',
        transaction_id: transaction_Id
      }, {
        where: { transaction_id: out_trade_no },
        transaction: t
      });
      
      await t.commit();
      
      return {
        success: true,
        message: "Withdrawal processed successfully"
      };
    } else { // Withdrawal failed
      // Get user to refund
      const user = await User.findByPk(withdrawalRecord.user_id, {
        transaction: t
      });
      
      if (!user) {
        await t.rollback();
        return {
          success: false,
          message: "User not found"
        };
      }
      
      // Refund wallet balance
      const newBalance = parseFloat(user.wallet_balance) + parseFloat(withdrawalRecord.amount);
      
      await User.update({
        wallet_balance: newBalance
      }, {
        where: { user_id: withdrawalRecord.user_id },
        transaction: t
      });
      
      // Update withdrawal record
      await WalletWithdrawal.update({
        status: 'failed'
      }, {
        where: { transaction_id: out_trade_no },
        transaction: t
      });
      
      await t.commit();
      
      return {
        success: true,
        message: "Withdrawal failure recorded and funds returned to wallet"
      };
    }
  } catch (error) {
    await t.rollback();
    console.error("Error processing withdrawal callback:", error);
    
    return {
      success: false,
      message: "Error processing withdrawal callback"
    };
  }
};

/**
 * Get payment status
 * @param {string} orderId - Order ID to check
 * @returns {Object} - Payment status
 */
const getPaymentStatus = async (orderId) => {
  try {
    // Determine if this is a PayIn or PayOut order
    const isPayIn = orderId.startsWith('PI');
    const isPayOut = orderId.startsWith('PO');
    
    if (isPayIn) {
      // Check PayIn status
      const rechargeRecord = await WalletRecharge.findOne({
        where: { order_id: orderId }
      });
      
      if (!rechargeRecord) {
        return {
          success: false,
          message: "Recharge order not found"
        };
      }
      
      return {
        success: true,
        type: 'payin',
        status: rechargeRecord.status === 'completed' ? 'success' : 'pending',
        amount: rechargeRecord.amount,
        transactionId: rechargeRecord.transaction_id,
        timestamp: rechargeRecord.updated_at || rechargeRecord.created_at,
        gateway: `Gateway ${rechargeRecord.payment_gateway_id}`
      };
    } else if (isPayOut) {
      // Check PayOut status
      const withdrawalRecord = await WalletWithdrawal.findOne({
        where: { transaction_id: orderId }
      });
      
      if (!withdrawalRecord) {
        return {
          success: false,
          message: "Withdrawal order not found"
        };
      }
      
      let status = 'pending';
      if (withdrawalRecord.status === 'completed') {
        status = 'success';
      } else if (withdrawalRecord.status === 'failed') {
        status = 'failed';
      } else if (withdrawalRecord.status === 'pending') {
        status = 'awaiting_approval';
      } else if (withdrawalRecord.status === 'rejected') {
        status = 'rejected';
      } else if (withdrawalRecord.status === 'approved') {
        status = 'processing';
      }
      
      return {
        success: true,
        type: 'payout',
        status: status,
        amount: withdrawalRecord.amount,
        transactionId: withdrawalRecord.transaction_id,
        timestamp: withdrawalRecord.updated_at || withdrawalRecord.created_at,
        adminStatus: withdrawalRecord.status,
        gateway: `Gateway ${withdrawalRecord.payment_gateway_id}`
      };
    } else {
      return {
        success: false,
        message: "Invalid order ID format"
      };
    }
  } catch (error) {
    console.error("Error getting payment status:", error);
    
    return {
      success: false,
      message: "Error checking payment status"
    };
  }
};

/**
 * Get pending withdrawals for admin approval
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} - List of pending withdrawals with pagination
 */
const getPendingWithdrawals = async (page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get total count of pending withdrawals
    const total = await WalletWithdrawal.count({
      where: { status: 'pending' }
    });
    
    // Get pending withdrawals with pagination
    const pendingWithdrawals = await WalletWithdrawal.findAll({
      where: { status: 'pending' },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'user_name', 'email', 'phone_no', 'wallet_balance']
        },
        {
          model: BankAccount,
          as: 'bankAccount',
          attributes: ['bank_name', 'account_number', 'ifsc_code', 'account_holder']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    // Transform the data to match required format
    const formattedWithdrawals = pendingWithdrawals.map(withdrawal => ({
      withdrawal_id: withdrawal.id,
      user_id: withdrawal.user.user_id,
      user_name: withdrawal.user.user_name,
      email: withdrawal.user.email,
      phone_no: withdrawal.user.phone_no,
      wallet_balance: withdrawal.user.wallet_balance,
      order_id: withdrawal.transaction_id,
      withdrawal_type: withdrawal.withdrawal_type,
      amount: withdrawal.amount,
      status: withdrawal.status,
      created_at: withdrawal.created_at,
      bank_name: withdrawal.bankAccount?.bank_name || null,
      account_number: withdrawal.bankAccount?.account_number || null,
      ifsc_code: withdrawal.bankAccount?.ifsc_code || null,
      account_holder: withdrawal.bankAccount?.account_holder || null
    }));
    
    return {
      success: true,
      withdrawals: formattedWithdrawals,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting pending withdrawals:', error);
    return {
      success: false,
      message: 'Error fetching pending withdrawals'
    };
  }
};

/**
 * Get withdrawals with admin filters
 * @param {Object} filters - Filter criteria
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} - List of filtered withdrawals with pagination
 */
const getWithdrawalsAdmin = async (filters = {}, page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Build where clause based on filters
    const whereClause = {};
    
    if (filters.status) {
      whereClause.status = filters.status;
    }
    
    if (filters.user_id) {
      whereClause.user_id = filters.user_id;
    }
    
    // Date filters
    if (filters.start_date && filters.end_date) {
      whereClause.created_at = {
        [Op.between]: [new Date(filters.start_date), new Date(filters.end_date)]
      };
    } else if (filters.start_date) {
      whereClause.created_at = {
        [Op.gte]: new Date(filters.start_date)
      };
    } else if (filters.end_date) {
      whereClause.created_at = {
        [Op.lte]: new Date(filters.end_date)
      };
    }
    
    // Get total count
    const total = await WalletWithdrawal.count({ where: whereClause });
    
    // Get withdrawals with pagination
    const withdrawals = await WalletWithdrawal.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'user_name', 'email', 'phone_no']
        },
        {
          model: WithdrawalAdmin,
          required: false
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });
    
    return {
      success: true,
      withdrawals,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting admin withdrawals:', error);
    return {
      success: false,
      message: 'Error fetching withdrawals'
    };
  }
};

/**
 * Get all pending recharge requests using the updated model
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} - List of pending recharges with pagination
 */
const getAllPendingRecharges = async (page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get total count of pending recharges
    const total = await WalletRecharge.count({
      where: { status: 'pending' }
    });
    
    // Get pending recharges with pagination
    const pendingRecharges = await WalletRecharge.findAll({
      where: { status: 'pending' },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'user_name', 'email', 'phone_no', 'wallet_balance', 'created_at']
        }
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    // Transform the data to match required format
    const formattedRecharges = pendingRecharges.map(recharge => ({
      user_id: recharge.user.user_id,
      mobile_number: recharge.user.phone_no,
      order_id: recharge.order_id || recharge.id,
      recharge_type: `Gateway ${recharge.payment_gateway_id}`,
      applied_amount: recharge.amount,
      balance_after: (parseFloat(recharge.user.wallet_balance) + parseFloat(recharge.amount)).toFixed(2),
      apply_date_time: recharge.created_at,
      recharge_id: recharge.id,
      user_registered_at: recharge.user.created_at
    }));
    
    return {
      success: true,
      recharges: formattedRecharges,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting pending recharges:', error);
    return {
      success: false,
      message: 'Error fetching pending recharges'
    };
  }
};

/**
 * Get successful first-time recharges using the updated model
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} - List of first-time recharges with pagination
 */
const getFirstRecharges = async (page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // First, let's test a simple query without associations
    console.log('Testing basic WalletRecharge query...');
    
    // Get all successful recharges with basic user info
    const successfulRecharges = await WalletRecharge.findAll({
      where: { status: 'completed' },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'user_name', 'email', 'phone_no', 'wallet_balance', 'actual_deposit_amount', 'created_at']
        }
      ],
      order: [['updated_at', 'DESC']]
    });

    console.log(`Found ${successfulRecharges.length} successful recharges`);

    // Create a map to track each user's first successful recharge
    const userFirstRecharges = new Map();
    successfulRecharges.forEach(recharge => {
      if (!userFirstRecharges.has(recharge.user_id)) {
        userFirstRecharges.set(recharge.user_id, recharge);
      }
    });

    // Convert Map to array and apply pagination
    const firstRecharges = Array.from(userFirstRecharges.values())
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(offset, offset + limit);

    // Transform the data to match required format
    const formattedRecharges = firstRecharges.map(recharge => ({
      user_id: recharge.user.user_id,
      mobile_number: recharge.user.phone_no,
      order_id: recharge.order_id || recharge.id,
      recharge_type: `Gateway ${recharge.payment_gateway_id}`,
      applied_amount: recharge.amount,
      balance_after: (parseFloat(recharge.user.wallet_balance)).toFixed(2),
      total_recharge: recharge.user.actual_deposit_amount || 0,
      total_withdraw: 0, // We'll need to calculate this from withdrawals table if needed
      apply_date_time: recharge.updated_at,
      recharge_id: recharge.id,
      is_first_recharge: true,
      user_registered_at: recharge.user.created_at,
      transaction_id: recharge.transaction_id || 'N/A'
    }));
    
    return {
      success: true,
      recharges: formattedRecharges,
      pagination: {
        total: userFirstRecharges.size,
        page,
        limit,
        pages: Math.ceil(userFirstRecharges.size / limit)
      }
    };
  } catch (error) {
    console.error('Error getting first recharges:', error);
    return {
      success: false,
      message: 'Error fetching first recharges'
    };
  }
};

/**
 * Get today's top deposits using the updated model
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} - List of top deposits with pagination
 */
const getTodayTopDeposits = async (page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get start of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get total count of today's successful deposits
    const total = await WalletRecharge.count({
      where: { 
        status: 'completed',
        updated_at: {
          [Op.gte]: today
        }
      }
    });
    
    // Get today's successful deposits with pagination
    const deposits = await WalletRecharge.findAll({
      where: { 
        status: 'completed',
        updated_at: {
          [Op.gte]: today
        }
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'user_name', 'email', 'phone_no', 'wallet_balance', 'actual_deposit_amount', 'created_at']
        }
      ],
      order: [['amount', 'DESC']],
      limit,
      offset
    });

    // Transform the data to match required format
    const formattedDeposits = deposits.map(deposit => ({
      user_id: deposit.user.user_id,
      mobile_number: deposit.user.phone_no,
      order_id: deposit.order_id || deposit.id,
      recharge_type: `Gateway ${deposit.payment_gateway_id}`,
      applied_amount: deposit.amount,
      balance_after: (parseFloat(deposit.user.wallet_balance)).toFixed(2),
      total_recharge: deposit.user.actual_deposit_amount || 0,
      total_withdraw: 0, // We'll need to calculate this from withdrawals table if needed
      apply_date_time: deposit.updated_at,
      recharge_id: deposit.id,
      user_registered_at: deposit.user.created_at,
      transaction_id: deposit.transaction_id || 'N/A'
    }));
    
    return {
      success: true,
      deposits: formattedDeposits,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting today\'s top deposits:', error);
    return {
      success: false,
      message: 'Error fetching today\'s top deposits'
    };
  }
};

/**
 * Get all successful recharges using the updated model
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} - List of successful recharges with pagination
 */
const getAllSuccessfulRecharges = async (page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get total count of successful recharges
    const total = await WalletRecharge.count({
      where: { status: 'completed' }
    });
    
    // Get successful recharges with pagination
    const successfulRecharges = await WalletRecharge.findAll({
      where: { status: 'completed' },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'user_name', 'email', 'phone_no', 'wallet_balance', 'actual_deposit_amount', 'created_at']
        }
      ],
      order: [['updated_at', 'DESC']],
      limit,
      offset
    });

    // Transform the data to match required format
    const formattedRecharges = successfulRecharges.map(recharge => ({
      user_id: recharge.user.user_id,
      mobile_number: recharge.user.phone_no,
      order_id: recharge.order_id || recharge.id,
      recharge_type: `Gateway ${recharge.payment_gateway_id}`,
      applied_amount: recharge.amount,
      balance_after: (parseFloat(recharge.user.wallet_balance)).toFixed(2),
      total_recharge: recharge.user.actual_deposit_amount || 0,
      total_withdraw: 0, // We'll need to calculate this from withdrawals table if needed
      apply_date_time: recharge.updated_at,
      recharge_id: recharge.id,
      user_registered_at: recharge.user.created_at,
      transaction_id: recharge.transaction_id || 'N/A'
    }));
    
    return {
      success: true,
      recharges: formattedRecharges,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting successful recharges:', error);
    return {
      success: false,
      message: 'Error fetching successful recharges'
    };
  }
};

/**
 * Get today's top withdrawals using the updated model
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} - List of top withdrawals with pagination
 */
const getTodayTopWithdrawals = async (page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    // Get start of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get total count of today's successful withdrawals
    const total = await WalletWithdrawal.count({
      where: { 
        status: 'completed',
        updated_at: {
          [Op.gte]: today
        }
      }
    });
    
    // Get today's successful withdrawals with pagination
    const withdrawals = await WalletWithdrawal.findAll({
      where: { 
        status: 'completed',
        updated_at: {
          [Op.gte]: today
        }
      },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['user_id', 'user_name', 'email', 'phone_no', 'wallet_balance', 'actual_deposit_amount', 'created_at']
        },
        {
          model: BankAccount,
          as: 'bankAccount',
          attributes: ['bank_name', 'account_number', 'ifsc_code', 'account_holder']
        }
      ],
      order: [['amount', 'DESC']],
      limit,
      offset
    });

    // Transform the data to match required format
    const formattedWithdrawals = withdrawals.map(withdrawal => ({
      user_id: withdrawal.user.user_id,
      mobile_number: withdrawal.user.phone_no,
      order_id: withdrawal.transaction_id || withdrawal.id,
      withdraw_type: withdrawal.withdrawal_type || 'BANK',
      applied_amount: withdrawal.amount,
      balance_after: (parseFloat(withdrawal.user.wallet_balance)).toFixed(2),
      total_recharge: withdrawal.user.actual_deposit_amount || 0,
      total_withdraw: 0, // We'll need to calculate this from withdrawals table if needed
      bank_name: withdrawal.bankAccount?.bank_name || 'N/A',
      account_number: withdrawal.bankAccount?.account_number || 'N/A',
      ifsc_code: withdrawal.bankAccount?.ifsc_code || 'N/A',
      account_holder: withdrawal.bankAccount?.account_holder || 'N/A',
      usdt_network: 'N/A', // Not available in current schema
      usdt_address: 'N/A', // Not available in current schema
      address_alias: 'N/A', // Not available in current schema
      apply_date_time: withdrawal.updated_at,
      withdrawal_id: withdrawal.id,
      transaction_id: withdrawal.transaction_id || 'N/A'
    }));
    
    return {
      success: true,
      withdrawals: formattedWithdrawals,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('Error getting today\'s top withdrawals:', error);
    return {
      success: false,
      message: 'Error fetching today\'s top withdrawals'
    };
  }
};

module.exports = {
  createPayInOrder,
  initiateWithdrawal,
  processWithdrawalAdminAction,
  processOkPayTransfer,
  processPayInCallback,
  processPayOutCallback,
  getPaymentStatus,
  getPendingWithdrawals,
  getWithdrawalsAdmin,
  getAllPendingRecharges,
  getAllSuccessfulRecharges,
  getFirstRecharges,
  getTodayTopDeposits,
  getTodayTopWithdrawals
};