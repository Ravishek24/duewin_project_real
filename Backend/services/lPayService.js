const axios = require('axios');
const { sequelize } = require('../config/db');
const lPayConfig = require('../config/lPayConfig');
const { generateLPaySignature, verifyLPaySignature } = require('../utils/lPaySignature');
const User = require('../models/User');
const WalletRecharge = require('../models/WalletRecharge');
const WalletWithdrawal = require('../models/WalletWithdrawal');
const BankAccount = require('../models/BankAccount');

/**
 * Create a collection (deposit) order with L_pay
 */
const createLPayCollectionOrder = async (userId, orderId, amount, notifyUrl, returnUrl) => {
  const t = await sequelize.transaction();
  try {
    const user = await User.findByPk(userId, { transaction: t });
    if (!user) {
      await t.rollback();
      return { success: false, message: 'User not found' };
    }
    await WalletRecharge.create({
      user_id: userId,
      phone_no: user.phone_no,
      added_amount: amount,
      order_id: orderId,
      payment_gateway: 'LPAY',
      payment_status: false
    }, { transaction: t });
    const datetime = Date.now().toString();
    const requestParams = {
      orderNo: orderId,
      memberCode: lPayConfig.memberCode,
      passageInCode: lPayConfig.defaultCollectionChannel,
      orderAmount: amount.toString(),
      notifyurl: notifyUrl || lPayConfig.notifyUrl,
      callbackurl: returnUrl || lPayConfig.callbackUrl,
      productName: 'Wallet Recharge',
      datetime: datetime,
      attach: `userId:${userId}`
    };
    const signature = generateLPaySignature(requestParams, lPayConfig.secretKey);
    const response = await axios.post(
      `${lPayConfig.baseUrl}${lPayConfig.collectionEndpoint}`,
      requestParams,
      {
        headers: {
          'Content-Type': 'application/json',
          'sign': signature
        }
      }
    );
    if (response.data.code === 1 && response.data.ok === true) {
      await WalletRecharge.update(
        { transaction_id: response.data.data.transactionNo },
        { where: { order_id: orderId }, transaction: t }
      );
      await t.commit();
      return {
        success: true,
        message: 'Payment order created successfully',
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
    return { success: false, message: 'Failed to create payment order', error: error.message };
  }
};

/**
 * Process L_pay collection callback
 */
const processLPayCollectionCallback = async (callbackData) => {
  if (!verifyLPaySignature(callbackData, callbackData.sign, lPayConfig.secretKey)) {
    return { success: false, message: 'Invalid signature' };
  }
  const t = await sequelize.transaction();
  try {
    const rechargeRecord = await WalletRecharge.findOne({
      where: { order_id: callbackData.orderNo },
      transaction: t
    });
    if (!rechargeRecord) {
      await t.rollback();
      return { success: false, message: 'Order not found' };
    }
    if (rechargeRecord.payment_status === true) {
      await t.rollback();
      return { success: true, message: 'Payment already processed' };
    }
    if (callbackData.returncode === '00') {
      await WalletRecharge.update({
        payment_status: true,
        time_of_success: new Date(),
        transaction_id: callbackData.transactionNo
      }, {
        where: { order_id: callbackData.orderNo },
        transaction: t
      });
      const user = await User.findByPk(rechargeRecord.user_id, { transaction: t });
      if (!user) {
        await t.rollback();
        return { success: false, message: 'User not found' };
      }
      const addAmount = parseFloat(callbackData.amount);
      const newBalance = parseFloat(user.wallet_balance) + addAmount;
      await User.update({ wallet_balance: newBalance }, { where: { user_id: rechargeRecord.user_id }, transaction: t });
      await t.commit();
      return { success: true, message: 'Payment processed successfully' };
    } else {
      await WalletRecharge.update({ payment_status: false }, { where: { order_id: callbackData.orderNo }, transaction: t });
      await t.commit();
      return { success: false, message: 'Payment failed or pending' };
    }
  } catch (error) {
    await t.rollback();
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
    await WalletWithdrawal.create({
      user_id: userId,
      withdrawal_amount: amount,
      order_id: orderId,
      payment_gateway: 'LPAY',
      status: false
    }, { transaction: t });
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
    const response = await axios.post(
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
    if (withdrawalRecord.status === true) {
      await t.rollback();
      return { success: true, message: 'Withdrawal already processed' };
    }
    if (callbackData.returncode === '00') {
      await WalletWithdrawal.update({
        status: true,
        time_of_success: new Date(),
        transaction_id: callbackData.transactionNo
      }, {
        where: { order_id: callbackData.orderNo },
        transaction: t
      });
      await t.commit();
      return { success: true, message: 'Withdrawal processed successfully' };
    } else {
      await WalletWithdrawal.update({ status: false }, { where: { order_id: callbackData.orderNo }, transaction: t });
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
    const response = await axios.get(
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
    const response = await axios.get(
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