const axios = require('axios');
const usdtwgPayConfig = require('../config/usdtwgPayConfig');
const { generateUsdtwgPaySignature, verifyUsdtwgPaySignature } = require('../utils/usdtwgPaySignature');
const User = require('../models/User');
const WalletRecharge = require('../models/WalletRecharge');
const WalletWithdrawal = require('../models/WalletWithdrawal');
const AttendanceRecord = require('../models/AttendanceRecord');
const moment = require('moment-timezone');

// Helper to get current timestamp (10 digits, seconds)
function getTimestamp() {
  return Math.floor(Date.now() / 1000).toString();
}
// Helper to generate a random nonce (6+ chars)
function getNonce(len = 6) {
  const chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let str = '';
  for (let i = 0; i < len; i++) str += chars[Math.floor(Math.random() * chars.length)];
  return str;
}

/**
 * Create a deposit (collection) order
 */
async function createUsdtwgPayDepositOrder(userId, orderId, amount, notifyUrl, returnUrl, gatewayId) {
  const user = await User.findByPk(userId);
  if (!user) return { success: false, message: 'User not found' };
  
  // Convert INR to USDT for the gateway
  const USDT_TO_INR = parseFloat(process.env.USDTWG_PAY_USDT_TO_INR || '85');
  const usdtAmount = amount / USDT_TO_INR;
  
  // Save the original INR amount in the database
  await WalletRecharge.create({
    user_id: userId,
    amount: amount, // Save original INR amount
    order_id: orderId,
    payment_gateway_id: gatewayId,
    status: 'pending'
  });
  
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2, 10); // 8-char random string
  const urlPath = '/api/order/create';  // ✅ Correct API endpoint for order creation
  const method = 'POST';
  const body = {
    McorderNo: orderId,
    Amount: usdtAmount.toString(), // Send USDT amount to gateway
    Type: 'usdt',
    ChannelCode: usdtwgPayConfig.channelCode,
    CallBackUrl: notifyUrl || usdtwgPayConfig.notifyUrl,
    JumpUrl: returnUrl || usdtwgPayConfig.notifyUrl
  };
  const sign = generateUsdtwgPaySignature(method, urlPath, usdtwgPayConfig.accessKey, timestamp, nonce, usdtwgPayConfig.accessSecret);
  
  console.log('📋 USDT WG PAY DEPOSIT ORDER CREATED');
  console.log('='.repeat(60));
  console.log('Timestamp:', new Date().toISOString());
  console.log('Order Info:', {
    userId: userId,
    orderId: orderId,
    inrAmount: amount,
    usdtAmount: usdtAmount,
    gatewayId: gatewayId
  });
  console.log('USDT WG Pay Config:', {
    baseUrl: usdtwgPayConfig.baseUrl,
    accessKey: usdtwgPayConfig.accessKey ? 'SET' : 'NOT SET',
    accessSecret: usdtwgPayConfig.accessSecret ? 'SET' : 'NOT SET',
    channelCode: usdtwgPayConfig.channelCode ? 'SET' : 'NOT SET',
    notifyUrl: usdtwgPayConfig.notifyUrl
  });
  console.log('USDT WG Pay Request:', {
    apiUrl: `${usdtwgPayConfig.baseUrl}${urlPath}`,
    payload: body,
    signature: sign
  });
  // Log the signature details for testing
  console.log('--- USDTWG SIGNATURE DETAILS FOR TESTING ---');
  console.log('accesskey:', usdtwgPayConfig.accessKey);
  console.log('timestamp:', timestamp);
  console.log('nonce:', nonce);
  console.log('sign:', sign);
  console.log('SignatureData:', `${method}&${urlPath}&${usdtwgPayConfig.accessKey}&${timestamp}&${nonce}`);
  console.log('--- END SIGNATURE DETAILS ---');
  
  const response = await axios.post(
    usdtwgPayConfig.baseUrl + '/api/order/create',
    body,
    {
      headers: {
        'accessKey': usdtwgPayConfig.accessKey,
        'timestamp': timestamp,
        'nonce': nonce,
        'sign': sign,
        'Content-Type': 'application/json'
      }
    }
  );
  
  console.log('USDT WG Pay Response:', response.data);
  
  if (response.data.code === 200 && response.data.type === 'success') {
    await WalletRecharge.update(
      { transaction_id: response.data.result.orderNo },
      { where: { order_id: orderId } }
    );
    
    console.log('✅ USDT WG Pay deposit order creation completed!');
    console.log('💰 User wallet will be credited with ₹', amount, '(INR)');
    console.log('='.repeat(60));
    
    // 🔍 CALLBACK TESTING INFORMATION
    console.log('🔍 CALLBACK TESTING INFO FOR ORDER:', orderId);
    console.log('='.repeat(60));
    console.log('📋 Order Details:');
    console.log('  - Order ID (McorderNo):', orderId);
    console.log('  - Gateway Order No:', response.data.result.orderNo);
    console.log('  - Amount (INR):', amount);
    console.log('  - Amount (USDT):', usdtAmount);
    console.log('  - User ID:', userId);
    console.log('  - Gateway ID:', gatewayId);
    
    console.log('\n📞 Expected Callback URL:');
    console.log('  - URL:', notifyUrl || usdtwgPayConfig.notifyUrl);
    console.log('  - Method: POST');
    
    console.log('\n🔐 Expected Callback Headers:');
    console.log('  - accesskey:', usdtwgPayConfig.accessKey);
    console.log('  - timestamp: [10-digit timestamp]');
    console.log('  - nonce: [random string]');
    console.log('  - sign: [HMAC-SHA256 signature]');
    
    console.log('\n📦 Expected Callback Body:');
    console.log('  - merchantorder (or McorderNo):', orderId);
    console.log('  - orderno:', response.data.result.orderNo);
    console.log('  - amount:', usdtAmount);
    console.log('  - status: "success" (when payment completes)');
    console.log('  - [other gateway-specific fields]');
    
    console.log('\n🔍 Signature Generation for Callback:');
    console.log('  - Method: POST');
    console.log('  - URL Path: /api/payments/usdtwgpay/payin-callback');
    console.log('  - Access Key:', usdtwgPayConfig.accessKey);
    console.log('  - Access Secret:', usdtwgPayConfig.accessSecret ? '[HIDDEN]' : '[NOT SET]');
    console.log('  - Signature Format: HMAC-SHA256(base64)');
    console.log('  - Signature Data: POST&/api/payments/usdtwgpay/payin-callback&[accesskey]&[timestamp]&[nonce]');
    
    console.log('\n🧪 Test Callback Command:');
    console.log('curl -X POST "' + (notifyUrl || usdtwgPayConfig.notifyUrl) + '" \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -H "accesskey: ' + usdtwgPayConfig.accessKey + '" \\');
    console.log('  -H "timestamp: [TIMESTAMP]" \\');
    console.log('  -H "nonce: [NONCE]" \\');
    console.log('  -H "sign: [GENERATED_SIGNATURE]" \\');
    console.log('  -d \'{"merchantorder":"' + orderId + '","orderno":"' + response.data.result.orderNo + '","amount":"' + usdtAmount + '","status":"success"}\'');
    
    console.log('\n📊 Database Records:');
    console.log('  - WalletRecharge record created with order_id:', orderId);
    console.log('  - Status: pending');
    console.log('  - Will be updated to "completed" on successful callback');
    console.log('='.repeat(60));
    
    return {
      success: true,
      paymentUrl: response.data.result.payUrl,
      transactionId: response.data.result.orderNo,
      orderId: orderId
    };
  } else {
    console.log('❌ USDT WG Pay API Error:', response.data);
    return { success: false, message: response.data.message || 'Failed to create order' };
  }
}

