const axios = require('axios');
const crypto = require('crypto');
const wowPayConfig = require('../config/wowPayConfig');
// Import models with error handling
let WalletRecharge, WalletWithdrawal, User;

// Function to initialize models
const initializeModels = async () => {
    try {
        // Try async models import first
        const { getModels } = require('../models');
        const models = await getModels();
        
        WalletRecharge = models.WalletRecharge;
        WalletWithdrawal = models.WalletWithdrawal; 
        User = models.User;
        
        if (WalletRecharge) {
            console.log('✅ WalletRecharge model loaded successfully');
        }
        if (WalletWithdrawal) {
            console.log('✅ WalletWithdrawal model loaded successfully');
        }
        if (User) {
            console.log('✅ User model loaded successfully');
        }
        
        return true;
    } catch (error) {
        console.warn('⚠️ Async models not available, trying sync import...');
        
        try {
            // Fallback to sync import
            const models = require('../models');
            WalletRecharge = models.WalletRecharge || models.models?.WalletRecharge;
            WalletWithdrawal = models.WalletWithdrawal || models.models?.WalletWithdrawal;
            User = models.User || models.models?.User;
            
            if (WalletRecharge) {
                console.log('✅ WalletRecharge model loaded via sync import');
            }
            return !!WalletRecharge;
        } catch (syncError) {
            console.error('❌ Failed to load models:', syncError.message);
            return false;
        }
    }
};

