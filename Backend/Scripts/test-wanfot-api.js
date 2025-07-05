#!/usr/bin/env node

/**
 * Test WANFOT API (WOWPAY)
 * Tests the correct API domain based on SSL certificate discovery
 */

// Load environment variables first
require('dotenv').config();

const axios = require('axios');
const crypto = require('crypto');
const wowPayConfig = require('../config/wowPayConfig');

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

async function testWanfotApi() {
    console.log('🔍 Testing WANFOT API (WOWPAY)...\n');
    
    // Test different possible domains
    const possibleHosts = [
        'https://api.wanfot.com',
        'https://api.wanfot.com:443',
        'https://wanfot.com',
        'https://www.wanfot.com',
        'https://pay.wanfot.com',
        'https://gateway.wanfot.com'
    ];
    
    console.log('📋 Configuration:');
    console.log('Merchant ID:', wowPayConfig.mchId);
    console.log('Key Length:', wowPayConfig.key.length);
    console.log('Sign Type:', wowPayConfig.signType);
    
    // Test endpoints
    const endpoints = [
        '/api/pay',
        '/api/payment',
        '/api/deposit',
        '/api/order',
        '/v1/pay',
        '/v1/payment',
        '/pay',
        '/payment'
    ];
    
    for (const host of possibleHosts) {
        console.log(`\n🧪 Testing Host: ${host}`);
        
        // Test health check first
        try {
            console.log('Testing health check...');
            const healthResponse = await axios.get(`${host}/health`, {
                timeout: 5000,
                validateStatus: () => true // Accept any status code
            });
            console.log(`✅ Health Check: ${healthResponse.status}`);
            
            if (healthResponse.status === 200) {
                console.log('✅ This host is reachable!');
            }
            
        } catch (error) {
            console.log(`❌ Health Check Failed: ${error.message}`);
        }
        
        // Test API endpoints
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
                
                console.log(`Testing: ${endpoint}`);
                const response = await axios.post(`${host}${endpoint}`, payload, {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: 10000,
                    validateStatus: () => true // Accept any status code
                });
                
                console.log(`✅ ${endpoint} - Status: ${response.status}`);
                
                if (response.status !== 404 && response.status !== 405) {
                    console.log('Response:', JSON.stringify(response.data, null, 2));
                }
                
            } catch (error) {
                if (error.response) {
                    console.log(`❌ ${endpoint} - Status: ${error.response.status}`);
                    if (error.response.status !== 404 && error.response.status !== 405) {
                        console.log('Response:', JSON.stringify(error.response.data, null, 2));
                    }
                } else {
                    console.log(`❌ ${endpoint} - Error: ${error.message}`);
                }
            }
        }
    }
    
    // Test with different payload formats
    console.log('\n🧪 Testing Alternative Payload Formats:');
    
    const testHost = 'https://api.wanfot.com'; // Most likely candidate
    
    const payloadFormats = [
        {
            name: 'WANFOT Format 1',
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
            name: 'WANFOT Format 2',
            payload: {
                merchantId: wowPayConfig.mchId,
                orderId: 'TEST_' + Date.now(),
                amount: '100.00',
                notifyUrl: 'https://your-domain.com/api/payments/wowpay/payin-callback',
                returnUrl: 'https://your-domain.com/payment/success',
                channel: 'UPI'
            }
        },
        {
            name: 'WANFOT Format 3',
            payload: {
                mch_id: wowPayConfig.mchId,
                order_id: 'TEST_' + Date.now(),
                amount: '100.00',
                notify_url: 'https://your-domain.com/api/payments/wowpay/payin-callback',
                return_url: 'https://your-domain.com/payment/success',
                channel: 'UPI'
            }
        }
    ];
    
    for (const format of payloadFormats) {
        try {
            console.log(`\nTesting: ${format.name}`);
            const payload = { ...format.payload };
            payload.sign = generateWowPaySignature(payload);
            
            const response = await axios.post(`${testHost}/api/pay`, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000,
                validateStatus: () => true
            });
            
            console.log(`✅ ${format.name} - Status: ${response.status}`);
            
            if (response.status !== 404 && response.status !== 405) {
                console.log('Response:', JSON.stringify(response.data, null, 2));
            }
            
        } catch (error) {
            if (error.response) {
                console.log(`❌ ${format.name} - Status: ${error.response.status}`);
                if (error.response.status !== 404 && error.response.status !== 405) {
                    console.log('Response:', JSON.stringify(error.response.data, null, 2));
                }
            } else {
                console.log(`❌ ${format.name} - Error: ${error.message}`);
            }
        }
    }
    
    console.log('\n📊 Summary:');
    console.log('Based on SSL certificate discovery:');
    console.log('- WOWPAY is hosted on wanfot.com domain');
    console.log('- Try updating your WOWPAY_HOST to: https://api.wanfot.com');
    console.log('- Contact WOWPAY support to confirm the correct API domain');
    console.log('- Ask for API documentation with correct endpoints');
}

// Run the test
testWanfotApi().then(() => {
    console.log('\n✅ WANFOT API testing completed');
    process.exit(0);
}).catch((error) => {
    console.error('\n❌ WANFOT API testing failed:', error);
    process.exit(1);
}); 