/**
 * Process deposit callback
 */
async function processUsdtwgPayDepositCallback(req) {
  // Extract headers
  const { accesskey, timestamp, nonce, sign } = Object.fromEntries(
    Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  // Use the correct URL path for signature verification (must match what we generated)
  const urlPath = '/api/payments/usdtwgpay/payin-callback';
  const method = req.method;
  // Log incoming callback
  console.log('--- USDTWG Callback Start ---');
  console.log('Headers:', req.headers);
  console.log('Body:', req.body);
  // Signature debug logs
  console.log('Signature check params:', {
    method,
    urlPath,
    accesskey,
    timestamp,
    nonce,
    accessSecret: usdtwgPayConfig.accessSecret ? '[HIDDEN]' : '[NOT SET]'
  });
  const signatureData = `${method.toUpperCase()}&${urlPath}&${accesskey}&${timestamp}&${nonce}`;
  console.log('SignatureData:', signatureData);
  const expectedSign = generateUsdtwgPaySignature(method, urlPath, accesskey, timestamp, nonce, usdtwgPayConfig.accessSecret);
  console.log('Received sign:', sign);
  console.log('Expected sign:', expectedSign);
  // Verify signature
  const valid = (sign === expectedSign);
  console.log('Signature valid:', valid);
  if (!valid) {
    console.log('❌ Invalid signature');
    return { success: false, message: 'Invalid signature' };
  }
  // Process order
  const data = req.body;
  const orderId = data.merchantorder || data.McorderNo;
  const status = data.status;
  console.log('OrderId from callback:', orderId);
  const recharge = await WalletRecharge.findOne({ where: { order_id: orderId } });
  console.log('Recharge found:', recharge ? recharge.toJSON() : null);
  if (!recharge) {
    console.log('❌ Order not found for orderId:', orderId);
    return { success: false, message: 'Order not found' };
  }
  if (status === 'success') {
    // Use the saved INR amount directly (no conversion needed)
    const inrAmount = parseFloat(recharge.amount);
    await recharge.update({ 
      status: 'completed', 
      updated_at: new Date(), 
      transaction_id: data.orderno 
    });
    const user = await User.findByPk(recharge.user_id);
    console.log('User found:', user ? user.toJSON() : null);
    if (user) {
      const newBalance = parseFloat(user.wallet_balance) + inrAmount;
      const newActualDeposit = parseFloat(user.actual_deposit_amount || 0) + inrAmount;
      await user.update({ 
        wallet_balance: newBalance,
        actual_deposit_amount: newActualDeposit
      });
      // First recharge bonus logic
      const referralService = require('./referralService');
      if (!user.has_received_first_bonus) {
        const result = await referralService.processFirstRechargeBonus(user.user_id, inrAmount);
        if (result.success) {
          const newBonusAmount = parseFloat(user.bonus_amount || 0) + (result.bonusAmount || 0);
          await user.update({ 
            has_received_first_bonus: true,
            bonus_amount: newBonusAmount
          });
        }
      }
      // Referral update
      await referralService.updateReferralOnRecharge(user.user_id, inrAmount);
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
          recharge_amount: inrAmount,
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
          recharge_amount: (parseFloat(attendance.recharge_amount) || 0) + inrAmount,
          claim_eligible: true,
          updated_at: new Date()
        });
      }
      // --- End Attendance update logic ---
    } else {
      console.log('❌ User not found for user_id:', recharge.user_id);
    }
    console.log('--- USDTWG Callback End: Success ---');
    return { success: true };
  } else {
    await recharge.update({ status: 'failed' });
    console.log('❌ Payment failed or pending. Status:', status);
    console.log('--- USDTWG Callback End: Fail ---');
    return { success: false, message: 'Payment failed or pending' };
  }
}

