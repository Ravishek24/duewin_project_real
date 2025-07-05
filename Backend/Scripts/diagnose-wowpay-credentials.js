const axios = require('axios');
const crypto = require('crypto');
const wowPayConfig = require('../config/wowPayConfig');

async function diagnoseWowPayCredentials() {
    console.log('🔍 WOWPAY Credentials Diagnostic\n');

    // Check current configuration
    console.log('1. Current Configuration:');
    console.log(`   Merchant ID: ${wowPayConfig.mchId}`);
    console.log(`   Secret Key: ${wowPayConfig.key.substring(0, 10)}...${wowPayConfig.key.substring(wowPayConfig.key.length - 5)}`);
    console.log(`   Base URL: ${wowPayConfig.host}`);
    console.log(`   Sign Type: ${wowPayConfig.signType}\n`);

    // Test with different merchant IDs
    const testMerchantIds = [
        'ruNklnM3bncNAzd7',  // Current one
        'ruNkLnM3bncNAzd7',  // Different case
        'ruNkLnM3bncNAzd7',  // From documentation example
        'test_merchant',     // Generic test
    ];

    console.log('2. Testing Different Merchant IDs:');
    
    for (const merchantId of testMerchantIds) {
        console.log(`\n   Testing Merchant ID: ${merchantId}`);
        
        const testPayload = {
            merchant_no: merchantId,
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

        try {
            const response = await axios.post(`${wowPayConfig.host}/gw-api/deposit/create`, testPayload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            });
            
            console.log(`     Response Code: ${response.data.code}`);
            console.log(`     Message: ${response.data.message}`);
            
            if (response.data.code === '100') {
                console.log(`     ✅ SUCCESS! This merchant ID works: ${merchantId}`);
                break;
            } else if (response.data.code === 102) {
                console.log(`     ❌ Merchant does not exist`);
            } else {
                console.log(`     ⚠️  Other error: ${response.data.message}`);
            }
        } catch (error) {
            console.log(`     ❌ Network error: ${error.message}`);
        }
    }

    // Test different environments
    console.log('\n3. Testing Different Environments:');
    
    const environments = [
        { name: 'Test Environment', url: 'https://test.wowpay.biz' },
        { name: 'Production Environment', url: 'https://api.wowpay.biz' },
        { name: 'Alternative Test', url: 'https://api.wanfot.com' }
    ];

    for (const env of environments) {
        console.log(`\n   Testing ${env.name}: ${env.url}`);
        
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

        try {
            const response = await axios.post(`${env.url}/gw-api/deposit/create`, testPayload, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000
            });
            
            console.log(`     Response Code: ${response.data.code}`);
            console.log(`     Message: ${response.data.message}`);
            
            if (response.data.code === '100') {
                console.log(`     ✅ SUCCESS! This environment works: ${env.url}`);
            } else if (response.data.code === 102) {
                console.log(`     ❌ Merchant does not exist in this environment`);
            } else {
                console.log(`     ⚠️  Other error: ${response.data.message}`);
            }
        } catch (error) {
            console.log(`     ❌ Network error: ${error.message}`);
        }
    }

    // Provide recommendations
    console.log('\n4. Recommendations:');
    console.log('   📞 Contact WOWPAY support to:');
    console.log('      - Verify your merchant account status');
    console.log('      - Confirm the correct merchant ID');
    console.log('      - Get the correct API endpoint URL');
    console.log('      - Verify your secret key');
    console.log('   🔧 Check your environment variables:');
    console.log('      - WOWPAY_MCH_ID');
    console.log('      - WOWPAY_KEY');
    console.log('      - WOWPAY_HOST');
    console.log('   📋 Common issues:');
    console.log('      - Merchant account not activated');
    console.log('      - Wrong environment (test vs production)');
    console.log('      - Incorrect merchant ID format');
    console.log('      - Secret key mismatch');

    console.log('\n✅ Diagnostic Complete!');
}

// Run the diagnostic
diagnoseWowPayCredentials().catch(console.error); 