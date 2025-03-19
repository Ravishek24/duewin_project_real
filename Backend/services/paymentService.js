import axios from 'axios';
import { sequelize } from '../config/db.js';
import { paymentConfig } from '../config/paymentConfig.js';
import { generateSignature } from '../utils/generateSignature.js';
import User from '../models/User.js';
import WalletRecharge from '../models/WalletRecharge.js';
import WalletWithdrawal from '../models/WalletWithdrawal.js';
import BankAccount from '../models/BankAccount.js';

/**
 * Creates a PayIn order (deposit)
 * @param {number} userId - User ID
 * @param {string} orderId - Unique order number
 * @param {string} payType - Payment method (UPI)
 * @param {number} amount - Amount (Integer)
 * @param {string} notifyUrl - Callback URL for notifications
 * @returns {Object} - API response
 */
export const createPayInOrder = async (userId, orderId, payType, amount, notifyUrl) => {
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
      added_amount: amount,
      order_id: orderId,
      payment_gateway: 'OKPAY',
      payment_status: false
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
 * Creates a PayOut order (withdrawal)
 * @param {number} userId - User ID
 * @param {number} bankAccountId - Bank account ID
 * @param {number} amount - Withdrawal amount
 * @param {string} withdrawalType - BANK or UPI
 * @param {string} notifyUrl - Callback URL
 * @returns {Object} - API response
 */
export const createPayOutOrder = async (userId, bankAccountId, amount, withdrawalType, notifyUrl) => {
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
    
    // Create unique order ID
    const orderId = `PO${Date.now()}${userId}`;
    
    // Create withdrawal record
    await WalletWithdrawal.create({
      user_id: userId,
      phone_no: user.phone_no,
      withdrawal_amount: amount,
      payment_status: false,
      payment_gateway: 'OKPAY',
      withdrawal_type: withdrawalType,
      remark: 'Withdrawal initiated',
      time_of_request: new Date(),
      order_id: orderId
    }, { transaction: t });
    
    // Deduct amount from wallet
    const newBalance = parseFloat(user.wallet_balance) - parseFloat(amount);
    await User.update(
      { wallet_balance: newBalance },
      { 
        where: { user_id: userId },
        transaction: t 
      }
    );
    
    // Prepare request data
    const requestData = {
      mchId: paymentConfig.mchId,
      currency: "INR",
      out_trade_no: orderId,
      pay_type: withdrawalType, // BANK or UPI
      account: withdrawalType === 'BANK' ? bankAccount.account_number : user.phone_no, // For UPI, can use phone
      userName: bankAccount.account_holder_name,
      money: parseInt(amount), // Must be integer
      attach: `Withdrawal for user ${userId}`,
      notify_url: notifyUrl,
      reserve1: withdrawalType === 'BANK' ? bankAccount.ifsc_code : '' // IFSC for BANK type
    };
    
    // Generate signature
    requestData.sign = generateSignature(requestData);
    
    // Call the payment gateway API
    const response = await axios.post(`${paymentConfig.host}/v1/Payout`, requestData, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    
    // Check API response
    if (response.data.code === 0) {
      // Update withdrawal record with transaction ID
      await WalletWithdrawal.update(
        { 
          transaction_id: response.data.data.transaction_Id,
          remark: 'Withdrawal processing'
        },
        { 
          where: { order_id: orderId },
          transaction: t 
        }
      );
      
      await t.commit();
      
      return {
        success: true,
        message: "Withdrawal request submitted successfully",
        transactionId: response.data.data.transaction_Id,
        orderId: orderId
      };
    } else {
      // Revert wallet balance if API call failed
      await User.update(
        { wallet_balance: user.wallet_balance },
        { 
          where: { user_id: userId },
          transaction: t 
        }
      );
      
      await t.rollback();
      
      return {
        success: false,
        message: `Payment gateway error: ${response.data.msg}`,
        errorCode: response.data.code
      };
    }
  } catch (error) {
    await t.rollback();
    console.error("Error creating PayOut order:", error.message);
    
    return {
      success: false,
      message: "Failed to create withdrawal order"
    };
  }
};

/**
 * Process PayIn callback from payment gateway
 * @param {Object} callbackData - Callback data from payment gateway
 * @returns {Object} - Processing result
 */
export const processPayInCallback = async (callbackData) => {
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
    if (rechargeRecord.payment_status === true) {
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
        payment_status: true,
        time_of_success: new Date(),
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
      
      await t.commit();
      
      return {
        success: true,
        message: "Payment processed successfully"
      };
    } else { // Payment failed
      await WalletRecharge.update({
        payment_status: false,
        remark: `Payment failed with status: ${status}`
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
export const processPayOutCallback = async (callbackData) => {
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
      where: { order_id: out_trade_no },
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
    if (withdrawalRecord.payment_status === true || withdrawalRecord.time_of_failed) {
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
        payment_status: true,
        time_of_success: new Date(),
        transaction_id: transaction_Id,
        remark: "Withdrawal successful"
      }, {
        where: { order_id: out_trade_no },
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
      const newBalance = parseFloat(user.wallet_balance) + parseFloat(withdrawalRecord.withdrawal_amount);
      
      await User.update({
        wallet_balance: newBalance
      }, {
        where: { user_id: withdrawalRecord.user_id },
        transaction: t
      });
      
      // Update withdrawal record
      await WalletWithdrawal.update({
        payment_status: false,
        time_of_failed: new Date(),
        remark: `Withdrawal failed with status: ${status}`
      }, {
        where: { order_id: out_trade_no },
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
export const getPaymentStatus = async (orderId) => {
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
        status: rechargeRecord.payment_status ? 'success' : 'pending',
        amount: rechargeRecord.added_amount,
        transactionId: rechargeRecord.transaction_id,
        timestamp: rechargeRecord.time_of_success || rechargeRecord.created_at
      };
    } else if (isPayOut) {
      // Check PayOut status
      const withdrawalRecord = await WalletWithdrawal.findOne({
        where: { order_id: orderId }
      });
      
      if (!withdrawalRecord) {
        return {
          success: false,
          message: "Withdrawal order not found"
        };
      }
      
      let status = 'pending';
      if (withdrawalRecord.payment_status) {
        status = 'success';
      } else if (withdrawalRecord.time_of_failed) {
        status = 'failed';
      }
      
      return {
        success: true,
        type: 'payout',
        status: status,
        amount: withdrawalRecord.withdrawal_amount,
        transactionId: withdrawalRecord.transaction_id,
        timestamp: withdrawalRecord.time_of_success || withdrawalRecord.time_of_failed || withdrawalRecord.time_of_request
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

export default {
  createPayInOrder,
  createPayOutOrder,
  processPayInCallback,
  processPayOutCallback,
  getPaymentStatus
};