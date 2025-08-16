// services/wePayService.js
const axios = require('axios');
const { sequelize } = require('../config/db');
const { wePayConfig } = require('../config/wePayConfig');
const { generateWePaySignature, verifyWePaySignature } = require('../utils/wePaySignature');
const User = require('../models/User');
const WalletRecharge = require('../models/WalletRecharge');
const WalletWithdrawal = require('../models/WalletWithdrawal');
const Transaction = require('../models/Transaction');
const BankAccount = require('../models/BankAccount');
const WithdrawalAdmin = require('../models/WithdrawalAdmin');
const referralService = require('./referralService');
const otpService = require('./otpService');

/**
 * Create a collection (deposit) order with WePayGlobal
 * @param {number} userId - User ID
 * @param {string} orderId - Unique order ID
 * @param {number} amount - Amount to deposit
 * @param {string} notifyUrl - Notification URL for callbacks
 * @param {string} returnUrl - Return URL after payment
 * @returns {Object} - Response with payment URL
 */
const createWePayCollectionOrder = async (userId, orderId, amount, notifyUrl, returnUrl) => {
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
      payment_gateway: 'WEPAY',
      payment_status: false
    }, { transaction: t });
    
    // Current date in required format
    const orderDate = new Date().toISOString().replace('T', ' ').split('.')[0];
    
    // Prepare request parameters
    const params = {
      version: wePayConfig.version,
      mch_id: wePayConfig.mchId,
      notify_url: notifyUrl,
      page_url: returnUrl,
      mch_order_no: orderId,
      pay_type: wePayConfig.payType,
      trade_amount: amount.toString(),
      order_date: orderDate,
      goods_name: `Wallet recharge for ${user.user_name}`,
      mch_return_msg: `userId:${userId}`,
      sign_type: wePayConfig.signType
    };
    
    // Generate signature
    params.sign = generateWePaySignature(params);
    
    // Call WePayGlobal API
    const response = await axios.post(wePayConfig.collectUrl, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    // Check for successful response
    if (response.data.respCode === 'SUCCESS') {
      // Update recharge record with platform order number
      await WalletRecharge.update(
        { transaction_id: response.data.orderNo },
        { 
          where: { order_id: orderId },
          transaction: t 
        }
      );
      
      await t.commit();
      
      return {
        success: true,
        message: "Payment order created successfully",
        paymentUrl: response.data.payInfo,
        transactionId: response.data.orderNo,
        orderId: orderId
      };
    } else {
      await t.rollback();
      
      return {
        success: false,
        message: `Payment gateway error: ${response.data.tradeMsg}`,
        errorCode: response.data.respCode
      };
    }
  } catch (error) {
    await t.rollback();
    console.error("Error creating WePay collection order:", error.message);
    
    return {
      success: false,
      message: "Failed to create payment order"
    };
  }
};

/**
 * Process WePayGlobal collection callback
 * @param {Object} callbackData - Callback data from WePay
 * @returns {Object} - Processing result
 */
