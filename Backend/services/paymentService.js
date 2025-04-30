import axios from 'axios';
import { sequelize } from '../config/db.js';
import { paymentConfig } from '../config/paymentConfig.js';
import { generateSignature } from '../utils/generateSignature.js';
import User from '../models/User.js';
import WalletRecharge from '../models/WalletRecharge.js';
import WalletWithdrawal from '../models/WalletWithdrawal.js';
import BankAccount from '../models/BankAccount.js';
import WithdrawalAdmin from '../models/WithdrawalAdmin.js';
import referralService from './referralService.js';
import otpService from './otpService.js';
import { Op } from 'sequelize';

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
 * Initial step for withdrawal - create a withdrawal request and send OTP
 * @param {number} userId - User ID
 * @param {number} bankAccountId - Bank account ID
 * @param {number} amount - Withdrawal amount
 * @param {string} withdrawalType - BANK or UPI
 * @returns {Object} - Response with OTP session details
 */
export const initiateWithdrawal = async (userId, bankAccountId, amount, withdrawalType = 'BANK') => {
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
    
    // Create a temporary orderId (will be finalized after OTP verification)
    const tempOrderId = `TEMP_PO${Date.now()}${userId}`;
    
    // Generate and send OTP
    const country_code = '91'; // Default to India
    const otpResponse = await otpService.createOtpSession(
      user.phone_no,
      country_code,
      user.user_name,
      {
        udf1: JSON.stringify({
          bankAccountId,
          amount,
          withdrawalType,
          tempOrderId
        }),
        udf2: 'withdrawal_init'
      }
    );
    
    if (!otpResponse.success) {
      await t.rollback();
      return {
        success: false,
        message: `Failed to send OTP: ${otpResponse.message}`
      };
    }
    
    // Update user with OTP session ID
    await User.update(
      { phone_otp_session_id: otpResponse.otpSessionId.toString() },
      { where: { user_id: userId }, transaction: t }
    );
    
    await t.commit();
    
    return {
      success: true,
      message: "Withdrawal initiated. Please verify with OTP.",
      otpSessionId: otpResponse.otpSessionId,
      requiresVerification: true,
      tempOrderId
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
 * Verify OTP and create withdrawal request for admin approval
 * @param {number} userId - User ID
 * @param {string} otpSessionId - OTP session ID
 * @returns {Object} - Response with withdrawal details
 */
export const verifyWithdrawalOtp = async (userId, otpSessionId) => {
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
    
    // Verify OTP session ID matches user's session
    if (user.phone_otp_session_id !== otpSessionId.toString()) {
      await t.rollback();
      return {
        success: false,
        message: "Invalid OTP session for this user"
      };
    }
    
    // Check OTP verification status
    const otpVerificationResult = await otpService.checkOtpSession(otpSessionId);
    
    if (!otpVerificationResult.success) {
      await t.rollback();
      return {
        success: false,
        message: `OTP verification failed: ${otpVerificationResult.message}`
      };
    }
    
    // If OTP is not verified yet
    if (!otpVerificationResult.verified) {
      await t.rollback();
      return {
        success: false,
        message: 'OTP has not been verified yet.',
        status: otpVerificationResult.status
      };
    }
    
    // Extract withdrawal data from OTP session (stored in udf1)
    const withdrawalData = JSON.parse(otpVerificationResult.userData.udf1);
    const { bankAccountId, amount, withdrawalType, tempOrderId } = withdrawalData;
    
    // Check wallet balance again (might have changed since initiation)
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
    
    // Create actual order ID
    const orderId = `PO${Date.now()}${userId}`;
    
    // Create withdrawal record
    const withdrawal = await WalletWithdrawal.create({
      user_id: userId,
      phone_no: user.phone_no,
      withdrawal_amount: amount,
      payment_status: false,
      payment_gateway: 'OKPAY',
      withdrawal_type: withdrawalType,
      order_id: orderId,
      remark: 'Withdrawal initiated and verified by OTP. Awaiting admin approval.',
      time_of_request: new Date(),
      otp_verified: true,
      otp_session_id: otpSessionId.toString(),
      admin_status: 'pending'
    }, { transaction: t });
    
    // Create admin approval record
    await WithdrawalAdmin.create({
      withdrawal_id: withdrawal.withdrawal_id,
      status: 'pending',
      notes: `Withdrawal request initiated by user and verified by OTP. Amount: ${amount} INR.`
    }, { transaction: t });
    
    // Deduct amount from wallet
    const newBalance = parseFloat(user.wallet_balance) - parseFloat(amount);
    await User.update(
      { 
        wallet_balance: newBalance,
        phone_otp_session_id: null // Clear OTP session
      },
      { 
        where: { user_id: userId },
        transaction: t 
      }
    );
    
    await t.commit();
    
    return {
      success: true,
      message: "Withdrawal request submitted successfully. Awaiting admin approval.",
      withdrawal: {
        id: withdrawal.withdrawal_id,
        amount,
        status: 'pending',
        created_at: withdrawal.time_of_request
      }
    };
  } catch (error) {
    await t.rollback();
    console.error("Error verifying withdrawal OTP:", error);
    
    return {
      success: false,
      message: "Failed to process withdrawal verification"
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
export const processWithdrawalAdminAction = async (adminId, withdrawalId, action, notes = '') => {
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
    if (withdrawal.admin_status !== 'pending') {
      await t.rollback();
      return {
        success: false,
        message: `This withdrawal has already been ${withdrawal.admin_status}`
      };
    }
    
    if (!withdrawal.otp_verified) {
      await t.rollback();
      return {
        success: false,
        message: "This withdrawal has not been verified by the user yet"
      };
    }
    
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
    
    // Update withdrawal record
    if (action === 'approve') {
      // Process the approved withdrawal - call the payment gateway
      // Get host for callback URL (this is just a placeholder - you'd implement this in the actual controller)
      const notifyUrl = `${process.env.API_BASE_URL}/api/payments/payout-callback`;
      
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
        out_trade_no: withdrawal.order_id,
        pay_type: withdrawal.withdrawal_type, // BANK or UPI
        account: withdrawal.withdrawal_type === 'BANK' ? bankAccount.account_number : withdrawal.phone_no,
        userName: bankAccount.account_holder_name,
        money: parseInt(withdrawal.withdrawal_amount), // Must be integer
        attach: `Withdrawal for user ${withdrawal.user_id}`,
        notify_url: notifyUrl,
        reserve1: withdrawal.withdrawal_type === 'BANK' ? bankAccount.ifsc_code : '' // IFSC for BANK type
      };
      
      // Generate signature
      requestData.sign = generateSignature(requestData);
      
      // Call the payment gateway API (or you can mock this for testing)
      try {
        const response = await axios.post(`${paymentConfig.host}/v1/Payout`, requestData, {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
        
        // Check API response
        if (response.data.code === 0) {
          // Update withdrawal with transaction ID
          await withdrawal.update({
            transaction_id: response.data.data.transaction_Id,
            admin_status: 'approved',
            remark: `Admin approved. Payment processing initiated.`
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
      } catch (apiError) {
        await t.rollback();
        console.error("Payment gateway API error:", apiError);
        
        return {
          success: false,
          message: "Error calling payment gateway"
        };
      }
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
      const newBalance = parseFloat(user.wallet_balance) + parseFloat(withdrawal.withdrawal_amount);
      await User.update(
        { wallet_balance: newBalance },
        { 
          where: { user_id: withdrawal.user_id },
          transaction: t 
        }
      );
      
      // Update withdrawal status
      await withdrawal.update({
        admin_status: 'rejected',
        remark: `Admin rejected. Reason: ${notes}. Amount refunded to wallet.`,
        time_of_failed: new Date()
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


      if (status === "1" && rechargeRecord.payment_status === false) {
        await referralService.processFirstRechargeBonus(rechargeRecord.user_id, parseFloat(pay_money || money));
      }

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
        remark: "Withdrawal processed successfully"
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
        admin_status: 'rejected',
        remark: `Withdrawal failed with status: ${status}. Amount refunded to wallet.`
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
      } else if (withdrawalRecord.admin_status === 'pending') {
        status = 'awaiting_approval';
      } else if (withdrawalRecord.admin_status === 'rejected') {
        status = 'rejected';
      } else if (withdrawalRecord.admin_status === 'approved' && !withdrawalRecord.payment_status) {
        status = 'processing';
      }
      
      return {
        success: true,
        type: 'payout',
        status: status,
        amount: withdrawalRecord.withdrawal_amount,
        transactionId: withdrawalRecord.transaction_id,
        timestamp: withdrawalRecord.time_of_success || withdrawalRecord.time_of_failed || withdrawalRecord.time_of_request,
        adminStatus: withdrawalRecord.admin_status
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
  initiateWithdrawal,
  verifyWithdrawalOtp,
  processWithdrawalAdminAction,
  getPendingWithdrawals,
  getWithdrawalsAdmin,
  processPayInCallback,
  processPayOutCallback,
  getPaymentStatus
};