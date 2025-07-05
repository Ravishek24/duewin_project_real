#!/usr/bin/env node

/**
 * Test GHPAY API Connection
 * Tests the connection to GHPAY API and provides detailed error information
 */

// Load environment variables first
require('dotenv').config();

const axios = require('axios');
const crypto = require('crypto');
const ghPayConfig = require('../config/ghPayConfig');

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

async function testGhPayConnection() {
    console.log('🔍 Testing GHPAY API Connection...\n');
    
    console.log('📋 Configuration:');
    console.log('Merchant ID:', ghPayConfig.mchId);
    console.log('API Host:', ghPayConfig.host);
    console.log('Key Length:', ghPayConfig.key.length);
    
    // Test 1: Account Balance Query
    console.log('\n🧪 Test 1: Account Balance Query');
    try {
        const balancePayload = {
            merchant: ghPayConfig.mchId
        };
        balancePayload.sign = generateGhPaySignature(balancePayload);
        
        console.log('Request Payload:', JSON.stringify(balancePayload, null, 2));
        
        const balanceResponse = await axios.post(`${ghPayConfig.host}/api/balance`, balancePayload, {
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
            merchant: ghPayConfig.mchId,
            paymentType: '1001', // UPI payment
            gold: '100.00', // 100 rupees
            channel: 0, // QR code
            notify_url: 'https://your-domain.com/api/payments/ghpay/payin-callback',
            feeType: 0 // fee from order
        };
        depositPayload.sign = generateGhPaySignature(depositPayload);
        
        console.log('Request Payload:', JSON.stringify(depositPayload, null, 2));
        
        const depositResponse = await axios.post(`${ghPayConfig.host}/api/payIn`, depositPayload, {
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
                    console.log('1. Merchant account is not activated by GHPAY');
                    console.log('2. Merchant ID is incorrect');
                    console.log('3. Account has insufficient balance');
                    console.log('4. Account is suspended or blocked');
                    console.log('\n💡 Action Required:');
                    console.log('- Contact GHPAY support to verify account status');
                    console.log('- Confirm merchant ID and secret key');
                    console.log('- Check if account needs activation');
                    console.log('- Verify account balance');
                }
            }
        } else {
            console.log('Error:', error.message);
        }
    }
    
    // Test 3: API endpoint availability
    console.log('\n🧪 Test 3: API Endpoint Availability');
    try {
        const healthResponse = await axios.get(`${ghPayConfig.host}/health`, {
            timeout: 5000
        });
        console.log('✅ API Health Check:', healthResponse.status);
    } catch (error) {
        console.log('❌ API Health Check Failed:', error.message);
    }
    
    console.log('\n📊 Summary:');
    console.log('If you see "account invalid" errors, please:');
    console.log('1. Contact GHPAY support with your merchant ID: ' + ghPayConfig.mchId);
    console.log('2. Verify your account is activated and has sufficient balance');
    console.log('3. Confirm the API credentials are correct');
    console.log('4. Check if there are any pending verification requirements');
}

// Run the test
testGhPayConnection().then(() => {
    console.log('\n✅ GHPAY connection test completed');
    process.exit(0);
}).catch((error) => {
    console.error('\n❌ GHPAY connection test failed:', error);
    process.exit(1);
}); 