const axios = require('axios');
const crypto = require('crypto');
const ppayProConfig = require('../config/ppayProConfig');
const { WalletRecharge } = require('../models');
const { WalletWithdrawal } = require('../models');
const User = require('../models/User');

// Utility: Generate PPayPro signature (MD5, uppercase)
function generatePpayProSignature(params, privateKey = ppayProConfig.key) {
    // 1. Filter out undefined/null/empty values and 'sign' key
    const filtered = Object.entries(params)
        .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'sign')
        .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
    // 2. Sort keys by ASCII order
    const sortedKeys = Object.keys(filtered).sort();
    // 3. Join as key=value&key=value
    const joined = sortedKeys.map(key => `${key}=${filtered[key]}`).join('&');
    // 4. Append &key=PRIVATE_KEY
    const stringToSign = `${joined}&key=${privateKey}`;
    // 5. MD5 hash, uppercase
    return crypto.createHash('md5').update(stringToSign).digest('hex').toUpperCase();
}

// Create a deposit order with PPayPro
async function createPpayProDepositOrder(userId, orderId, params, notifyUrl, gatewayId) {
    try {
        // Required fields for PPayPro deposit
        const payload = {
            mchNo: ppayProConfig.mchNo,
            appId: ppayProConfig.appId,
            mchOrderNo: orderId,
            amount: params.amount, // Integer, smallest unit
            customerName: params.customerName,
            customerEmail: params.customerEmail,
            customerPhone: params.customerPhone,
            // Optional fields
            wayCode: params.wayCode,
            extParam: params.extParam,
            notifyUrl: notifyUrl,
            returnUrl: params.returnUrl
        };
        // Remove undefined/null fields
        Object.keys(payload).forEach(key => (payload[key] === undefined || payload[key] === null) && delete payload[key]);
        // Generate signature
        payload.sign = generatePpayProSignature(payload);
        // Call PPayPro API
        const apiUrl = `${ppayProConfig.host}/api/pay/pay`;
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        // Handle response
        if (response.data && response.data.code === 0 && response.data.data) {
            // Create recharge record in DB (pending)
            await WalletRecharge.create({
                user_id: userId,
                amount: params.amount,
                payment_gateway_id: gatewayId,
                status: 'pending',
                order_id: orderId,
                transaction_id: response.data.data.payOrderId
            });
            return {
                success: true,
                paymentUrl: response.data.data.payData, // payDataType may indicate type
                orderId: response.data.data.payOrderId
            };
        } else {
            return {
                success: false,
                message: response.data ? response.data.msg : 'No response from PPayPro',
                errorCode: response.data ? response.data.code : undefined
            };
        }
    } catch (error) {
        return {
            success: false,
            message: error.response && error.response.data ? error.response.data.msg : error.message
        };
    }
}