/**
 * Create a withdrawal (payout) order
 */
async function createUsdtwgPayWithdrawalOrder(userId, orderId, amount, bankDetails, notifyUrl) {
  const user = await User.findByPk(userId);
  if (!user) return { success: false, message: 'User not found' };
  await WalletWithdrawal.create({
    user_id: userId,
    withdrawal_amount: amount,
    order_id: orderId,
    payment_gateway: 'USDTWGPAY',
    status: false
  });
  const timestamp = getTimestamp();
  const nonce = getNonce();
  const urlPath = '/api/payorder/create';
  const method = 'POST';
  const body = {
    McorderNo: orderId,
    Amount: amount.toString(),
    Type: 'usdt',
    ChannelCode: usdtwgPayConfig.channelCode,
    Address: bankDetails.address,
    Name: bankDetails.name,
    BankName: bankDetails.bankName,
    BankAccount: bankDetails.bankAccount,
    Ifsc: bankDetails.ifsc,
    NotifyUrl: notifyUrl || usdtwgPayConfig.payoutNotifyUrl
  };
  const sign = generateUsdtwgPaySignature(method, urlPath, usdtwgPayConfig.accessKey, timestamp, nonce, usdtwgPayConfig.accessSecret);
  const response = await axios.post(
    usdtwgPayConfig.baseUrl + urlPath,
    body,
    {
      headers: {
        'accessKey': usdtwgPayConfig.accessKey,
        'timestamp': timestamp,
        'nonce': nonce,
        'sign': sign,
        'Content-Type': 'application/json'
      }
    }
  );
  if (response.data.code === 200 && response.data.type === 'success') {
    await WalletWithdrawal.update(
      { transaction_id: response.data.result.orderNo },
      { where: { order_id: orderId } }
    );
    return {
      success: true,
      transactionId: response.data.result.orderNo,
      orderId: orderId
    };
  } else {
    return { success: false, message: response.data.message || 'Failed to create withdrawal order' };
  }
}

