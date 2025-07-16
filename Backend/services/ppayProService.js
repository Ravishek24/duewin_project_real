const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const ppayProConfig = require('../config/ppayProConfig');
const { WalletRecharge } = require('../models');
const { WalletWithdrawal } = require('../models');
const User = require('../models/User');

// Utility: Write deposit order logs to a file
function logDepositOrder(data) {
    const logDir = path.join(__dirname, '../logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);
    const logFile = path.join(logDir, 'ppaypro-deposit-orders.log');
    const logEntry = `\n[${new Date().toISOString()}] PPayPro Deposit Order Created\n${JSON.stringify(data, null, 2)}\n`;
    fs.appendFileSync(logFile, logEntry);
    console.log(logEntry); // Also log to console
}

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
        console.log('\n🚀 Creating PPayPro Deposit Order...');
        console.log('='.repeat(60));
        
        // Convert amount from rupees to paisa (integer)
        let amountRupees = typeof params.amount === 'string' ? parseFloat(params.amount) : params.amount;
        if (isNaN(amountRupees)) {
            return {
                success: false,
                message: 'Invalid amount provided. Amount must be a number in rupees.'
            };
        }
        const amountPaisa = Math.round(amountRupees * 100);
        
        console.log('📊 Order Details:');
        console.log(`  - User ID: ${userId}`);
        console.log(`  - Order ID: ${orderId}`);
        console.log(`  - Amount (Rupees): ${amountRupees}`);
        console.log(`  - Amount (Paisa): ${amountPaisa}`);
        console.log(`  - Gateway ID: ${gatewayId}`);
        console.log(`  - Notify URL: ${notifyUrl}`);
        
        // Required fields for PPayPro deposit
        const payload = {
            mchNo: ppayProConfig.mchNo,
            appId: ppayProConfig.appId,
            mchOrderNo: orderId,
            amount: amountPaisa, // Integer, paisa
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
        
        console.log('\n📤 PPayPro Request Payload:');
        console.log(JSON.stringify(payload, null, 2));
        
        // Generate signature
        payload.sign = generatePpayProSignature(payload);
        console.log(`\n🔐 Generated Signature: ${payload.sign}`);
        
        // Call PPayPro API
        const apiUrl = `${ppayProConfig.host}/api/pay/pay`;
        console.log(`\n🌐 Calling PPayPro API: ${apiUrl}`);
        
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('\n📥 PPayPro API Response:');
        console.log(JSON.stringify(response.data, null, 2));
        
        // Handle response
        if (response.data && response.data.code === 0 && response.data.data) {
            const payOrderId = response.data.data.payOrderId;
            const paymentUrl = response.data.data.payData;
            
            console.log('\n✅ Order Created Successfully!');
            console.log('='.repeat(60));
            console.log(`🎯 PPayPro Order ID: ${payOrderId}`);
            console.log(`🔗 Payment URL: ${paymentUrl}`);
            
            // Create recharge record in DB (pending)
            await WalletRecharge.create({
                user_id: userId,
                amount: amountRupees, // Store rupees in DB for consistency
                payment_gateway_id: gatewayId,
                status: 'pending',
                order_id: orderId,
                transaction_id: payOrderId
            });
            
            console.log('💾 Database record created successfully');
            
            // Prepare callback details for logging
            const callbackDetails = {
                timestamp: new Date().toISOString(),
                orderInfo: {
                    userId: userId,
                    orderId: orderId,
                    payOrderId: payOrderId,
                    amountRupees: amountRupees,
                    amountPaisa: amountPaisa,
                    gatewayId: gatewayId
                },
                ppayProRequest: {
                    apiUrl: apiUrl,
                    payload: payload,
                    signature: payload.sign
                },
                ppayProResponse: {
                    payOrderId: payOrderId,
                    paymentUrl: paymentUrl,
                    fullResponse: response.data
                },
                callbackInfo: {
                    callbackUrl: notifyUrl,
                    expectedCallbackData: {
                        payOrderId: payOrderId,
                        mchOrderNo: orderId,
                        amount: amountPaisa.toString(),
                        state: '2', // Will be 2 for success, 3 for failure
                        currency: 'INR',
                        createdAt: Date.now(),
                        successTime: Date.now()
                    }
                }
            };
            
            // Generate expected callback signature
            const expectedCallbackSignature = generatePpayProSignature(callbackDetails.callbackInfo.expectedCallbackData);
            callbackDetails.callbackInfo.expectedCallbackData.sign = expectedCallbackSignature;
            
            console.log('\n📋 CALLBACK DETAILS FOR TESTING:');
            console.log('='.repeat(60));
            console.log('🔗 Callback URL:', callbackDetails.callbackInfo.callbackUrl);
            console.log('📤 Expected Callback Payload:');
            console.log(JSON.stringify(callbackDetails.callbackInfo.expectedCallbackData, null, 2));
            console.log('🔐 Expected Callback Signature:', expectedCallbackSignature);
            
            console.log('\n📝 cURL Command for Testing:');
            const curlCommand = `curl -X POST "${callbackDetails.callbackInfo.callbackUrl}" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "payOrderId=${payOrderId}&mchOrderNo=${orderId}&amount=${amountPaisa}&state=2&currency=INR&createdAt=${Date.now()}&successTime=${Date.now()}&sign=${expectedCallbackSignature}"`;
            console.log(curlCommand);
            
            console.log('\n📝 Postman Body (x-www-form-urlencoded):');
            console.log(`payOrderId=${payOrderId}`);
            console.log(`mchOrderNo=${orderId}`);
            console.log(`amount=${amountPaisa}`);
            console.log(`state=2`);
            console.log(`currency=INR`);
            console.log(`createdAt=${Date.now()}`);
            console.log(`successTime=${Date.now()}`);
            console.log(`sign=${expectedCallbackSignature}`);
            
            // Log all details to file
            logDepositOrder(callbackDetails);
            
            console.log('\n✅ Deposit order creation completed!');
            console.log('📄 Full details logged to: logs/ppaypro-deposit-orders.log');
            console.log('='.repeat(60));
            
            return {
                success: true,
                paymentUrl: paymentUrl,
                orderId: payOrderId
            };
        } else {
            console.log('\n❌ PPayPro API Error:');
            console.log(response.data);
            return {
                success: false,
                message: response.data ? response.data.msg : 'No response from PPayPro',
                errorCode: response.data ? response.data.code : undefined
            };
        }
    } catch (error) {
        console.log('\n❌ Error creating PPayPro deposit order:');
        console.log(error.response?.data || error.message);
        return {
            success: false,
            message: error.response && error.response.data ? error.response.data.msg : error.message
        };
    }
}

