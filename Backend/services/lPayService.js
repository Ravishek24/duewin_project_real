const axios = require('axios');
const https = require('https');
const { sequelize } = require('../config/db');
const lPayConfig = require('../config/lPayConfig');
const { generateLPaySignature, verifyLPaySignature } = require('../utils/lPaySignature');
const User = require('../models/User');
const WalletRecharge = require('../models/WalletRecharge');
const WalletWithdrawal = require('../models/WalletWithdrawal');
const BankAccount = require('../models/BankAccount');
const AttendanceRecord = require('../models/AttendanceRecord');
const moment = require('moment-timezone');

// Create secure axios instance for L Pay
const createSecureAxios = () => {
  return axios.create({
    timeout: 30000,
    httpsAgent: new https.Agent({
      rejectUnauthorized: false, // Disable SSL verification for problematic gateways
      secureProtocol: 'TLSv1_2_method' // Use only this, not minVersion/maxVersion
    })
  });
};

const secureAxios = createSecureAxios();

/**
 * Create a collection (deposit) order with L_pay
 */
const createLPayCollectionOrder = async (userId, orderId, amount, notifyUrl, gatewayId) => {
  const t = await sequelize.transaction();
  try {
    const user = await User.findByPk(userId, { transaction: t });
    if (!user) {
      await t.rollback();
      return { success: false, message: 'User not found' };
    }
    await WalletRecharge.create({
      user_id: userId,
      amount: amount,
      order_id: orderId,
      payment_gateway_id: gatewayId,
      status: 'pending'
    }, { transaction: t });
    const datetime = Date.now().toString();
    const requestParams = {
      orderNo: orderId,
      memberCode: lPayConfig.memberCode,
      passageInCode: lPayConfig.defaultCollectionChannel,
      orderAmount: amount.toString(),
      notifyurl: notifyUrl || lPayConfig.notifyUrl,
      callbackurl: lPayConfig.callbackUrl,
      productName: 'Wallet Recharge',
      datetime: datetime,
      attach: `userId:${userId}`
    };
    const signature = generateLPaySignature(requestParams, lPayConfig.secretKey);
    
    // Log the deposit order creation details
    console.log('\n📋 L PAY DEPOSIT ORDER CREATED');
    console.log('='.repeat(60));
    console.log('Timestamp:', new Date().toISOString());
    console.log('Order Info:', {
      userId: userId,
      orderId: orderId,
      amount: amount,
      gatewayId: gatewayId
    });
    console.log('L Pay Request:', {
      apiUrl: `${lPayConfig.baseUrl}${lPayConfig.collectionEndpoint}`,
      payload: requestParams,
      signature: signature
    });
    
    const response = await secureAxios.post(
      `${lPayConfig.baseUrl}${lPayConfig.collectionEndpoint}`,
      requestParams,
      {
        headers: {
          'Content-Type': 'application/json',
          'sign': signature
        }
      }
    );
    
    console.log('L Pay Response:', response.data);
    
    if (response.data.code === 1 && response.data.ok === true) {
      await WalletRecharge.update(
        { transaction_id: response.data.data.transactionNo },
        { where: { order_id: orderId }, transaction: t }
      );
      await t.commit();
      
      // Generate expected callback data for testing
      const expectedCallbackData = {
        returncode: '00', // Success
        memberCode: lPayConfig.memberCode,
        orderNo: orderId,
        amount: amount.toString(),
        datetime: datetime,
        transactionNo: response.data.data.transactionNo || 'TXN' + Date.now(),
        attach: `userId:${userId}`
      };
      
      // Generate callback signature
      const callbackSignature = generateLPaySignature(expectedCallbackData, lPayConfig.secretKey);
      expectedCallbackData.sign = callbackSignature;
      
      console.log('\n📤 EXPECTED CALLBACK DETAILS FOR TESTING:');
      console.log('='.repeat(60));
      console.log('🔗 Callback URL:', notifyUrl || lPayConfig.notifyUrl);
      console.log('📤 Expected Callback Payload (JSON):');
      console.log(JSON.stringify(expectedCallbackData, null, 2));
      console.log('🔐 Expected Callback Signature:', callbackSignature);
      
      console.log('\n📝 cURL Command for Testing (JSON):');
      const curlCommand = `curl -X POST "${notifyUrl || lPayConfig.notifyUrl}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(expectedCallbackData)}'`;
      console.log(curlCommand);
      
      console.log('\n📝 cURL Command for Testing (Form-encoded):');
      const formData = Object.entries(expectedCallbackData)
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join('&');
      const curlFormCommand = `curl -X POST "${notifyUrl || lPayConfig.notifyUrl}" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "${formData}"`;
      console.log(curlFormCommand);
      
      console.log('\n📝 Postman Body (JSON):');
      console.log(JSON.stringify(expectedCallbackData, null, 2));
      
      console.log('\n📝 Postman Body (x-www-form-urlencoded):');
      Object.entries(expectedCallbackData).forEach(([key, value]) => {
        console.log(`${key}=${value}`);
      });
      
      console.log('\n📝 Postman Headers (JSON):');
      console.log('Content-Type: application/json');
      
      console.log('\n📝 Postman Headers (Form-encoded):');
      console.log('Content-Type: application/x-www-form-urlencoded');
      
      console.log('\n✅ L Pay deposit order creation completed!');
      console.log('💰 User wallet will be credited with ₹', amount);
      console.log('='.repeat(60));
      
      return {
        success: true,
        message: 'Payment order created successfully',
        paymentUrl: response.data.data.orderurl,
        transactionId: response.data.data.transactionNo,
        orderId: orderId
      };
    } else {
      await t.rollback();
      console.log('\n❌ L Pay API Error:', response.data);
      return {
        success: false,
        message: `Payment gateway error: ${response.data.msg}`,
        errorCode: response.data.code
      };
    }
  } catch (error) {
    await t.rollback();
    console.log('\n❌ L Pay Error:', error.message);
    return { success: false, message: 'Failed to create payment order', error: error.message };
  }
};

