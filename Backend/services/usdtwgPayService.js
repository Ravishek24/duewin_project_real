const axios = require('axios');
const usdtwgPayConfig = require('../config/usdtwgPayConfig');
const { generateUsdtwgPaySignature, verifyUsdtwgPaySignature } = require('../utils/usdtwgPaySignature');
const User = require('../models/User');
const WalletRecharge = require('../models/WalletRecharge');
const WalletWithdrawal = require('../models/WalletWithdrawal');

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
async function createUsdtwgPayDepositOrder(userId, orderId, amount, notifyUrl, returnUrl) {
  const user = await User.findByPk(userId);
  if (!user) return { success: false, message: 'User not found' };
  await WalletRecharge.create({
    user_id: userId,
    phone_no: user.phone_no,
    added_amount: amount,
    order_id: orderId,
    payment_gateway: 'USDTWGPAY',
    payment_status: false
  });
  const timestamp = getTimestamp();
  const nonce = getNonce();
  const urlPath = '/api/order/create';
  const method = 'POST';
  const body = {
    McorderNo: orderId,
    Amount: amount.toString(),
    Type: 'usdt',
    ChannelCode: usdtwgPayConfig.channelCode,
    CallBackUrl: notifyUrl || usdtwgPayConfig.notifyUrl,
    JumpUrl: returnUrl || usdtwgPayConfig.notifyUrl
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
    await WalletRecharge.update(
      { transaction_id: response.data.result.orderNo },
      { where: { order_id: orderId } }
    );
    return {
      success: true,
      paymentUrl: response.data.result.payUrl,
      transactionId: response.data.result.orderNo,
      orderId: orderId
    };
  } else {
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
  const urlPath = req.route ? req.route.path : req.path;
  const method = req.method;
  // Verify signature
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
  // Process order
  const data = req.body;
  const orderId = data.merchantorder || data.McorderNo;
  const status = data.status;
  const recharge = await WalletRecharge.findOne({ where: { order_id: orderId } });
  if (!recharge) return { success: false, message: 'Order not found' };
  if (status === 'success') {
    await recharge.update({ payment_status: true, time_of_success: new Date(), transaction_id: data.orderno });
    const user = await User.findByPk(recharge.user_id);
    if (user) {
      const newBalance = parseFloat(user.wallet_balance) + parseFloat(data.amount);
      await user.update({ wallet_balance: newBalance });
    }
    return { success: true };
  } else {
    await recharge.update({ payment_status: false });
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
    await withdrawal.update({ status: true, time_of_success: new Date(), transaction_id: data.orderno });
    return { success: true };
  } else {
    await withdrawal.update({ status: false });
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