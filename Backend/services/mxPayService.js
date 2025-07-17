// services/mxPayService.js
const axios = require('axios');
const { sequelize } = require('../config/db');
const { mxPayConfig } = require('../config/mxPayConfig');
const { generateMxPaySignature, verifyMxPaySignature } = require('../utils/mxPaySignature');
const User = require('../models/User');
const WalletRecharge = require('../models/WalletRecharge');
const WalletWithdrawal = require('../models/WalletWithdrawal');
const BankAccount = require('../models/BankAccount');
const { Op } = require('sequelize');

/**
 * Create a collection (deposit) order with MxPay
 * @param {number} userId - User ID
 * @param {string} orderId - Unique order ID
 * @param {number} amount - Amount to deposit
 * @param {string} notifyUrl - Notification URL for callbacks
 * @param {string} returnUrl - Return URL after payment
 * @returns {Object} - Response with payment URL
 */
const createMxPayCollectionOrder = async (userId, orderId, amount, notifyUrl, returnUrl) => {
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
      payment_gateway: 'MXPAY',
      payment_status: false
    }, { transaction: t });
    
    // Current date in required format
    const datetime = Date.now().toString();
    
    // Prepare request parameters
    const requestParams = {
      orderNo: orderId,
      memberCode: mxPayConfig.memberCode,
      passageInCode: mxPayConfig.defaultCollectionChannel,
      orderAmount: amount.toString(),
      notifyurl: notifyUrl || mxPayConfig.notifyUrl,
      callbackurl: returnUrl || mxPayConfig.callbackUrl,
      productName: "Wallet Recharge",
      datetime: datetime,
      attach: `userId:${userId}` // Additional info not involved in signature
    };
    
    // Generate signature
    const signature = generateMxPaySignature(requestParams, mxPayConfig.secretKey);
    
    // Make API call to MxPay
    const response = await axios.post(
      `${mxPayConfig.baseUrl}${mxPayConfig.collectionEndpoint}`,
      requestParams,
      {
        headers: {
          'Content-Type': 'application/json',
          'sign': signature
        }
      }
    );
    
    // Check response
    if (response.data.code === 1 && response.data.ok === true) {
      // Store transaction ID
      await WalletRecharge.update(
        { transaction_id: response.data.data.transactionNo },
        { 
          where: { order_id: orderId },
          transaction: t 
        }
      );
      
      await t.commit();
      
      return {
        success: true,
        message: "Payment order created successfully",
        paymentUrl: response.data.data.orderurl,
        transactionId: response.data.data.transactionNo,
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
    console.error("Error creating MxPay collection order:", error);
    
    return {
      success: false,
      message: "Failed to create payment order",
      error: error.message
    };
  }
};

/**
 * Process MxPay collection callback
 * @param {Object} callbackData - Callback data from MxPay
 * @returns {Object} - Processing result
 */