/**
 * Process L_pay collection callback
 */
const processLPayCollectionCallback = async (callbackData) => {
  console.log('\n📥 L PAY CALLBACK RECEIVED');
  console.log('='.repeat(60));
  console.log('Timestamp:', new Date().toISOString());
  console.log('Content-Type:', 'application/json or x-www-form-urlencoded');
  console.log('Received Callback Data:', JSON.stringify(callbackData, null, 2));
  
  // Handle both JSON and form-encoded data
  // If callbackData is a string (form-encoded), parse it
  if (typeof callbackData === 'string') {
    try {
      const params = new URLSearchParams(callbackData);
      callbackData = Object.fromEntries(params);
      console.log('Parsed form-encoded data:', JSON.stringify(callbackData, null, 2));
    } catch (error) {
      console.log('Error parsing form data:', error.message);
    }
  }
  
  if (!verifyLPaySignature(callbackData, callbackData.sign, lPayConfig.secretKey)) {
    console.log('❌ Invalid signature - callback rejected');
    return { success: false, message: 'Invalid signature' };
  }
  
  console.log('✅ Signature verified successfully');
  
  const t = await sequelize.transaction();
  try {
    const rechargeRecord = await WalletRecharge.findOne({
      where: { order_id: callbackData.orderNo },
      transaction: t
    });
    
    if (!rechargeRecord) {
      await t.rollback();
      console.log('❌ Order not found:', callbackData.orderNo);
      return { success: false, message: 'Order not found' };
    }
    
    console.log('✅ Order found:', {
      orderId: rechargeRecord.order_id,
      status: rechargeRecord.status,
      amount: rechargeRecord.amount,
      userId: rechargeRecord.user_id
    });
    
    if (rechargeRecord.status === 'completed') {
      await t.rollback();
      console.log('✅ Payment already processed');
      return { success: true, message: 'Payment already processed' };
    }
    
    if (callbackData.returncode === '00') {
      console.log('✅ Processing successful payment...');
      
      await WalletRecharge.update({
        status: 'completed',
        updated_at: new Date(),
        transaction_id: callbackData.transactionNo
      }, {
        where: { order_id: callbackData.orderNo },
        transaction: t
      });
      
      const user = await User.findByPk(rechargeRecord.user_id, { transaction: t });
      if (!user) {
        await t.rollback();
        console.log('❌ User not found:', rechargeRecord.user_id);
        return { success: false, message: 'User not found' };
      }
      
      const addAmount = parseFloat(callbackData.amount);
      const newBalance = parseFloat(user.wallet_balance) + addAmount;
      const newActualDeposit = parseFloat(user.actual_deposit_amount || 0) + addAmount;
      await User.update({ 
        wallet_balance: newBalance,
        actual_deposit_amount: newActualDeposit
      }, { where: { user_id: rechargeRecord.user_id }, transaction: t });
      // First recharge bonus logic
      const referralService = require('./referralService');
      if (!user.has_received_first_bonus) {
        const result = await referralService.processFirstRechargeBonus(user.user_id, addAmount);
        if (result.success) {
          const newBonusAmount = parseFloat(user.bonus_amount || 0) + (result.bonusAmount || 0);
          await user.update({ 
            has_received_first_bonus: true,
            bonus_amount: newBonusAmount
          }, { transaction: t });
        }
      }
      // Referral update
      await referralService.updateReferralOnRecharge(user.user_id, addAmount);
      // --- Attendance update logic ---
      const todayIST = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
      const [attendance, created] = await AttendanceRecord.findOrCreate({
        where: { user_id: user.user_id, attendance_date: todayIST },
        defaults: {
          user_id: user.user_id,
          attendance_date: todayIST,
          date: todayIST,
          streak_count: 1,
          has_recharged: true,
          recharge_amount: addAmount,
          claim_eligible: true,
          bonus_amount: 0,
          bonus_claimed: false,
          created_at: new Date(),
          updated_at: new Date()
        }
      });
      if (!created) {
        await attendance.update({
          has_recharged: true,
          recharge_amount: (parseFloat(attendance.recharge_amount) || 0) + addAmount,
          claim_eligible: true,
          updated_at: new Date()
        });
      }
      // --- End Attendance update logic ---
      await t.commit();
      
      console.log('✅ Payment processed successfully!');
      console.log('💰 User wallet credited with ₹', addAmount);
      console.log('='.repeat(60));
      
      return { success: true, message: 'Payment processed successfully' };
    } else {
      console.log('❌ Payment failed or pending. Return code:', callbackData.returncode);
      
      await WalletRecharge.update({ status: 'failed' }, { where: { order_id: callbackData.orderNo }, transaction: t });
      await t.commit();
      
      console.log('❌ Order status updated to failed');
      console.log('='.repeat(60));
      
      return { success: false, message: 'Payment failed or pending' };
    }
  } catch (error) {
    await t.rollback();
    console.log('❌ Error processing callback:', error.message);
    console.log('='.repeat(60));
    return { success: false, message: 'Error processing callback', error: error.message };
  }
};