/**
 * Process withdrawal callback
 */
async function processUsdtwgPayWithdrawalCallback(req) {
  const { accesskey, timestamp, nonce, sign } = Object.fromEntries(
    Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  const urlPath = req.route ? req.route.path : req.path;
  const method = req.method;
  const valid = verifyUsdtwgPaySignature(
    method,
    urlPath,
    accesskey,
    timestamp,
    nonce,
    usdtwgPayConfig.accessSecret,
    sign
  );
  if (!valid) return { success: false, message: 'Invalid signature' };
  const data = req.body;
  const orderId = data.merchantorder || data.McorderNo;
  const status = data.status;
  const withdrawal = await WalletWithdrawal.findOne({ where: { order_id: orderId } });
  if (!withdrawal) return { success: false, message: 'Order not found' };
  if (status === 'success') {
    await withdrawal.update({ status: 'completed', time_of_success: new Date(), transaction_id: data.orderno });
    return { success: true };
  } else {
    await withdrawal.update({ status: 'failed' });
    return { success: false, message: 'Withdrawal failed or pending' };
  }
}

/**
 * Query merchant balance
 */
async function queryUsdtwgPayBalance() {
  const timestamp = getTimestamp();
  const nonce = getNonce();
  const urlPath = '/api/merchant/Balance';
  const method = 'GET';
  const sign = generateUsdtwgPaySignature(method, urlPath, usdtwgPayConfig.accessKey, timestamp, nonce, usdtwgPayConfig.accessSecret);
  const response = await axios.get(
    usdtwgPayConfig.baseUrl + urlPath,
    {
      headers: {
        'accessKey': usdtwgPayConfig.accessKey,
        'timestamp': timestamp,
        'nonce': nonce,
        'sign': sign
      }
    }
  );
  return response.data;
}

module.exports = {
  createUsdtwgPayDepositOrder,
  processUsdtwgPayDepositCallback,
  createUsdtwgPayWithdrawalOrder,
  processUsdtwgPayWithdrawalCallback,
  queryUsdtwgPayBalance
}; 