const processMxPayCollectionCallback = async (callbackData) => {
  // Verify signature
  if (!verifyMxPaySignature(callbackData, callbackData.sign, mxPayConfig.secretKey)) {
    console.error('Invalid signature in MxPay callback');
    return {
      success: false,
      message: "Invalid signature"
    };
  }
  
  // Start a transaction
  const t = await sequelize.transaction();
  
  try {
    // Find the recharge record by merchant order number
    const rechargeRecord = await WalletRecharge.findOne({
      where: { order_id: callbackData.orderNo },
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
    
    // Check payment status (00 means success according to the docs)
    if (callbackData.returncode === "00") {
      // Update recharge record
      await WalletRecharge.update({
        payment_status: true,
        time_of_success: new Date(),
        transaction_id: callbackData.transactionNo
      }, {
        where: { order_id: callbackData.orderNo },
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
      const addAmount = parseFloat(callbackData.amount);
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
    } else {
      // Payment failed
      await WalletRecharge.update({
        payment_status: false,
        remark: `Payment failed with status: ${callbackData.returncode}`
      }, {
        where: { order_id: callbackData.orderNo },
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
    console.error("Error processing MxPay collection callback:", error);
    
    return {
      success: false,
      message: "Error processing payment callback"
    };
  }
};

/**
 * Check collection order status
 * @param {string} orderId - Order ID to check
 * @returns {Object} - Order status
 */
const checkMxPayCollectionStatus = async (orderId) => {
  try {
    // Generate signature for the request
    const params = {
      orderNo: orderId,
      memberCode: mxPayConfig.memberCode
    };
    
    const signature = generateMxPaySignature(params, mxPayConfig.secretKey);
    
    // Make the API call
    const response = await axios.get(
      `${mxPayConfig.baseUrl}${mxPayConfig.collectionStatusEndpoint}?orderNo=${orderId}`,
      {
        headers: {
          'sign': signature
        }
      }
    );
    
    // Check response
    if (response.data.code === 1 && response.data.ok === true) {
      // Verify response signature
      if (!verifyMxPaySignature(response.data.data, response.data.data.sign, mxPayConfig.secretKey)) {
        return {
          success: false,
          message: "Invalid signature in status response"
        };
      }
      
      // Map the status
      const status = response.data.data.returncode === "00" ? "success" : 
                    response.data.data.returncode === "11" ? "processing" : "failed";
      
      return {
        success: true,
        order: {
          orderId: response.data.data.orderNo,
          transactionId: response.data.data.transactionNo,
          amount: response.data.data.amount,
          status: status,
          datetime: response.data.data.datetime
        }
      };
    } else {
      return {
        success: false,
        message: `Error checking order status: ${response.data.msg}`
      };
    }
  } catch (error) {
    console.error("Error checking MxPay order status:", error);
    
    return {
      success: false,
      message: "Failed to check order status",
      error: error.message
    };
  }
};

/**
 * Process verified withdrawal request via MxPay
 * @param {number} withdrawalId - Withdrawal ID to process
 * @param {string} notifyUrl - Notification URL for callbacks
 * @returns {Object} - Processing result
 */
const processMxPayTransfer = async (withdrawalId, notifyUrl) => {
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
    
    // Get user info for phoneNo (orderRemark field)
    const user = await User.findByPk(withdrawal.user_id, {
      transaction: t
    });
    
    // Current timestamp
    const datetime = Date.now().toString();
    
    // Prepare request parameters
    const requestParams = {
      memberCode: mxPayConfig.memberCode,
      orderCardNo: bankAccount.account_number,
      orderUsername: bankAccount.account_holder_name,
      memberOrderNo: withdrawal.order_id,
      passageOutCode: mxPayConfig.defaultTransferChannel,
      bankCode: mxPayConfig.defaultBankCode,
      orderAmount: withdrawal.withdrawal_amount.toString(),
      notifyurl: notifyUrl,
      orderRemark: user.phone_no, // Phone number as per documentation
      datetime: datetime,
      attach: bankAccount.ifsc_code // IFSC code as per documentation (not involved in signature)
    };
    
    // Generate signature
    const signature = generateMxPaySignature(requestParams, mxPayConfig.secretKey);
    
    // Make API call to MxPay
    const response = await axios.post(
      `${mxPayConfig.baseUrl}${mxPayConfig.transferEndpoint}`,
      requestParams,
      {
        headers: {
          'Content-Type': 'application/json',
          'sign': signature
        }
      }
    );
    
    // Check response
    if (response.data.code === 1 && response.data.ok === true) {
      // Update withdrawal record
      await WalletWithdrawal.update({
        transaction_id: response.data.data.orderNo,
        remark: `MxPay transfer initiated.`
      }, {
        where: { withdrawal_id: withdrawalId },
        transaction: t
      });
      
      await t.commit();
      
      return {
        success: true,
        message: "Transfer initiated successfully",
        transactionId: response.data.data.orderNo
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
    console.error("Error processing MxPay transfer:", error);
    
    return {
      success: false,
      message: "Failed to process transfer",
      error: error.message
    };
  }
};

/**
 * Process MxPay transfer callback
 * @param {Object} callbackData - Callback data from MxPay
 * @returns {Object} - Processing result
 */
const processMxPayTransferCallback = async (callbackData) => {
  // Verify signature
  if (!verifyMxPaySignature(callbackData, callbackData.sign, mxPayConfig.secretKey)) {
    return {
      success: false,
      message: "Invalid signature"
    };
  }
  
  // Start a transaction
  const t = await sequelize.transaction();
  
  try {
    // Find the withdrawal record using memberOrderNo from callback
    const withdrawalRecord = await WalletWithdrawal.findOne({
      where: { order_id: callbackData.orderNo },
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
    
    // Process based on returncode
    if (callbackData.returncode === "00") { // Success
      // Update withdrawal record
      await WalletWithdrawal.update({
        status: 'completed',
        time_of_success: new Date(),
        remark: "Transfer successful"
      }, {
        where: { order_id: callbackData.orderNo },
        transaction: t
      });
      await t.commit();
      return {
        success: true,
        message: "Transfer processed successfully"
      };
    } else if (callbackData.returncode === "33") { // Failed
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
        remark: `Transfer failed with code ${callbackData.returncode}. Amount refunded to wallet.`
      }, {
        where: { order_id: callbackData.orderNo },
        transaction: t
      });
      await t.commit();
      return {
        success: true,
        message: "Transfer failure recorded and funds returned to wallet"
      };
    }
    // Just update status
    await WalletWithdrawal.update({
      remark: `Transfer status update: ${callbackData.returncode}`
    }, {
      where: { order_id: callbackData.orderNo },
      transaction: t
    });
    await t.commit();
    return {
      success: true,
      message: "Transfer status updated"
    };
  } catch (error) {
    await t.rollback();
    console.error("Error processing MxPay transfer callback:", error);
    
    return {
      success: false,
      message: "Error processing transfer callback"
    };
  }
};

/**
 * Get available bank list for transfers
 * @returns {Object} - List of available banks
 */
const getMxPayBankList = async () => {
  try {
    // Generate signature for the request
    const params = {
      memberCode: mxPayConfig.memberCode
    };
    
    const signature = generateMxPaySignature(params, mxPayConfig.secretKey);
    
    // Make the API call
    const response = await axios.get(
      `${mxPayConfig.baseUrl}${mxPayConfig.bankListEndpoint}?memberCode=${mxPayConfig.memberCode}`,
      {
        headers: {
          'sign': signature
        }
      }
    );
    
    // Check response
    if (response.data.code === 1 && response.data.ok === true) {
      return {
        success: true,
        banks: response.data.data.list || []
      };
    } else {
      return {
        success: false,
        message: `Error getting bank list: ${response.data.msg}`
      };
    }
  } catch (error) {
    console.error("Error getting MxPay bank list:", error);
    
    return {
      success: false,
      message: "Failed to get bank list",
      error: error.message
    };
  }
};

/**
 * Check merchant balance
 * @returns {Object} - Merchant balance information
 */
const checkMxPayMerchantBalance = async () => {
  try {
    // Generate signature for the request
    const params = {
      memberCode: mxPayConfig.memberCode
    };
    
    const signature = generateMxPaySignature(params, mxPayConfig.secretKey);
    
    // Make the API call
    const response = await axios.get(
      `${mxPayConfig.baseUrl}${mxPayConfig.memberBalanceEndpoint}?memberCode=${mxPayConfig.memberCode}`,
      {
        headers: {
          'sign': signature
        }
      }
    );
    
    // Check response
    if (response.data.code === 1 && response.data.ok === true) {
      // Verify response signature
      if (!verifyMxPaySignature(response.data.data, response.data.data.sign, mxPayConfig.secretKey)) {
        return {
          success: false,
          message: "Invalid signature in balance response"
        };
      }
      
      return {
        success: true,
        balance: {
          memberCode: response.data.data.memberCode,
          memberName: response.data.data.memberName,
          amount: response.data.data.amount,
          runAmount: response.data.data.runAmount,
          frozenAmount: response.data.data.frozenAmount
        }
      };
    } else {
      return {
        success: false,
        message: `Error checking merchant balance: ${response.data.msg}`
      };
    }
  } catch (error) {
    console.error("Error checking MxPay merchant balance:", error);
    
    return {
      success: false,
      message: "Failed to check merchant balance",
      error: error.message
    };
  }
};

module.exports = {
  createMxPayCollectionOrder,
  processMxPayCollectionCallback,
  checkMxPayCollectionStatus,
  processMxPayTransfer,
  processMxPayTransferCallback,
  getMxPayBankList,
  checkMxPayMerchantBalance
};