// Process PPayPro deposit callback
async function processPpayProDepositCallback(callbackData) {
    try {
        // 1. Verify signature
        const receivedSign = callbackData.sign;
        const calculatedSign = generatePpayProSignature(callbackData);
        if (receivedSign !== calculatedSign) {
            return { success: false, message: 'Invalid signature' };
        }
        // 2. Extract order details
        const orderId = callbackData.mchOrderNo;
        const state = callbackData.state; // 2: Success, 3: Failed
        // 3. Find WalletRecharge (deposit)
        let order = await WalletRecharge.findOne({ where: { order_id: orderId } });
        if (!order) {
            return { success: false, message: 'Order not found' };
        }
        // 4. Update order status
        let orderStatus;
        if (state === 2 || state === '2') {
            orderStatus = 'completed';
        } else if (state === 3 || state === '3') {
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
        return { success: true, message: 'success' }; // Must return 'success' for PPayPro
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Query deposit order status from PPayPro
async function queryPpayProDepositOrder(orderId, payOrderId) {
    try {
        const payload = {
            mchNo: ppayProConfig.mchNo,
            appId: ppayProConfig.appId,
            mchOrderNo: orderId,
            payOrderId: payOrderId
        };
        payload.sign = generatePpayProSignature(payload);
        const apiUrl = `${ppayProConfig.host}/api/pay/query`;
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
                message: response.data ? response.data.msg : 'No response from PPayPro',
                errorCode: response.data ? response.data.code : undefined
            };
        }
    } catch (error) {
        return {
            success: false,
            message: error.response && error.response.data ? error.response.data.msg : error.message
        };
    }
}

// Create a withdrawal order with PPayPro
async function createPpayProWithdrawalOrder(userId, orderId, params, notifyUrl, gatewayId) {
    try {
        // Required fields for PPayPro withdrawal
        const payload = {
            mchNo: ppayProConfig.mchNo,
            appId: ppayProConfig.appId,
            mchOrderNo: orderId,
            amount: params.amount, // Integer, smallest unit
            entryType: params.entryType, // e.g., 'IMPS', 'UPI', etc.
            accountNo: params.accountNo, // Beneficiary's account number/UPI ID
            accountCode: params.accountCode, // IFSC, CPF, etc.
            accountName: params.accountName, // Beneficiary's name
            accountEmail: params.accountEmail, // Beneficiary's email
            accountPhone: params.accountPhone, // Beneficiary's phone
            // Optional fields
            bankName: params.bankName,
            channelExtra: params.channelExtra,
            notifyUrl: notifyUrl
        };
        // Remove undefined/null fields
        Object.keys(payload).forEach(key => (payload[key] === undefined || payload[key] === null) && delete payload[key]);
        // Generate signature
        payload.sign = generatePpayProSignature(payload);
        // Call PPayPro API
        const apiUrl = `${ppayProConfig.host}/api/payout/pay`;
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        // Handle response
        if (response.data && response.data.code === 0 && response.data.data) {
            // Create withdrawal record in DB (pending)
            await WalletWithdrawal.create({
                user_id: userId,
                amount: params.amount,
                payment_gateway_id: gatewayId,
                status: 'pending',
                order_id: orderId,
                transaction_id: response.data.data.transferId
            });
            return {
                success: true,
                orderId: response.data.data.transferId
            };
        } else {
            return {
                success: false,
                message: response.data ? response.data.msg : 'No response from PPayPro',
                errorCode: response.data ? response.data.code : undefined
            };
        }
    } catch (error) {
        return {
            success: false,
            message: error.response && error.response.data ? error.response.data.msg : error.message
        };
    }
}

// Process PPayPro withdrawal callback
async function processPpayProWithdrawalCallback(callbackData) {
    try {
        // 1. Verify signature
        const receivedSign = callbackData.sign;
        const calculatedSign = generatePpayProSignature(callbackData);
        if (receivedSign !== calculatedSign) {
            return { success: false, message: 'Invalid signature' };
        }
        // 2. Extract order details
        const orderId = callbackData.mchOrderNo;
        const state = callbackData.state; // 2: Success, 3: Failed
        // 3. Find WalletWithdrawal
        let order = await WalletWithdrawal.findOne({ where: { order_id: orderId } });
        if (!order) {
            return { success: false, message: 'Order not found' };
        }
        // 4. Update order status
        let orderStatus;
        if (state === 2 || state === '2') {
            orderStatus = 'completed';
        } else if (state === 3 || state === '3') {
            orderStatus = 'failed';
        } else {
            orderStatus = 'pending';
        }
        await order.update({ status: orderStatus, updated_at: new Date() });
        return { success: true, message: 'success' }; // Must return 'success' for PPayPro
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Query withdrawal order status from PPayPro
async function queryPpayProWithdrawalOrder(orderId, transferId) {
    try {
        const payload = {
            mchNo: ppayProConfig.mchNo,
            appId: ppayProConfig.appId,
            mchOrderNo: orderId,
            transferId: transferId
        };
        payload.sign = generatePpayProSignature(payload);
        const apiUrl = `${ppayProConfig.host}/api/payout/query`;
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
                message: response.data ? response.data.msg : 'No response from PPayPro',
                errorCode: response.data ? response.data.code : undefined
            };
        }
    } catch (error) {
        return {
            success: false,
            message: error.response && error.response.data ? error.response.data.msg : error.message
        };
    }
}

// Query balance from PPayPro
async function queryPpayProBalance() {
    // Implementation will follow doc
}

module.exports = {
    generatePpayProSignature,
    createPpayProDepositOrder,
    processPpayProDepositCallback,
    queryPpayProDepositOrder,
    createPpayProWithdrawalOrder,
    processPpayProWithdrawalCallback,
    queryPpayProWithdrawalOrder,
    queryPpayProBalance
}; 