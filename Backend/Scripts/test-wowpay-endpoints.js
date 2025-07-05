#!/usr/bin/env node

/**
 * Test WOWPAY Endpoints
 * Tests various WOWPAY API endpoint variations and database configuration
 */

// Load environment variables first
require('dotenv').config();

const axios = require('axios');
const crypto = require('crypto');
const wowPayConfig = require('../config/wowPayConfig');
const { sequelize } = require('../config/db');

// Utility: Generate WOWPAY signature
function generateWowPaySignature(params, secretKey = wowPayConfig.key) {
    const filtered = Object.entries(params)
        .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'sign')
        .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
    const sortedKeys = Object.keys(filtered).sort();
    const joined = sortedKeys.map(key => `${key}=${filtered[key]}`).join('&');
    const stringToSign = `${joined}&key=${secretKey}`;
    return crypto.createHash('md5').update(stringToSign).digest('hex').toLowerCase();
}

async function testWowPayEndpoints() {
    console.log('🔍 Testing WOWPAY API Endpoints...\n');
    
    console.log('📋 Configuration:');
    console.log('Merchant ID:', wowPayConfig.mchId);
    console.log('API Host:', wowPayConfig.host);
    console.log('Key Length:', wowPayConfig.key.length);
    console.log('Sign Type:', wowPayConfig.signType);
    
    // Test different endpoint variations
    const endpoints = [
        '/api/pay',
        '/api/payment',
        '/api/deposit',
        '/api/create-order',
        '/api/order',
        '/v1/pay',
        '/v1/payment',
        '/test/pay',
        '/test/payment',
        '/api/test/pay',
        '/api/test/payment'
    ];
    
    console.log('\n🧪 Testing Different Endpoint Variations:');
    
    for (const endpoint of endpoints) {
        try {
            const testOrderId = 'TEST_' + Date.now();
            const payload = {
                mchId: wowPayConfig.mchId,
                orderId: testOrderId,
                amount: '100.00',
                notifyUrl: 'https://your-domain.com/api/payments/wowpay/payin-callback',
                returnUrl: 'https://your-domain.com/payment/success',
                channel: 'UPI'
            };
            payload.sign = generateWowPaySignature(payload);
            
            console.log(`\nTesting: ${endpoint}`);
            const response = await axios.post(`${wowPayConfig.host}${endpoint}`, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            });
            
            console.log(`✅ ${endpoint} - Status: ${response.status}`);
            console.log('Response:', JSON.stringify(response.data, null, 2));
            
        } catch (error) {
            if (error.response) {
                console.log(`❌ ${endpoint} - Status: ${error.response.status}`);
                if (error.response.status !== 404) {
                    console.log('Response:', JSON.stringify(error.response.data, null, 2));
                }
            } else {
                console.log(`❌ ${endpoint} - Error: ${error.message}`);
            }
        }
    }
    
    // Test GET endpoints
    console.log('\n🧪 Testing GET Endpoints:');
    const getEndpoints = [
        '/api/balance',
        '/api/account',
        '/api/status',
        '/api/health',
        '/v1/balance',
        '/v1/account',
        '/test/balance',
        '/test/account'
    ];
    
    for (const endpoint of getEndpoints) {
        try {
            console.log(`\nTesting GET: ${endpoint}`);
            const response = await axios.get(`${wowPayConfig.host}${endpoint}`, {
                timeout: 5000
            });
            
            console.log(`✅ GET ${endpoint} - Status: ${response.status}`);
            console.log('Response:', JSON.stringify(response.data, null, 2));
            
        } catch (error) {
            if (error.response) {
                console.log(`❌ GET ${endpoint} - Status: ${error.response.status}`);
                if (error.response.status !== 404) {
                    console.log('Response:', JSON.stringify(error.response.data, null, 2));
                }
            } else {
                console.log(`❌ GET ${endpoint} - Error: ${error.message}`);
            }
        }
    }
    
    // Check database configuration
    console.log('\n🧪 Checking Database Configuration:');
    try {
        const modelsModule = require('../models');
        const models = await modelsModule.getModels();
        const PaymentGateway = models.PaymentGateway;
        
        if (PaymentGateway) {
            const wowPayGateway = await PaymentGateway.findOne({
                where: { code: 'WOWPAY' }
            });
            
            if (wowPayGateway) {
                console.log('✅ WOWPAY found in database:');
                console.log('Gateway ID:', wowPayGateway.gateway_id);
                console.log('Name:', wowPayGateway.name);
                console.log('Active:', wowPayGateway.is_active);
                console.log('Supports Deposit:', wowPayGateway.supports_deposit);
                console.log('Supports Withdrawal:', wowPayGateway.supports_withdrawal);
            } else {
                console.log('❌ WOWPAY not found in database');
                console.log('You may need to add WOWPAY to the payment gateways table');
            }
        } else {
            console.log('❌ PaymentGateway model not available');
        }
        
    } catch (error) {
        console.log('❌ Database check failed:', error.message);
    }
    
    // Test with different payload formats
    console.log('\n🧪 Testing Different Payload Formats:');
    
    const payloadFormats = [
        {
            name: 'Standard Format',
            payload: {
                mchId: wowPayConfig.mchId,
                orderId: 'TEST_' + Date.now(),
                amount: '100.00',
                notifyUrl: 'https://your-domain.com/api/payments/wowpay/payin-callback',
                returnUrl: 'https://your-domain.com/payment/success',
                channel: 'UPI'
            }
        },
        {
            name: 'Alternative Format 1',
            payload: {
                merchant_id: wowPayConfig.mchId,
                order_id: 'TEST_' + Date.now(),
                amount: '100.00',
                notify_url: 'https://your-domain.com/api/payments/wowpay/payin-callback',
                return_url: 'https://your-domain.com/payment/success',
                payment_channel: 'UPI'
            }
        },
        {
            name: 'Alternative Format 2',
            payload: {
                merchantId: wowPayConfig.mchId,
                orderId: 'TEST_' + Date.now(),
                amount: '100.00',
                notifyUrl: 'https://your-domain.com/api/payments/wowpay/payin-callback',
                returnUrl: 'https://your-domain.com/payment/success',
                channel: 'UPI'
            }
        }
    ];
    
    for (const format of payloadFormats) {
        try {
            console.log(`\nTesting: ${format.name}`);
            const payload = { ...format.payload };
            payload.sign = generateWowPaySignature(payload);
            
            const response = await axios.post(`${wowPayConfig.host}/api/pay`, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            });
            
            console.log(`✅ ${format.name} - Status: ${response.status}`);
            console.log('Response:', JSON.stringify(response.data, null, 2));
            
        } catch (error) {
            if (error.response) {
                console.log(`❌ ${format.name} - Status: ${error.response.status}`);
                if (error.response.status !== 404) {
                    console.log('Response:', JSON.stringify(error.response.data, null, 2));
                }
            } else {
                console.log(`❌ ${format.name} - Error: ${error.message}`);
            }
        }
    }
    
    console.log('\n📊 Summary:');
    console.log('If all endpoints return 404, you may need to:');
    console.log('1. Contact WOWPAY support for correct API endpoints');
    console.log('2. Check if your test account is enabled for API access');
    console.log('3. Verify you are using the correct API version');
    console.log('4. Switch to production environment if ready');
    
    if (sequelize) {
        await sequelize.close();
    }
}

// Run the test
testWowPayEndpoints().then(() => {
    console.log('\n✅ WOWPAY endpoint testing completed');
    process.exit(0);
}).catch((error) => {
    console.error('\n❌ WOWPAY endpoint testing failed:', error);
    process.exit(1);
}); 