const axios = require('axios');
const crypto = require('crypto');
const ghPayConfig = require('../config/ghPayConfig');
const { WalletRecharge } = require('../models');
const { WalletWithdrawal } = require('../models');
const User = require('../models/User');

// Utility: Generate GH Pay signature
function generateGhPaySignature(params, secretKey = ghPayConfig.key) {
    // 1. Filter out undefined/null/empty values and 'sign' key
    const filtered = Object.entries(params)
        .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'sign')
        .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
    // 2. Sort keys by ASCII order
    const sortedKeys = Object.keys(filtered).sort();
    // 3. Join as key=value&key=value
    const joined = sortedKeys.map(key => `${key}=${filtered[key]}`).join('&');
    // 4. Append &key=SECRET_KEY
    const stringToSign = `${joined}&key=${secretKey}`;
    // 5. MD5 hash, lowercase
    return crypto.createHash('md5').update(stringToSign).digest('hex').toLowerCase();
}

// Create a deposit order with GH Pay
async function createGhPayDepositOrder(userId, orderId, params, notifyUrl, gatewayId) {
    try {
        // Required fields for GH Pay deposit
        const payload = {
            merchant: ghPayConfig.mchId, // Use configured merchant ID
            paymentType: params.paymentType, // e.g. '1001'
            gold: params.gold, // Amount
            channel: params.channel || 0, // 0: QR, 1: transfer
            notify_url: notifyUrl,
            feeType: params.feeType || 0, // 0: fee from order, 1: fee from merchant
            // Optional: orderId, order_attach, transferAccount, name, phone, bankCode, cert, cardNo, cardSeri, cardType
            ...params.optionalFields // Pass any extra fields as needed
        };
        // Generate signature
        payload.sign = generateGhPaySignature(payload);

        // Call GH Pay API
        const apiUrl = `${ghPayConfig.host}/api/payIn`;
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        // Handle response
        if (response.data && response.data.code === 0 && response.data.data) {
            // Create recharge record in DB (pending)
            await WalletRecharge.create({
                user_id: userId,
                amount: params.gold,
                payment_gateway_id: gatewayId,
                status: 'pending',
                order_id: orderId,
                transaction_id: response.data.data.order_on
            });
            return {
                success: true,
                paymentUrl: response.data.data.payUrl,
                orderId: response.data.data.order_on
            };
        } else {
            return {
                success: false,
                message: response.data ? response.data.message : 'No response from GH Pay',
                errorCode: response.data ? response.data.code : undefined
            };
        }
    } catch (error) {
        return {
            success: false,
            message: error.response && error.response.data ? error.response.data.message : error.message
        };
    }
}

// Process a withdrawal with GH Pay
async function processGhPayWithdrawal(withdrawalId, notifyUrl) {
    try {
        // Find withdrawal record
        const withdrawal = await WalletWithdrawal.findByPk(withdrawalId);
        if (!withdrawal) {
            return { success: false, message: 'Withdrawal not found' };
        }
        // TODO: Add admin approval logic if needed (should be handled in controller/service layer)
        // Build payload according to GH Pay doc
        const payload = {
            merchant: ghPayConfig.mchId,
            paymentType: withdrawal.withdrawal_type || '2001', // Default to withdrawal type code
            gold: withdrawal.amount,
            channel: 0, // 0: QR, 1: transfer (customize as needed)
            notify_url: notifyUrl,
            feeType: 0, // 0: fee from order, 1: fee from merchant (customize as needed)
            transferAccount: withdrawal.account_number, // You may need to join with BankAccount for details
            name: withdrawal.account_holder, // You may need to join with BankAccount for details
            phone: withdrawal.phone, // You may need to join with BankAccount for details
            // Add more fields as needed from your schema
        };
        // Remove undefined/null fields
        Object.keys(payload).forEach(key => (payload[key] === undefined || payload[key] === null) && delete payload[key]);
        // Generate signature
        payload.sign = generateGhPaySignature(payload);
        // Call GH Pay API
        const apiUrl = `${ghPayConfig.host}/api/payOut`;
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        // Handle response
        if (response.data && response.data.code === 0 && response.data.data) {
            // Update withdrawal record in DB (pending)
            await withdrawal.update({
                status: 'pending',
                transaction_id: response.data.data.order_on
            });
            return {
                success: true,
                orderId: response.data.data.order_on
            };
        } else {
            return {
                success: false,
                message: response.data ? response.data.message : 'No response from GH Pay',
                errorCode: response.data ? response.data.code : undefined
            };
        }
    } catch (error) {
        return {
            success: false,
            message: error.response && error.response.data ? error.response.data.message : error.message
        };
    }
}

