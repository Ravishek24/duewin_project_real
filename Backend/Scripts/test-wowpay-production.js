#!/usr/bin/env node

/**
 * Test WOWPAY Production Environment
 * Tests WOWPAY API in production environment
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

async function testWowPayProduction() {
    console.log('🔍 Testing WOWPAY Production Environment...\n');
    
    // Test production host
    const productionHost = 'https://api.wowpay.biz';
    
    console.log('📋 Configuration:');
    console.log('Merchant ID:', wowPayConfig.mchId);
    console.log('Test Host:', wowPayConfig.host);
    console.log('Production Host:', productionHost);
    console.log('Key Length:', wowPayConfig.key.length);
    console.log('Sign Type:', wowPayConfig.signType);
    
    // Test production endpoints
    const productionEndpoints = [
        '/api/pay',
        '/api/payment',
        '/api/deposit',
        '/api/order',
        '/v1/pay',
        '/v1/payment'
    ];
    
    console.log('\n🧪 Testing Production Endpoints:');
    
    for (const endpoint of productionEndpoints) {
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
            
            console.log(`\nTesting Production: ${endpoint}`);
            const response = await axios.post(`${productionHost}${endpoint}`, payload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            });
            
            console.log(`✅ Production ${endpoint} - Status: ${response.status}`);
            console.log('Response:', JSON.stringify(response.data, null, 2));
            
        } catch (error) {
            if (error.response) {
                console.log(`❌ Production ${endpoint} - Status: ${error.response.status}`);
                if (error.response.status !== 404) {
                    console.log('Response:', JSON.stringify(error.response.data, null, 2));
                }
            } else {
                console.log(`❌ Production ${endpoint} - Error: ${error.message}`);
            }
        }
    }
    
    // Test production health check
    console.log('\n🧪 Testing Production Health Check:');
    try {
        const healthResponse = await axios.get(`${productionHost}/health`, {
            timeout: 5000
        });
        console.log('✅ Production Health Check:', healthResponse.status);
    } catch (error) {
        console.log('❌ Production Health Check Failed:', error.message);
    }
    
    console.log('\n📊 Summary:');
    console.log('If production also fails, you need to:');
    console.log('1. Contact WOWPAY support for correct API documentation');
    console.log('2. Verify your account is enabled for API access');
    console.log('3. Check if you need different credentials for API vs web interface');
    console.log('4. Ask for API endpoint examples from WOWPAY support');
}

// Run the test
testWowPayProduction().then(() => {
    console.log('\n✅ WOWPAY production testing completed');
    process.exit(0);
}).catch((error) => {
    console.error('\n❌ WOWPAY production testing failed:', error);
    process.exit(1);
}); 