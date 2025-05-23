/**
 * OKPAY Integration Service
 * Based on OKPAY API documentation
 */
const axios = require('axios');
const crypto = require('crypto');
const { WalletRecharge } = require('../models');
const User = require('../models/User');

// OKPAY Configuration
const OKPAY_CONFIG = {
  // Test Environment
  mchId: process.env.OKPAY_MCH_ID || '1000',
  key: process.env.OKPAY_KEY || 'eb6080dbc8dc429ab86a1cd1c337975d',
  host: process.env.OKPAY_HOST || 'sandbox.wpay.one',
  currency: 'INR',
  // Production Environment
  // mchId: process.env.OKPAY_PROD_MCH_ID,
  // key: process.env.OKPAY_PROD_KEY,
  // host: process.env.OKPAY_PROD_HOST || 'api.wpay.one',
};

/**
 * Calculate signature for OKPAY requests
 * @param {Object} params - Parameters to sign
 * @returns {string} - MD5 signature
 */
function calculateSignature(params) {
  // Filter out empty values and sign parameter
  const filteredParams = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null && value !== '' && value !== 'sign')
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

  // Sort parameters by key (ASCII order)
  const sortedKeys = Object.keys(filteredParams).sort();
  
  // Create URL parameter string
  const stringA = sortedKeys.map(key => `${key}=${filteredParams[key]}`).join('&');
  
  // Append key
  const stringSignTemp = `${stringA}&key=${OKPAY_CONFIG.key}`;
  
  // Calculate MD5 hash and convert to lowercase
  return crypto.createHash('md5').update(stringSignTemp).digest('hex').toLowerCase();
}

/**
 * Create a payment order with OKPAY
 * @param {number} userId - User ID
 * @param {string} orderId - Unique order ID
 * @param {string} payType - Payment type (UPI)
 * @param {number} amount - Payment amount
 * @param {string} notifyUrl - Callback URL for payment notifications
 * @param {number} gatewayId - Payment gateway ID
 * @returns {Promise<Object>} - Result object
 */
const createOkPayCollectionOrder = async (userId, orderId, payType, amount, notifyUrl, gatewayId) => {
  try {
    // Ensure amount is a positive integer (OKPAY requires integer amounts)
    const orderAmount = Math.floor(parseFloat(amount));
    if (orderAmount <= 0) {
      return {
        success: false,
        message: 'Invalid amount. Amount must be positive.'
      };
    }

    // Prepare parameters for OKPAY API
    const params = {
      mchId: OKPAY_CONFIG.mchId,
      currency: OKPAY_CONFIG.currency,
      out_trade_no: orderId,
      pay_type: payType || 'UPI',
      money: orderAmount,
      notify_url: notifyUrl,
      returnUrl: process.env.FRONTEND_URL || 'https://duewin.com/wallet',
      attach: `userId=${userId}`
    };

    // Calculate signature
    params.sign = calculateSignature(params);

    console.log('OKPAY Request Params:', params);

    // Make API request to OKPAY
    const apiUrl = `https://${OKPAY_CONFIG.host}/v1/Collect`;
    const response = await axios.post(apiUrl, new URLSearchParams(params).toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    console.log('OKPAY API Response:', response.data);

    // Check response
    if (response.data.code === 0) {
      // Create recharge record in database
      await WalletRecharge.create({
        user_id: userId,
        amount: amount,
        payment_gateway_id: gatewayId,
        total_amount: amount,
        fee: 0,
        status: 'pending',
        transaction_id: orderId
      });

      return {
        success: true,
        message: 'Payment order created successfully',
        paymentUrl: response.data.data.url,
        transactionId: response.data.data.transaction_Id,
        orderId: orderId
      };
    } else {
      return {
        success: false,
        message: `OKPAY Error: ${response.data.msg}`,
        errorCode: response.data.code
      };
    }
  } catch (error) {
    console.error('Error creating OKPAY collection order:', error);
    if (error.response) {
      console.error('OKPAY API Response:', error.response.data);
    }
    return {
      success: false,
      message: 'Server error creating payment order',
      error: error.message
    };
  }
};

/**
 * Process OKPAY payment notification callback
 * @param {Object} callbackData - Callback data from OKPAY
 * @returns {Promise<Object>} - Result object
 */
const processOkPayCallback = async (callbackData) => {
  try {
    console.log('Received OKPAY callback:', callbackData);

    // Verify signature
    const receivedSign = callbackData.sign;
    const calculatedSign = calculateSignature(callbackData);

    if (receivedSign !== calculatedSign) {
      console.error('OKPAY callback signature verification failed');
      return {
        success: false,
        message: 'Invalid signature'
      };
    }

    // Extract order details
    const { out_trade_no: orderId, transaction_Id: transactionId, status } = callbackData;

    // Find the order in our database
    const order = await WalletRecharge.findOne({
      where: { id: orderId }
    });

    if (!order) {
      console.error(`Order not found: ${orderId}`);
      return {
        success: false,
        message: 'Order not found'
      };
    }

    // Update order status based on OKPAY status
    // OKPAY status: 0 = pending, 1 = success, 2 = failed
    let orderStatus;
    if (status === '1') {
      orderStatus = 'completed';
    } else if (status === '2') {
      orderStatus = 'failed';
    } else {
      orderStatus = 'pending';
    }

    // Update order in database
    await order.update({
      status: orderStatus,
      updated_at: new Date()
    });

    // If payment was successful, update wallet balance
    if (orderStatus === 'completed') {
      // Find the user
      const user = await User.findByPk(order.user_id);
      if (user) {
        // Update wallet balance
        const newBalance = parseFloat(user.wallet_balance) + parseFloat(order.amount);
        await user.update({ wallet_balance: newBalance });
      }
    }

    // Return success to OKPAY to acknowledge callback received
    return {
      success: true,
      message: 'success'  // Must return "success" string for OKPAY
    };
  } catch (error) {
    console.error('Error processing OKPAY callback:', error);
    return {
      success: false,
      message: 'Server error processing callback'
    };
  }
};

module.exports = {
  createOkPayCollectionOrder,
  processOkPayCallback
}; 