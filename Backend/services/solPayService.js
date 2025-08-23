const axios = require('axios');
const crypto = require('crypto');
const solPayConfig = require('../config/solPayConfig');
const { WalletRecharge } = require('../models');
const { WalletWithdrawal } = require('../models');
const User = require('../models/User');
const AttendanceRecord = require('../models/AttendanceRecord');
const Transaction = require('../models/Transaction');
const moment = require('moment-timezone');

// Utility: Generate SOLPAY RSA signature
function generateSolPaySignature(params, privateKey = solPayConfig.privateKey) {
    try {
        // 1. Exclude 'sign' key if present
        const filtered = Object.entries(params)
            .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'sign')
            .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
        // 2. Sort keys by ASCII order
        const sortedKeys = Object.keys(filtered).sort();
        // 3. Concatenate values (not keys)
        const strX = sortedKeys.map(key => String(filtered[key])).join('');
        // 4. Sign with RSA private key (PKCS#8, base64 or PEM)
        const signer = crypto.createSign('RSA-SHA1');
        signer.update(strX, 'utf8');
        signer.end();
        
        // Check if private key is valid
        if (!privateKey || privateKey.length < 100) {
            throw new Error('Invalid or incomplete private key provided');
        }
        
        // If key is base64, convert to PEM
        let key = privateKey;
        if (!privateKey.includes('BEGIN')) {
            key = '-----BEGIN PRIVATE KEY-----\n' + privateKey + '\n-----END PRIVATE KEY-----';
        }
        
        return signer.sign(key, 'base64');
    } catch (error) {
        console.error('Error generating SolPay signature:', error.message);
        // Return a placeholder signature for testing (this will fail verification but won't crash)
        return 'INVALID_KEY_SIGNATURE_PLACEHOLDER';
    }
}

// Utility: Verify SOLPAY RSA signature
function verifySolPaySignature(params, signature, publicKey = solPayConfig.platformPublicKey) {
    // 1. Exclude 'platSign' key if present
    const filtered = Object.entries(params)
        .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'platSign')
        .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
    // 2. Sort keys by ASCII order
    const sortedKeys = Object.keys(filtered).sort();
    // 3. Concatenate values (not keys)
    const strX = sortedKeys.map(key => String(filtered[key])).join('');
    // 4. Verify with RSA public key (PKCS#8, base64 or PEM)
    const verifier = crypto.createVerify('RSA-SHA1');
    verifier.update(strX, 'utf8');
    verifier.end();
    // If key is base64, convert to PEM
    let key = publicKey;
    if (!publicKey.includes('BEGIN')) {
        key = '-----BEGIN PUBLIC KEY-----\n' + publicKey + '\n-----END PUBLIC KEY-----';
    }
    return verifier.verify(key, signature, 'base64');
}

// Create a deposit order with SOLPAY
async function createSolPayDepositOrder(userId, orderId, params, notifyUrl, gatewayId) {
    try {
        // Check if private key is valid
        if (!solPayConfig.privateKey || solPayConfig.privateKey.length < 100) {
            return {
                success: false,
                message: 'SolPay private key is invalid or not configured. Please contact support for the correct RSA private key.',
                errorCode: 'INVALID_PRIVATE_KEY'
            };
        }
        
        // Build payload per SOLPAY doc
        const payload = {
            merchantCode: solPayConfig.merchantCode,
            orderNum: orderId,
            payMoney: params.amount, // String, two decimals
            productDetail: params.productDetail || 'Deposit',
            name: params.name || 'User',
            email: params.email,
            phone: params.phone,
            notifyUrl: notifyUrl,
            redirectUrl: params.redirectUrl || params.returnUrl || '',
            expiryPeriod: params.expiryPeriod || '1440',
        };
        // Generate signature
        payload.sign = generateSolPaySignature(payload);
        
        // Check if signature generation failed
        if (payload.sign === 'INVALID_KEY_SIGNATURE_PLACEHOLDER') {
            return {
                success: false,
                message: 'Failed to generate SolPay signature due to invalid private key',
                errorCode: 'SIGNATURE_FAILED'
            };
        }
        
        // Call SOLPAY API
        const apiUrl = `${solPayConfig.host}/gateway/v1/INR/pay`;
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        const data = response.data;
        // Verify platform signature
        if (!verifySolPaySignature(data, data.platSign)) {
            return { success: false, message: 'Invalid platform signature' };
        }
        // Handle response
        if (data.platRespCode === 'SUCCESS' && data.url) {
            // Create recharge record in DB (pending)
            await WalletRecharge.create({
                user_id: userId,
                amount: params.amount,
                payment_gateway_id: gatewayId,
                status: 'pending',
                order_id: orderId,
                transaction_id: data.platOrderNum
            });
            return {
                success: true,
                paymentUrl: data.url,
                orderId: data.platOrderNum
            };
        } else {
            return {
                success: false,
                message: data.msg || 'SOLPAY error',
                errorCode: data.platRespCode
            };
        }
    } catch (error) {
        return {
            success: false,
            message: error.response && error.response.data ? error.response.data.msg : error.message
        };
    }
}