// Process GH Pay callback (deposit/withdrawal)
async function processGhPayCallback(callbackData) {
    try {
        // 1. Verify signature
        const receivedSign = callbackData.sign;
        const calculatedSign = generateGhPaySignature(callbackData);
        if (receivedSign !== calculatedSign) {
            return { success: false, message: 'Invalid signature' };
        }
        // 2. Extract order details
        const orderId = callbackData.order_no || callbackData.orderId;
        const status = callbackData.orderStatus; // 0: in progress, 1: completed, 2: failed/cancelled
        // 3. Try to find in WalletRecharge (deposit) first
        let order = await WalletRecharge.findOne({ where: { order_id: orderId } });
        let isDeposit = true;
        if (!order) {
            // If not found, try WalletWithdrawal (withdrawal)
            order = await WalletWithdrawal.findOne({ where: { order_id: orderId } });
            isDeposit = false;
        }
        if (!order) {
            return { success: false, message: 'Order not found' };
        }
        // 4. Update order status
        let orderStatus;
        if (status === 1 || status === '1') {
            orderStatus = 'completed';
        } else if (status === 2 || status === '2') {
            orderStatus = 'failed';
        } else {
            orderStatus = 'pending';
        }
        await order.update({ status: orderStatus, updated_at: new Date() });
        // 5. If deposit and completed, update user wallet
        if (isDeposit && orderStatus === 'completed') {
            const user = await User.findByPk(order.user_id);
            if (user) {
                const newBalance = parseFloat(user.wallet_balance) + parseFloat(order.amount);
                const newActualDeposit = parseFloat(user.actual_deposit_amount || 0) + parseFloat(order.amount);
                await user.update({ 
                  wallet_balance: newBalance,
                  actual_deposit_amount: newActualDeposit
                });
                // First recharge bonus logic
                const referralService = require('./referralService');
                if (!user.has_received_first_bonus) {
                  const result = await referralService.processFirstRechargeBonus(user.user_id, parseFloat(order.amount));
                  if (result.success) {
                    const newBonusAmount = parseFloat(user.bonus_amount || 0) + (result.bonusAmount || 0);
                    await user.update({ 
                      has_received_first_bonus: true,
                      bonus_amount: newBonusAmount
                    });
                  }
                }
                // Referral update
                await referralService.updateReferralOnRecharge(user.user_id, parseFloat(order.amount));
            }
        }
        // 6. If withdrawal and completed, you may want to log or notify
        return { success: true, message: 'success' }; // Must return 'success' for GH Pay
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Query order status from GH Pay
async function queryGhPayOrder(orderId) {
    try {
        const payload = {
            merchant: ghPayConfig.mchId,
            order_no: orderId
        };
        payload.sign = generateGhPaySignature(payload);
        const apiUrl = `${ghPayConfig.host}/api/orderQuery`;
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.data && response.data.code === 0 && response.data.data) {
            return {
                success: true,
                data: response.data.data
            };
        } else {
            return {
                success: false,
                message: response.data ? response.data.message : 'No response from GH Pay',
                errorCode: response.data ? response.data.code : undefined
            };
        }
    } catch (error) {
        return {
            success: false,
            message: error.response && error.response.data ? error.response.data.message : error.message
        };
    }
}

module.exports = {
    createGhPayDepositOrder,
    processGhPayWithdrawal,
    processGhPayCallback,
    queryGhPayOrder,
    generateGhPaySignature
}; 