// Initialize models when service loads
initializeModels();

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
        // Handle response - check both string and number for success code
        if (response.data && (response.data.code === '100' || response.data.code === 100)) {
            // Check if data field exists for payment URL, if not create order anyway
            const hasPaymentData = response.data.data && response.data.data.trade_url;
            
            // Create recharge record in DB (pending) - with error handling
            try {
                // Try to reinitialize models if not available
                if (!WalletRecharge || typeof WalletRecharge.create !== 'function') {
                    console.log('🔄 Attempting to reload models...');
                    await initializeModels();
                }
                
                if (WalletRecharge && typeof WalletRecharge.create === 'function') {
                    const rechargeRecord = await WalletRecharge.create({
                        user_id: userId,
                        amount: params.amount,
                        payment_gateway_id: gatewayId,
                        status: 'pending',
                        order_id: orderId,
                        transaction_id: response.data.data ? response.data.data.order_sn : orderId
                    });
                    console.log('✅ Payment record created in database:', rechargeRecord.id);
                } else {
                    console.warn('⚠️ WalletRecharge model still not available - skipping database record creation');
                }
            } catch (dbError) {
                console.error('❌ Database error creating WalletRecharge:', dbError);
                // Continue with success response even if DB fails
            }
            return {
                success: true,
                paymentUrl: response.data.data ? response.data.data.trade_url : null,
                orderId: response.data.data ? response.data.data.order_sn : orderId,
                message: response.data.message || 'Order created successfully'
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
        console.log('📥 WowPay Callback Received:', JSON.stringify(callbackData, null, 2));
        
        // 1. Extract order details
        const orderId = callbackData.out_trade_sn;
        const amount = callbackData.amount;
        
        if (!orderId) {
            console.error('❌ Missing order ID in callback');
            return { success: false, message: 'Missing order ID' };
        }
        
        // 2. Handle different callback types
        const hasTradeStatus = callbackData.trade_status !== undefined && callbackData.trade_status !== null;
        const hasSignature = callbackData.sign !== undefined && callbackData.sign !== null;
        
        console.log('🔍 Callback Analysis:');
        console.log('- Has trade_status:', hasTradeStatus);
        console.log('- Has signature:', hasSignature);
        console.log('- Order ID:', orderId);
        console.log('- Amount:', amount);
        
        // 3. Verify signature if present
        if (hasSignature) {
            const receivedSign = callbackData.sign;
            const calculatedSign = generateWowPaySignature(callbackData);
            if (receivedSign !== calculatedSign) {
                console.error('❌ Invalid signature');
                return { success: false, message: 'Invalid signature' };
            }
            console.log('✅ Signature verified');
        } else {
            console.log('⚠️ No signature provided - skipping verification');
        }
        
        // 4. Find WalletRecharge (deposit)
        let order = null;
        try {
            if (WalletRecharge && typeof WalletRecharge.findOne === 'function') {
                order = await WalletRecharge.findOne({ where: { order_id: orderId } });
            } else {
                console.error('❌ WalletRecharge model not available');
                return { success: false, message: 'Database model not available' };
            }
        } catch (dbError) {
            console.error('❌ Database error finding order:', dbError);
            return { success: false, message: 'Database error' };
        }
        
        if (!order) {
            console.error(`❌ Order not found: ${orderId}`);
            return { success: false, message: 'Order not found' };
        }
        
        console.log('✅ Order found in database:', order.id);
        
        // 5. Handle status update or notification
        if (hasTradeStatus) {
            // Status update callback
            const status = callbackData.trade_status;
            console.log('📊 Status update received:', status);
            
            let orderStatus;
            if (status === 'success') {
                orderStatus = 'completed';
            } else if (status === 'failed') {
                orderStatus = 'failed';
            } else if (status === 'timeout') {
                orderStatus = 'timeout';
            } else {
                orderStatus = 'pending';
            }
            
            await order.update({ status: orderStatus, updated_at: new Date() });
            console.log(`✅ Order status updated to: ${orderStatus}`);
            
            // Update user wallet if completed
            if (orderStatus === 'completed') {
                try {
                    if (User && typeof User.findByPk === 'function') {
                        const user = await User.findByPk(order.user_id);
                        if (user) {
                            const newBalance = parseFloat(user.wallet_balance) + parseFloat(order.amount);
                            await user.update({ wallet_balance: newBalance });
                            console.log(`✅ User wallet updated: ${user.wallet_balance} → ${newBalance}`);
                        }
                    }
                } catch (walletError) {
                    console.error('❌ Error updating user wallet:', walletError);
                }
            }
        } else {
            // Payment notification callback (no status update)
            console.log('📢 Payment notification received - no status change');
            console.log('💡 This might be an initial payment notification');
            console.log('💡 Status update callback should follow separately');
        }
        
        return { success: true, message: 'success' }; // Must return 'success' for WOWPAY
        
    } catch (error) {
        console.error('❌ Error processing WowPay callback:', error);
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
        // 4. Update order status - Fix status mapping according to docs
        let orderStatus;
        if (status === 'success') {
            orderStatus = 'completed';
        } else if (status === 'failed') {
            orderStatus = 'failed';
        } else if (status === 'rejected') {
            orderStatus = 'rejected'; // Keep rejected as separate status
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
    try {
        const payload = {
            merchant_no: wowPayConfig.mchId,
            sign_type: wowPayConfig.signType
        };
        payload.sign = generateWowPaySignature(payload);
        const apiUrl = `${wowPayConfig.host}/gw-api/bank-code`;
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

// Query balance from WOWPAY
async function queryWowPayBalance() {
    try {
        const payload = {
            merchant_no: wowPayConfig.mchId,
            sign_type: wowPayConfig.signType
        };
        payload.sign = generateWowPaySignature(payload);
        const apiUrl = `${wowPayConfig.host}/gw-api/balance/query`;
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

// Query order by UTR from WOWPAY
async function queryWowPayUtr(utr) {
    try {
        const payload = {
            merchant_no: wowPayConfig.mchId,
            utr: utr,
            sign_type: wowPayConfig.signType
        };
        payload.sign = generateWowPaySignature(payload);
        const apiUrl = `${wowPayConfig.host}/gw-api/utr/query`;
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

// Confirm order by UTR from WOWPAY
async function confirmWowPayUtr(utr, orderId, systemOrderId) {
    try {
        const payload = {
            merchant_no: wowPayConfig.mchId,
            utr: utr,
            sign_type: wowPayConfig.signType
        };
        
        // Add either order_sn or out_trade_sn (not both)
        if (systemOrderId) {
            payload.order_sn = systemOrderId;
        } else if (orderId) {
            payload.out_trade_sn = orderId;
        } else {
            return {
                success: false,
                message: 'Either order_sn or out_trade_sn must be provided'
            };
        }
        
        payload.sign = generateWowPaySignature(payload);
        const apiUrl = `${wowPayConfig.host}/gw-api/utr/confirm`;
        const response = await axios.post(apiUrl, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.data && response.data.code === '100') {
            return {
                success: true,
                message: response.data.message
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