// Process PPayPro deposit callback
async function processPpayProDepositCallback(callbackData) {
    try {
        // Log all received callback data for deposit
        console.log('[PPAYPRO][Deposit Callback] Received Data:', JSON.stringify(callbackData, null, 2));
        // 1. Verify signature
        const receivedSign = callbackData.sign;
        const calculatedSign = generatePpayProSignature(callbackData);
        console.log('[PPAYPRO][Deposit Callback] Calculated Signature:', calculatedSign);
        if (receivedSign !== calculatedSign) {
            console.log('[PPAYPRO][Deposit Callback] Signature mismatch!');
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
        // Convert amount from rupees to paisa (integer)
        let amountRupees = typeof params.amount === 'string' ? parseFloat(params.amount) : params.amount;
        if (isNaN(amountRupees)) {
            return {
                success: false,
                message: 'Invalid amount provided. Amount must be a number in rupees.'
            };
        }
        const amountPaisa = Math.round(amountRupees * 100);
        // Required fields for PPayPro withdrawal
        const payload = {
            mchNo: ppayProConfig.mchNo,
            appId: ppayProConfig.appId,
            mchOrderNo: orderId,
            amount: amountPaisa, // Integer, paisa
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
                amount: amountRupees, // Store rupees in DB for consistency
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
        // Log all received callback data for withdrawal
        console.log('[PPAYPRO][Withdrawal Callback] Received Data:', JSON.stringify(callbackData, null, 2));
        // 1. Verify signature
        const receivedSign = callbackData.sign;
        const calculatedSign = generatePpayProSignature(callbackData);
        console.log('[PPAYPRO][Withdrawal Callback] Calculated Signature:', calculatedSign);
        if (receivedSign !== calculatedSign) {
            console.log('[PPAYPRO][Withdrawal Callback] Signature mismatch!');
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