// Process SOLPAY deposit callback
async function processSolPayDepositCallback(callbackData) {
    try {
        // 1. Verify platform signature
        const receivedSign = callbackData.platSign;
        if (!verifySolPaySignature(callbackData, receivedSign)) {
            return { success: false, message: 'Invalid platform signature' };
        }
        // 2. Extract order details
        const orderId = callbackData.orderNum;
        const status = callbackData.status; // 'SUCCESS', 'INIT_ORDER', etc.
        // 3. Find WalletRecharge (deposit)
        let order = await WalletRecharge.findOne({ where: { order_id: orderId } });
        if (!order) {
            return { success: false, message: 'Order not found' };
        }
        // 4. Update order status
        let orderStatus;
        if (status === 'SUCCESS') {
            orderStatus = 'completed';
        } else if (['PAY_CANCEL', 'PAY_ERROR'].includes(status)) {
            orderStatus = 'failed';
        } else {
            orderStatus = 'pending';
        }
        await order.update({ status: orderStatus, updated_at: new Date() });

        // Create transaction record for both success and failure
        if (Transaction && typeof Transaction.create === 'function') {
            await Transaction.create({
                user_id: order.user_id,
                type: orderStatus === 'completed' ? 'deposit' : 'deposit_failed',
                amount: parseFloat(order.amount),
                status: orderStatus === 'completed' ? 'completed' : 'failed',
                payment_gateway_id: order.payment_gateway_id,
                order_id: order.order_id,
                transaction_id: order.transaction_id,
                description: orderStatus === 'completed' ? 'SOLPAY deposit successful' : 'SOLPAY deposit failed',
                reference_id: orderStatus === 'completed' ? `solpay_deposit_${order.order_id}` : `solpay_deposit_failed_${order.order_id}`,
                metadata: {
                    gateway: 'SOLPAY',
                    original_status: status,
                    processed_at: new Date().toISOString()
                },
                created_at: new Date(),
                updated_at: new Date()
            });
            console.log(`✅ Transaction record created for SOLPAY ${orderStatus === 'completed' ? 'deposit' : 'deposit_failed'}`);
        }
        // 5. If completed, update user wallet
        if (orderStatus === 'completed') {
            const user = await User.findByPk(order.user_id);
            if (user) {
                const newBalance = parseFloat(user.wallet_balance) + parseFloat(order.amount);
                const newActualDeposit = parseFloat(user.actual_deposit_amount || 0) + parseFloat(order.amount);
                await user.update({ 
                  wallet_balance: newBalance,
                  actual_deposit_amount: newActualDeposit
                });
                
                // Transaction record already created above for both success and failure
                
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
                // --- Attendance update logic ---
                const amount = parseFloat(order.amount);
                const todayIST = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
                const [attendance, created] = await AttendanceRecord.findOrCreate({
                  where: { user_id: user.user_id, attendance_date: todayIST },
                  defaults: {
                    user_id: user.user_id,
                    attendance_date: todayIST,
                    date: todayIST,
                    streak_count: 1,
                    has_recharged: true,
                    recharge_amount: amount,
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
                    recharge_amount: (parseFloat(attendance.recharge_amount) || 0) + amount,
                    claim_eligible: true,
                    updated_at: new Date()
                  });
                }
                // --- End Attendance update logic ---
            }
        }
        // 6. Return 'SUCCESS' for SOLPAY
        return { success: true, message: 'SUCCESS' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Query deposit order status from SOLPAY
async function querySolPayDepositOrder(platOrderNum) {
    try {
        const payload = {
            merchantCode: solPayConfig.merchantCode,
            platOrderNum: platOrderNum,
            queryType: 'ORDER_QUERY',
        };
        payload.sign = generateSolPaySignature(payload);
        const apiUrl = `${solPayConfig.host}/gateway/v1/query`;
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        const data = response.data;
        if (!verifySolPaySignature(data, data.platSign)) {
            return { success: false, message: 'Invalid platform signature' };
        }
        return data;
    } catch (error) {
        return { success: false, message: error.response && error.response.data ? error.response.data.msg : error.message };
    }
}

// Create a withdrawal order with SOLPAY
async function createSolPayWithdrawalOrder(userId, orderId, params, notifyUrl, gatewayId) {
    try {
        // Build payload per SOLPAY doc
        const payload = {
            merchantCode: solPayConfig.merchantCode,
            orderNum: orderId,
            money: params.amount, // String, two decimals
            description: params.description || 'Withdrawal',
            name: params.name,
            bankName: params.bankName,
            bankAccount: params.bankAccount,
            ifscCode: params.ifscCode,
            notifyUrl: notifyUrl,
            email: params.email,
            phone: params.phone,
            feeType: params.feeType || '0',
        };
        // Generate signature
        payload.sign = generateSolPaySignature(payload);
        // Call SOLPAY API
        const apiUrl = `${solPayConfig.host}/gateway/v1/INR/cash`;
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        const data = response.data;
        // Verify platform signature
        if (!verifySolPaySignature(data, data.platSign)) {
            return { success: false, message: 'Invalid platform signature' };
        }
        // Handle response
        if (data.platRespCode === 'SUCCESS' && data.platOrderNum) {
            // Create withdrawal record in DB (pending)
            await WalletWithdrawal.create({
                user_id: userId,
                amount: params.amount,
                payment_gateway_id: gatewayId,
                status: 'pending',
                order_id: orderId,
                transaction_id: data.platOrderNum
            });
            return {
                success: true,
                orderId: data.platOrderNum
            };
        } else {
            return {
                success: false,
                message: data.msg || 'SOLPAY error',
                errorCode: data.platRespCode
            };
        }
    } catch (error) {
        return {
            success: false,
            message: error.response && error.response.data ? error.response.data.msg : error.message
        };
    }
}

// Process SOLPAY withdrawal callback
async function processSolPayWithdrawalCallback(callbackData) {
    try {
        // 1. Verify platform signature
        const receivedSign = callbackData.platSign;
        if (!verifySolPaySignature(callbackData, receivedSign)) {
            return { success: false, message: 'Invalid platform signature' };
        }
        // 2. Extract order details
        const orderId = callbackData.orderNum;
        const status = callbackData.status; // '2' = success, '3'/'4' = failed
        // 3. Find WalletWithdrawal
        let order = await WalletWithdrawal.findOne({ where: { order_id: orderId } });
        if (!order) {
            return { success: false, message: 'Order not found' };
        }
        // 4. Update order status
        let orderStatus;
        if (status === '2') {
            orderStatus = 'completed';
        } else if (['3', '4'].includes(status)) {
            orderStatus = 'failed';
        } else {
            orderStatus = 'pending';
        }
        await order.update({ status: orderStatus, updated_at: new Date() });
        
        // ✅ Handle withdrawal success/failure with proper refunds
        if (orderStatus === 'completed') {
            // SUCCESS: Create withdrawal success transaction
            await Transaction.create({
                user_id: order.user_id,
                type: 'withdrawal',
                amount: parseFloat(order.amount),
                status: 'completed',
                payment_gateway_id: order.payment_gateway_id,
                order_id: order.order_id,
                transaction_id: order.transaction_id,
                description: 'SOLPAY withdrawal successful',
                reference_id: `solpay_withdrawal_${order.order_id}`,
                metadata: {
                    gateway: 'SOLPAY',
                    original_status: status,
                    processed_at: new Date().toISOString()
                },
                created_at: new Date(),
                updated_at: new Date()
            });
            console.log(`✅ SOLPAY withdrawal completed successfully`);
        } else if (orderStatus === 'failed') {
            // FAILURE: Refund money to user wallet and create failed transaction
            const User = require('../models/User');
            const user = await User.findByPk(order.user_id);
            if (user) {
                const currentBalance = parseFloat(user.wallet_balance) || 0;
                const refundAmount = parseFloat(order.amount);
                const newBalance = currentBalance + refundAmount;
                
                await user.update({ wallet_balance: newBalance });
                
                // Create withdrawal failed transaction
                await Transaction.create({
                    user_id: order.user_id,
                    type: 'withdrawal_failed',
                    amount: refundAmount,
                    status: 'failed',
                    payment_gateway_id: order.payment_gateway_id,
                    order_id: order.order_id,
                    transaction_id: order.transaction_id,
                    description: 'SOLPAY withdrawal failed - amount refunded',
                    reference_id: `solpay_withdrawal_failed_${order.order_id}`,
                    metadata: {
                        gateway: 'SOLPAY',
                        original_status: status,
                        refunded_amount: refundAmount,
                        original_balance: currentBalance,
                        new_balance: newBalance,
                        processed_at: new Date().toISOString()
                    },
                    created_at: new Date(),
                    updated_at: new Date()
                });
                console.log(`✅ SOLPAY withdrawal failed - ₹${refundAmount} refunded to user wallet`);
            }
        }
        
        // 5. Return 'SUCCESS' for SOLPAY
        return { success: true, message: 'SUCCESS' };
    } catch (error) {
        return { success: false, message: error.message };
    }
}

// Query withdrawal order status from SOLPAY
async function querySolPayWithdrawalOrder(platOrderNum) {
    try {
        const payload = {
            merchantCode: solPayConfig.merchantCode,
            platOrderNum: platOrderNum,
            queryType: 'CASH_QUERY',
        };
        payload.sign = generateSolPaySignature(payload);
        const apiUrl = `${solPayConfig.host}/gateway/v1/query`;
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        const data = response.data;
        if (!verifySolPaySignature(data, data.platSign)) {
            return { success: false, message: 'Invalid platform signature' };
        }
        return data;
    } catch (error) {
        return { success: false, message: error.response && error.response.data ? error.response.data.msg : error.message };
    }
}

// Query balance from SOLPAY
async function querySolPayBalance() {
    try {
        const payload = {
            merchantCode: solPayConfig.merchantCode,
        };
        payload.sign = generateSolPaySignature(payload);
        const apiUrl = `${solPayConfig.host}/gateway/v1/queryBalance`;
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        const data = response.data;
        if (!verifySolPaySignature(data, data.platSign)) {
            return { success: false, message: 'Invalid platform signature' };
        }
        return data;
    } catch (error) {
        return { success: false, message: error.response && error.response.data ? error.response.data.msg : error.message };
    }
}

module.exports = {
    generateSolPaySignature,
    verifySolPaySignature,
    createSolPayDepositOrder,
    processSolPayDepositCallback,
    querySolPayDepositOrder,
    createSolPayWithdrawalOrder,
    processSolPayWithdrawalCallback,
    querySolPayWithdrawalOrder,
    querySolPayBalance
}; 
