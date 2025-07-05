#!/usr/bin/env node

/**
 * Test WOWPAY API Connection
 * Tests the connection to WOWPAY API and provides detailed error information
 */

// Load environment variables first
require('dotenv').config();

const axios = require('axios');
const crypto = require('crypto');
const wowPayConfig = require('../config/wowPayConfig');

// Utility: Generate WOWPAY signature
function generateWowPaySignature(params, secretKey = wowPayConfig.key) {
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

async function testWowPayConnection() {
    console.log('🔍 Testing WOWPAY API Connection...\n');
    
    console.log('📋 Configuration:');
    console.log('Merchant ID:', wowPayConfig.mchId);
    console.log('API Host:', wowPayConfig.host);
    console.log('Key Length:', wowPayConfig.key.length);
    console.log('Sign Type:', wowPayConfig.signType);
    
    // Test 1: Account Balance Query
    console.log('\n🧪 Test 1: Account Balance Query');
    try {
        const balancePayload = {
            mchId: wowPayConfig.mchId
        };
        balancePayload.sign = generateWowPaySignature(balancePayload);
        
        console.log('Request Payload:', JSON.stringify(balancePayload, null, 2));
        
        const balanceResponse = await axios.post(`${wowPayConfig.host}/api/balance`, balancePayload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        
        console.log('✅ Balance Query Response:', JSON.stringify(balanceResponse.data, null, 2));
        
    } catch (error) {
        console.log('❌ Balance Query Failed:');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.log('Error:', error.message);
        }
    }
    
    // Test 2: Create a test deposit order
    console.log('\n🧪 Test 2: Create Test Deposit Order');
    try {
        const testOrderId = 'TEST_' + Date.now();
        const depositPayload = {
            mchId: wowPayConfig.mchId,
            orderId: testOrderId,
            amount: '100.00', // 100 rupees
            notifyUrl: 'https://your-domain.com/api/payments/wowpay/payin-callback',
            returnUrl: 'https://your-domain.com/payment/success',
            channel: 'UPI' // Payment channel
        };
        depositPayload.sign = generateWowPaySignature(depositPayload);
        
        console.log('Request Payload:', JSON.stringify(depositPayload, null, 2));
        
        const depositResponse = await axios.post(`${wowPayConfig.host}/api/pay`, depositPayload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        
        console.log('✅ Deposit Order Response:', JSON.stringify(depositResponse.data, null, 2));
        
    } catch (error) {
        console.log('❌ Deposit Order Failed:');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response Data:', JSON.stringify(error.response.data, null, 2));
            
            // Provide specific guidance based on error
            if (error.response.data && error.response.data.message) {
                const message = error.response.data.message.toLowerCase();
                if (message.includes('account invalid') || message.includes('invalid account')) {
                    console.log('\n🚨 ACCOUNT INVALID ERROR DETECTED');
                    console.log('Possible causes:');
                    console.log('1. Merchant account is not activated by WOWPAY');
                    console.log('2. Merchant ID is incorrect');
                    console.log('3. Account has insufficient balance');
                    console.log('4. Account is suspended or blocked');
                    console.log('\n💡 Action Required:');
                    console.log('- Contact WOWPAY support to verify account status');
                    console.log('- Confirm merchant ID and secret key');
                    console.log('- Check if account needs activation');
                    console.log('- Verify account balance');
                } else if (message.includes('merchant') && message.includes('not found')) {
                    console.log('\n🚨 MERCHANT NOT FOUND ERROR DETECTED');
                    console.log('Possible causes:');
                    console.log('1. Merchant ID is incorrect');
                    console.log('2. Using test credentials on production API');
                    console.log('3. Using production credentials on test API');
                    console.log('\n💡 Action Required:');
                    console.log('- Verify the merchant ID is correct');
                    console.log('- Check if you should use test or production environment');
                    console.log('- Contact WOWPAY support to confirm credentials');
                }
            }
        } else {
            console.log('Error:', error.message);
        }
    }
    
    // Test 3: API endpoint availability
    console.log('\n🧪 Test 3: API Endpoint Availability');
    try {
        const healthResponse = await axios.get(`${wowPayConfig.host}/health`, {
            timeout: 5000
        });
        console.log('✅ API Health Check:', healthResponse.status);
    } catch (error) {
        console.log('❌ API Health Check Failed:', error.message);
    }
    
    // Test 4: Check if it's test environment
    console.log('\n🧪 Test 4: Environment Check');
    if (wowPayConfig.host.includes('test')) {
        console.log('⚠️ WARNING: Using TEST environment');
        console.log('This is expected for testing. For production, use:');
        console.log('export WOWPAY_HOST="https://api.wowpay.biz"');
    } else {
        console.log('✅ Using PRODUCTION environment');
    }
    
    console.log('\n📊 Summary:');
    console.log('If you see errors, please:');
    console.log('1. Contact WOWPAY support with your merchant ID: ' + wowPayConfig.mchId);
    console.log('2. Verify your account is activated and has sufficient balance');
    console.log('3. Confirm the API credentials are correct');
    console.log('4. Check if you should use test or production environment');
}

// Run the test
testWowPayConnection().then(() => {
    console.log('\n✅ WOWPAY connection test completed');
    process.exit(0);
}).catch((error) => {
    console.error('\n❌ WOWPAY connection test failed:', error);
    process.exit(1);
}); 