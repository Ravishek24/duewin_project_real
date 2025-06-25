const axios = require('axios');
const crypto = require('crypto');
const wowPayConfig = require('../config/wowPayConfig');
const { WalletRecharge } = require('../models');
const { WalletWithdrawal } = require('../models');
const User = require('../models/User');

// Utility: Generate WOWPAY signature (MD5 or MD5withRsa)
function generateWowPaySignature(params, secretKey = wowPayConfig.key, signType = wowPayConfig.signType) {
    // Only MD5 for now (RSA can be added if needed)
    if (signType === 'MD5') {
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
        // 5. MD5 hash, uppercase
        return crypto.createHash('md5').update(stringToSign).digest('hex').toUpperCase();
    }
    // TODO: Add MD5withRsa if needed
    throw new Error('Only MD5 signature is implemented');
}

// Create a deposit order with WOWPAY
async function createWowPayDepositOrder(userId, orderId, params, notifyUrl, gatewayId) {
    try {
        // Required fields for WOWPAY deposit
        const payload = {
            merchant_no: wowPayConfig.mchId,
            out_trade_sn: orderId,
            amount: params.amount, // Must be string, two decimals
            notify_url: notifyUrl,
            sign_type: wowPayConfig.signType,
            // Optional fields
            title: params.title,
            user_name: params.user_name,
            bank_card_no: params.bank_card_no,
            attach: params.attach,
            return_url: params.return_url
        };
        // Remove undefined/null fields
        Object.keys(payload).forEach(key => (payload[key] === undefined || payload[key] === null) && delete payload[key]);
        // Generate signature
        payload.sign = generateWowPaySignature(payload);
        // Call WOWPAY API
        const apiUrl = `${wowPayConfig.host}/gw-api/deposit/create`;
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        // Handle response
        if (response.data && response.data.code === '100' && response.data.data) {
            // Create recharge record in DB (pending)
            await WalletRecharge.create({
                user_id: userId,
                amount: params.amount,
                payment_gateway_id: gatewayId,
                status: 'pending',
                order_id: orderId,
                transaction_id: response.data.data.order_sn
            });
            return {
                success: true,
                paymentUrl: response.data.data.trade_url,
                orderId: response.data.data.order_sn
            };
        } else {
            return {
                success: false,
                message: response.data ? response.data.message : 'No response from WOWPAY',
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

// Process WOWPAY deposit callback
async function processWowPayDepositCallback(callbackData) {
    try {
        // 1. Verify signature
        const receivedSign = callbackData.sign;
        const calculatedSign = generateWowPaySignature(callbackData);
        if (receivedSign !== calculatedSign) {
            return { success: false, message: 'Invalid signature' };
        }
        // 2. Extract order details
        const orderId = callbackData.out_trade_sn;
        const status = callbackData.trade_status; // 'pending', 'success', 'timeout', 'failed'
        // 3. Find WalletRecharge (deposit)
        let order = await WalletRecharge.findOne({ where: { order_id: orderId } });
        if (!order) {
            return { success: false, message: 'Order not found' };
        }
        // 4. Update order status
        let orderStatus;
        if (status === 'success') {
            orderStatus = 'completed';
        } else if (status === 'failed' || status === 'timeout') {
            orderStatus = 'failed';
        } else {
            orderStatus = 'pending';
        }
        await order.update({ status: orderStatus, updated_at: new Date() });
        // 5. If completed, update user wallet
        if (orderStatus === 'completed') {
            const user = await User.findByPk(order.user_id);
            if (user) {
                const newBalance = parseFloat(user.wallet_balance) + parseFloat(order.amount);
                await user.update({ wallet_balance: newBalance });
            }
        }
        return { success: true, message: 'success' }; // Must return 'success' for WOWPAY
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Query deposit order status from WOWPAY
async function queryWowPayDepositOrder(orderId, systemOrderId) {
    try {
        const payload = {
            merchant_no: wowPayConfig.mchId,
            out_trade_sn: orderId,
            order_sn: systemOrderId,
            sign_type: wowPayConfig.signType
        };
        payload.sign = generateWowPaySignature(payload);
        const apiUrl = `${wowPayConfig.host}/gw-api/deposit/query`;
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.data && response.data.code === '100' && response.data.data) {
            return {
                success: true,
                data: response.data.data
            };
        } else {
            return {
                success: false,
                message: response.data ? response.data.message : 'No response from WOWPAY',
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

// Create a withdrawal order with WOWPAY
async function createWowPayWithdrawalOrder(userId, orderId, params, notifyUrl, gatewayId) {
    try {
        // Required fields for WOWPAY withdrawal
        const payload = {
            merchant_no: wowPayConfig.mchId,
            out_trade_sn: orderId,
            amount: params.amount, // Must be string, two decimals
            trade_account: params.trade_account, // Beneficiary's account name
            trade_number: params.trade_number,   // Beneficiary's bank card/account number
            notify_url: notifyUrl,
            sign_type: wowPayConfig.signType,
            // Optional fields
            attach: params.attach,
            pix: params.pix,
            pix_type: params.pix_type,
            ifsc: params.ifsc,
            bank_code: params.bank_code,
            mobile: params.mobile,
            email: params.email,
            identity: params.identity
        };
        // Remove undefined/null fields
        Object.keys(payload).forEach(key => (payload[key] === undefined || payload[key] === null) && delete payload[key]);
        // Generate signature
        payload.sign = generateWowPaySignature(payload);
        // Call WOWPAY API
        const apiUrl = `${wowPayConfig.host}/gw-api/payout/create`;
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        // Handle response
        if (response.data && response.data.code === '100' && response.data.data) {
            // Create withdrawal record in DB (pending)
            await WalletWithdrawal.create({
                user_id: userId,
                amount: params.amount,
                payment_gateway_id: gatewayId,
                status: 'pending',
                order_id: orderId,
                transaction_id: response.data.data.order_sn
            });
            return {
                success: true,
                orderId: response.data.data.order_sn
            };
        } else {
            return {
                success: false,
                message: response.data ? response.data.message : 'No response from WOWPAY',
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

// Process WOWPAY withdrawal callback
async function processWowPayWithdrawalCallback(callbackData) {
    try {
        // 1. Verify signature
        const receivedSign = callbackData.sign;
        const calculatedSign = generateWowPaySignature(callbackData);
        if (receivedSign !== calculatedSign) {
            return { success: false, message: 'Invalid signature' };
        }
        // 2. Extract order details
        const orderId = callbackData.out_trade_sn;
        const status = callbackData.trade_status; // 'pending', 'success', 'rejected', 'failed'
        // 3. Find WalletWithdrawal
        let order = await WalletWithdrawal.findOne({ where: { order_id: orderId } });
        if (!order) {
            return { success: false, message: 'Order not found' };
        }
        // 4. Update order status
        let orderStatus;
        if (status === 'success') {
            orderStatus = 'completed';
        } else if (status === 'failed' || status === 'rejected') {
            orderStatus = 'failed';
        } else {
            orderStatus = 'pending';
        }
        await order.update({ status: orderStatus, updated_at: new Date() });
        return { success: true, message: 'success' }; // Must return 'success' for WOWPAY
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Query withdrawal order status from WOWPAY
async function queryWowPayWithdrawalOrder(orderId, systemOrderId) {
    try {
        const payload = {
            merchant_no: wowPayConfig.mchId,
            out_trade_sn: orderId,
            order_sn: systemOrderId,
            sign_type: wowPayConfig.signType
        };
        payload.sign = generateWowPaySignature(payload);
        const apiUrl = `${wowPayConfig.host}/gw-api/payout/query`;
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.data && response.data.code === '100' && response.data.data) {
            return {
                success: true,
                data: response.data.data
            };
        } else {
            return {
                success: false,
                message: response.data ? response.data.message : 'No response from WOWPAY',
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

// Query bank codes from WOWPAY
async function queryWowPayBankCodes() {
    // Implementation will follow doc
}

// Query balance from WOWPAY
async function queryWowPayBalance() {
    // Implementation will follow doc
}

// Query order by UTR from WOWPAY
async function queryWowPayUtr(utr) {
    // Implementation will follow doc
}

// Confirm order by UTR from WOWPAY
async function confirmWowPayUtr(utr, orderId, systemOrderId) {
    // Implementation will follow doc
}

module.exports = {
    generateWowPaySignature,
    createWowPayDepositOrder,
    processWowPayDepositCallback,
    queryWowPayDepositOrder,
    createWowPayWithdrawalOrder,
    processWowPayWithdrawalCallback,
    queryWowPayWithdrawalOrder,
    queryWowPayBankCodes,
    queryWowPayBalance,
    queryWowPayUtr,
    confirmWowPayUtr
}; 