/**
 * Create a withdrawal (transfer) order with L_pay
 */
const createLPayTransferOrder = async (userId, orderId, amount, bankDetails, notifyUrl) => {
  const t = await sequelize.transaction();
  try {
    const user = await User.findByPk(userId, { transaction: t });
    if (!user) {
      await t.rollback();
      return { success: false, message: 'User not found' };
    }
    // Removed WalletWithdrawal.create here -- record already exists
    const datetime = Date.now().toString();
    const requestParams = {
      memberCode: lPayConfig.memberCode,
      orderCardNo: bankDetails.accountNo,
      orderUsername: bankDetails.accountName,
      memberOrderNo: orderId,
      passageOutCode: lPayConfig.defaultTransferChannel,
      bankCode: bankDetails.bankCode || lPayConfig.defaultBankCode,
      orderAmount: amount.toString(),
      notifyurl: notifyUrl || lPayConfig.notifyUrl,
      orderRemark: bankDetails.phone || '',
      datetime: datetime,
      attach: bankDetails.ifsc || ''
    };
    const signature = generateLPaySignature(requestParams, lPayConfig.secretKey);
    const response = await secureAxios.post(
      `${lPayConfig.baseUrl}${lPayConfig.transferEndpoint}`,
      requestParams,
      {
        headers: {
          'Content-Type': 'application/json',
          'sign': signature
        }
      }
    );
    if (response.data.code === 1 && response.data.ok === true) {
      await WalletWithdrawal.update(
        { transaction_id: response.data.data.orderNo },
        { where: { order_id: orderId }, transaction: t }
      );
      await t.commit();
      return {
        success: true,
        message: 'Withdrawal order created successfully',
        transactionId: response.data.data.orderNo,
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
    return { success: false, message: 'Failed to create withdrawal order', error: error.message };
  }
};

/**
 * Process L_pay withdrawal callback
 */
const processLPayWithdrawalCallback = async (callbackData) => {
  if (!verifyLPaySignature(callbackData, callbackData.sign, lPayConfig.secretKey)) {
    return { success: false, message: 'Invalid signature' };
  }
  const t = await sequelize.transaction();
  try {
    const withdrawalRecord = await WalletWithdrawal.findOne({
      where: { order_id: callbackData.orderNo },
      transaction: t
    });
    if (!withdrawalRecord) {
      await t.rollback();
      return { success: false, message: 'Order not found' };
    }
    if (withdrawalRecord.status === 'completed') {
      await t.rollback();
      return { success: true, message: 'Withdrawal already processed' };
    }
    if (callbackData.returncode === '00') {
      await WalletWithdrawal.update({
        status: 'completed',
        time_of_success: new Date(),
        transaction_id: callbackData.transactionNo
      }, {
        where: { order_id: callbackData.orderNo },
        transaction: t
      });
      await t.commit();
      return { success: true, message: 'Withdrawal processed successfully' };
    } else {
      await WalletWithdrawal.update({ status: 'failed' }, { where: { order_id: callbackData.orderNo }, transaction: t });
      await t.commit();
      return { success: false, message: 'Withdrawal failed or pending' };
    }
  } catch (error) {
    await t.rollback();
    return { success: false, message: 'Error processing withdrawal callback', error: error.message };
  }
};

/**
 * Query deposit order status
 */
const queryLPayDepositOrder = async (orderNo) => {
  try {
    const params = { orderNo };
    const signature = generateLPaySignature(params, lPayConfig.secretKey);
    const response = await axios.get(
      `${lPayConfig.baseUrl}${lPayConfig.collectionStatusEndpoint}`,
      {
        params,
        headers: { 'sign': signature }
      }
    );
    return response.data;
  } catch (error) {
    return { success: false, message: 'Failed to query deposit order', error: error.message };
  }
};

/**
 * Query merchant balance
 */
const queryLPayMerchantBalance = async () => {
  try {
    const params = { memberCode: lPayConfig.memberCode };
    const signature = generateLPaySignature(params, lPayConfig.secretKey);
    const response = await secureAxios.get(
      `${lPayConfig.baseUrl}${lPayConfig.memberBalanceEndpoint}`,
      {
        params,
        headers: { 'sign': signature }
      }
    );
    return response.data;
  } catch (error) {
    return { success: false, message: 'Failed to query merchant balance', error: error.message };
  }
};

/**
 * Get bank list
 */
const getLPayBankList = async () => {
  try {
    const params = { memberCode: lPayConfig.memberCode };
    const response = await secureAxios.get(
      `${lPayConfig.baseUrl}${lPayConfig.bankListEndpoint}`,
      { params }
    );
    return response.data;
  } catch (error) {
    return { success: false, message: 'Failed to get bank list', error: error.message };
  }
};

module.exports = {
  createLPayCollectionOrder,
  processLPayCollectionCallback,
  createLPayTransferOrder,
  processLPayWithdrawalCallback,
  queryLPayDepositOrder,
  queryLPayMerchantBalance,
  getLPayBankList
}; 
