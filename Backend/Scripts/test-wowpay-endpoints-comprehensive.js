const axios = require('axios');
const crypto = require('crypto');
const wowPayConfig = require('../config/wowPayConfig');

async function testWowPayEndpointsComprehensive() {
    console.log('🔍 Comprehensive WOWPAY Endpoint Testing\n');

    // Test all possible WOWPAY endpoints
    const endpoints = [
        { name: 'Test Environment (Documentation)', url: 'https://test.wowpay.biz' },
        { name: 'Production Environment (Documentation)', url: 'https://api.wowpay.biz' },
        { name: 'Alternative Production', url: 'https://api.wanfot.com' },
        { name: 'Alternative Test', url: 'https://test.wanfot.com' },
        { name: 'Direct IP Test', url: 'http://86.38.247.84' }, // From documentation callback IP
    ];

    const testPayload = {
        merchant_no: wowPayConfig.mchId,
        out_trade_sn: `TEST_${Date.now()}`,
        amount: '100.00',
        notify_url: 'http://test.com/callback',
        sign_type: 'MD5'
    };

    // Generate signature
    const filtered = Object.entries(testPayload)
        .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'sign')
        .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
    const sortedKeys = Object.keys(filtered).sort();
    const joined = sortedKeys.map(key => `${key}=${filtered[key]}`).join('&');
    const stringToSign = `${joined}&key=${wowPayConfig.key}`;
    testPayload.sign = crypto.createHash('md5').update(stringToSign).digest('hex').toUpperCase();

    console.log('Testing endpoints with payload:');
    console.log(JSON.stringify(testPayload, null, 2));
    console.log('\n' + '='.repeat(80) + '\n');

    for (const endpoint of endpoints) {
        console.log(`🌐 Testing: ${endpoint.name}`);
        console.log(`   URL: ${endpoint.url}`);
        
        try {
            // Test with SSL verification disabled for problematic endpoints
            const response = await axios.post(`${endpoint.url}/gw-api/deposit/create`, testPayload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000,
                httpsAgent: new (require('https').Agent)({
                    rejectUnauthorized: false // Disable SSL verification for testing
                })
            });
            
            console.log(`   ✅ Status: ${response.status}`);
            console.log(`   📄 Response: ${JSON.stringify(response.data, null, 2)}`);
            
            if (response.data.code === '100') {
                console.log(`   🎉 SUCCESS! This endpoint works: ${endpoint.url}`);
                console.log(`   💡 Update your WOWPAY_HOST to: ${endpoint.url}`);
                break;
            } else if (response.data.code === 102) {
                console.log(`   ⚠️  Merchant not found (endpoint works, credentials issue)`);
            } else {
                console.log(`   ❌ API Error: ${response.data.message}`);
            }
            
        } catch (error) {
            if (error.code === 'ENOTFOUND') {
                console.log(`   ❌ DNS Error: Cannot resolve hostname`);
            } else if (error.code === 'ECONNREFUSED') {
                console.log(`   ❌ Connection Refused: Service not available`);
            } else if (error.code === 'CERT_HAS_EXPIRED' || error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
                console.log(`   ❌ SSL Certificate Error: ${error.message}`);
            } else if (error.response) {
                console.log(`   ❌ HTTP Error: ${error.response.status} - ${error.response.statusText}`);
            } else {
                console.log(`   ❌ Network Error: ${error.message}`);
            }
        }
        
        console.log('');
    }

    // Test with different merchant ID formats
    console.log('🔍 Testing Different Merchant ID Formats:');
    const merchantFormats = [
        'ruNklnM3bncNAzd7',  // Current
        'ruNkLnM3bncNAzd7',  // Different case
        'RunklnM3bncNAzd7',  // First letter uppercase
        'RunkLnM3bncNAzd7',  // Mixed case
    ];

    for (const merchantId of merchantFormats) {
        console.log(`\n   Testing Merchant ID: ${merchantId}`);
        
        const formatPayload = {
            merchant_no: merchantId,
            out_trade_sn: `TEST_${Date.now()}`,
            amount: '100.00',
            notify_url: 'http://test.com/callback',
            sign_type: 'MD5'
        };

        // Generate signature
        const formatFiltered = Object.entries(formatPayload)
            .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'sign')
            .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
        const formatSortedKeys = Object.keys(formatFiltered).sort();
        const formatJoined = formatSortedKeys.map(key => `${key}=${formatFiltered[key]}`).join('&');
        const formatStringToSign = `${formatJoined}&key=${wowPayConfig.key}`;
        formatPayload.sign = crypto.createHash('md5').update(formatStringToSign).digest('hex').toUpperCase();

        try {
            const response = await axios.post(`${wowPayConfig.host}/gw-api/deposit/create`, formatPayload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            });
            
            console.log(`     Response: ${response.data.code} - ${response.data.message}`);
            
            if (response.data.code === '100') {
                console.log(`     🎉 SUCCESS! Correct merchant ID format: ${merchantId}`);
                break;
            }
        } catch (error) {
            console.log(`     Error: ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('📋 SUMMARY & RECOMMENDATIONS:');
    console.log('1. If any endpoint returns code 102, the endpoint works but merchant credentials are wrong');
    console.log('2. If endpoint returns SSL errors, try with different URL or contact provider');
    console.log('3. If all endpoints fail, contact WOWPAY support for correct credentials');
    console.log('4. Check if your test merchant account is properly activated');
    console.log('5. Verify the merchant ID case sensitivity with the provider');
}

// Run the comprehensive test
testWowPayEndpointsComprehensive().catch(console.error); 