const processWePayCollectionCallback = async (callbackData) => {
  // Verify signature
  if (!verifyWePaySignature(callbackData, callbackData.sign)) {
    return {
      success: false,
      message: "Invalid signature"
    };
  }
  
  // Start a transaction
  const t = await sequelize.transaction();
  
  try {
    // Find the recharge record
    const rechargeRecord = await WalletRecharge.findOne({
      where: { order_id: callbackData.mchOrderNo },
      transaction: t
    });
    
    if (!rechargeRecord) {
      await t.rollback();
      return {
        success: false,
        message: "Order not found"
      };
    }
    
    // Check if already processed
    if (rechargeRecord.payment_status === true) {
      await t.rollback();
      return {
        success: true,
        message: "Payment already processed"
      };
    }
    
    // Check payment status
    if (callbackData.tradeResult === '1') { // Payment successful
      // Update recharge record
      await WalletRecharge.update({
        payment_status: true,
        time_of_success: new Date(),
        transaction_id: callbackData.orderNo
      }, {
        where: { order_id: callbackData.mchOrderNo },
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
      const addAmount = parseFloat(callbackData.amount || callbackData.oriAmount);
      const newBalance = parseFloat(user.wallet_balance) + addAmount;
      
      await User.update({
        wallet_balance: newBalance
      }, {
        where: { user_id: rechargeRecord.user_id },
        transaction: t
      });
      
      // ✅ Create transaction record for successful deposit
      await Transaction.create({
        user_id: rechargeRecord.user_id,
        type: 'deposit',
        amount: addAmount,
        status: 'completed',
        payment_gateway_id: 'WEPAY',
        order_id: callbackData.mchOrderNo,
        transaction_id: callbackData.orderNo,
        description: 'WEPAY deposit successful',
        reference_id: `wepay_deposit_${callbackData.mchOrderNo}`,
        metadata: {
          gateway: 'WEPAY',
          original_status: callbackData.tradeResult,
          processed_at: new Date().toISOString()
        },
        created_at: new Date(),
        updated_at: new Date()
      }, { transaction: t });
      
      // Process first recharge bonus if applicable
      if (rechargeRecord.payment_status === false) {
        await referralService.processFirstRechargeBonus(rechargeRecord.user_id, addAmount);
      }
      
      await t.commit();
      
      return {
        success: true,
        message: "Payment processed successfully"
      };
    } else {
      // Payment failed or other status
      await WalletRecharge.update({
        payment_status: false,
        remark: `Payment failed with status: ${callbackData.tradeResult}`
      }, {
        where: { order_id: callbackData.mchOrderNo },
        transaction: t
      });

      // ✅ Create transaction record for failed deposit
      await Transaction.create({
        user_id: rechargeRecord.user_id,
        type: 'deposit_failed',
        amount: parseFloat(rechargeRecord.amount),
        status: 'failed',
        payment_gateway_id: 'WEPAY',
        order_id: callbackData.mchOrderNo,
        transaction_id: callbackData.orderNo || null,
        description: 'WEPAY deposit failed',
        reference_id: `wepay_deposit_failed_${callbackData.mchOrderNo}`,
        metadata: {
          gateway: 'WEPAY',
          original_status: callbackData.tradeResult,
          failure_reason: `Payment failed with status: ${callbackData.tradeResult}`,
          processed_at: new Date().toISOString()
        },
        created_at: new Date(),
        updated_at: new Date()
      }, { transaction: t });
      
      await t.commit();
      
      return {
        success: true,
        message: "Payment failure recorded"
      };
    }
  } catch (error) {
    await t.rollback();
    console.error("Error processing WePay collection callback:", error);
    
    return {
      success: false,
      message: "Error processing payment callback"
    };
  }
};

/**
 * Process verified withdrawal request via WePayGlobal
 * @param {number} withdrawalId - Withdrawal ID to process
 * @param {string} notifyUrl - Notification URL for callbacks
 * @returns {Object} - Processing result
 */
const processWePayTransfer = async (withdrawalId, notifyUrl) => {
  const t = await sequelize.transaction();
  
  try {
    // Get withdrawal record
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
    if (withdrawal.payment_status === true || withdrawal.time_of_failed) {
      await t.rollback();
      return {
        success: false,
        message: "Withdrawal already processed"
      };
    }
    
    // Check if withdrawal is approved by admin
    if (withdrawal.admin_status !== 'approved') {
      await t.rollback();
      return {
        success: false,
        message: "Withdrawal not approved by admin"
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
        message: "Bank account not found"
      };
    }
    
    // Current date in required format
    const applyDate = new Date().toISOString().replace('T', ' ').split('.')[0];
    
    // Prepare request parameters
    const params = {
      sign_type: wePayConfig.signType,
      mch_id: wePayConfig.mchId,
      mch_transferId: withdrawal.order_id,
      transfer_amount: Math.floor(parseFloat(withdrawal.withdrawal_amount)), // WePayGlobal requires integer amounts
      apply_date: applyDate,
      bank_code: wePayConfig.bankCode,
      receive_name: bankAccount.account_holder_name,
      receive_account: bankAccount.account_number,
      remark: bankAccount.ifsc_code, // IFSC code goes in remark field
      back_url: notifyUrl
    };
    
    // Generate signature
    params.sign = generateWePaySignature(params, true); // true for transfer
    
    // Call WePayGlobal API
    const response = await axios.post(wePayConfig.transferUrl, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    // Check for successful response
    if (response.data.respCode === 'SUCCESS') {
      // Update withdrawal record
      await WalletWithdrawal.update({
        transaction_id: response.data.tradeNo,
        remark: `WePay transfer initiated. Status: ${response.data.tradeResult}`
      }, {
        where: { withdrawal_id: withdrawalId },
        transaction: t
      });
      
      await t.commit();
      
      return {
        success: true,
        message: "Transfer initiated successfully",
        transactionId: response.data.tradeNo,
        status: response.data.tradeResult
      };
    } else {
      await t.rollback();
      
      return {
        success: false,
        message: `Payment gateway error: ${response.data.errorMsg}`,
        errorCode: response.data.respCode
      };
    }
  } catch (error) {
    await t.rollback();
    console.error("Error processing WePay transfer:", error);
    
    return {
      success: false,
      message: "Failed to process transfer"
    };
  }
};

/**
 * Process WePayGlobal transfer callback
 * @param {Object} callbackData - Callback data from WePay
 * @returns {Object} - Processing result
 */
const processWePayTransferCallback = async (callbackData) => {
  // Verify signature
  if (!verifyWePaySignature(callbackData, callbackData.sign, true)) {
    return {
      success: false,
      message: "Invalid signature"
    };
  }
  
  // Start a transaction
  const t = await sequelize.transaction();
  
  try {
    // Find the withdrawal record
    const withdrawalRecord = await WalletWithdrawal.findOne({
      where: { order_id: callbackData.merTransferId },
      transaction: t
    });
    
    if (!withdrawalRecord) {
      await t.rollback();
      return {
        success: false,
        message: "Withdrawal not found"
      };
    }
    
    // Check if already processed
    if (withdrawalRecord.payment_status === true || withdrawalRecord.time_of_failed) {
      await t.rollback();
      return {
        success: true,
        message: "Withdrawal already processed"
      };
    }
    
    // Process based on tradeResult
    if (callbackData.tradeResult === '1') { // Transfer successful
      // Update withdrawal record
      await WalletWithdrawal.update({
        status: 'completed',
        time_of_success: new Date(),
        remark: "Transfer successful"
      }, {
        where: { order_id: callbackData.merTransferId },
        transaction: t
      });
      
      // ✅ Create transaction record for successful withdrawal
      await Transaction.create({
        user_id: withdrawalRecord.user_id,
        type: 'withdrawal',
        amount: parseFloat(withdrawalRecord.withdrawal_amount),
        status: 'completed',
        payment_gateway_id: 'WEPAY',
        order_id: callbackData.merTransferId,
        transaction_id: callbackData.tradeNo || callbackData.merTransferId,
        created_at: new Date(),
        updated_at: new Date()
      }, { transaction: t });
      
      await t.commit();
      return {
        success: true,
        message: "Transfer processed successfully"
      };
    } else if (callbackData.tradeResult === '2') { // Transfer failed
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
        status: 'failed',
        time_of_failed: new Date(),
        admin_status: 'rejected',
        remark: `Transfer failed. Amount refunded to wallet.`
      }, {
        where: { order_id: callbackData.merTransferId },
        transaction: t
      });
      
      // ✅ Create transaction record for failed withdrawal (refund)
      await Transaction.create({
        user_id: withdrawalRecord.user_id,
        type: 'withdrawal',
        amount: parseFloat(withdrawalRecord.withdrawal_amount),
        status: 'failed',
        payment_gateway_id: 'WEPAY',
        order_id: callbackData.merTransferId,
        transaction_id: callbackData.tradeNo || callbackData.merTransferId,
        created_at: new Date(),
        updated_at: new Date()
      }, { transaction: t });
      
      await t.commit();
      return {
        success: true,
        message: "Transfer failure recorded and funds returned to wallet"
      };
    }
    // Other status (3=Rejected, 4=In progress)
    // Just update status and wait for final status
    await WalletWithdrawal.update({
      remark: `Transfer status updated: ${callbackData.tradeResult}`
    }, {
      where: { order_id: callbackData.merTransferId },
      transaction: t
    });
    await t.commit();
    return {
      success: true,
      message: "Transfer status updated"
    };
  } catch (error) {
    await t.rollback();
    console.error("Error processing WePay transfer callback:", error);
    
    return {
      success: false,
      message: "Error processing transfer callback"
    };
  }
};

module.exports = {
  createWePayCollectionOrder,
  processWePayCollectionCallback,
  processWePayTransfer,
  processWePayTransferCallback
};
