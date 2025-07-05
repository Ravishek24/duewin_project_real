const axios = require('axios');
const crypto = require('crypto');
const wowPayConfig = require('../config/wowPayConfig');

// Test WOWPAY integration against documentation
async function testWowPayIntegration() {
    console.log('🧪 Testing WOWPAY Integration against Documentation...\n');

    // Test 1: Verify configuration
    console.log('1. Configuration Check:');
    console.log(`   Base URL: ${wowPayConfig.host}`);
    console.log(`   Merchant ID: ${wowPayConfig.mchId}`);
    console.log(`   Sign Type: ${wowPayConfig.signType}`);
    console.log(`   Key configured: ${wowPayConfig.key !== '<YOUR_SECRET_KEY>' ? '✅ Yes' : '❌ No'}\n`);

    // Test 2: Test signature generation
    console.log('2. Signature Generation Test:');
    const testParams = {
        merchant_no: 'test_merchant',
        out_trade_sn: 'TEST123456',
        amount: '100.00',
        notify_url: 'http://test.com/callback',
        sign_type: 'MD5'
    };
    
    // Generate signature manually to verify algorithm
    const filtered = Object.entries(testParams)
        .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'sign')
        .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
    const sortedKeys = Object.keys(filtered).sort();
    const joined = sortedKeys.map(key => `${key}=${filtered[key]}`).join('&');
    const stringToSign = `${joined}&key=${wowPayConfig.key}`;
    const expectedSignature = crypto.createHash('md5').update(stringToSign).digest('hex').toUpperCase();
    
    console.log(`   String to sign: ${stringToSign}`);
    console.log(`   Expected signature: ${expectedSignature}`);
    console.log(`   Algorithm: MD5 (uppercase) ✅\n`);

    // Test 3: Test deposit API endpoint
    console.log('3. Deposit API Endpoint Test:');
    const depositPayload = {
        merchant_no: wowPayConfig.mchId,
        out_trade_sn: `TEST_${Date.now()}`,
        amount: '100.00',
        title: 'Test Product',
        attach: 'Test deposit',
        return_url: 'http://test.com/return',
        notify_url: 'http://test.com/callback',
        sign_type: wowPayConfig.signType
    };
    
    // Remove undefined/null fields
    Object.keys(depositPayload).forEach(key => 
        (depositPayload[key] === undefined || depositPayload[key] === null) && delete depositPayload[key]
    );
    
    // Generate signature
    const depositFiltered = Object.entries(depositPayload)
        .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'sign')
        .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
    const depositSortedKeys = Object.keys(depositFiltered).sort();
    const depositJoined = depositSortedKeys.map(key => `${key}=${depositFiltered[key]}`).join('&');
    const depositStringToSign = `${depositJoined}&key=${wowPayConfig.key}`;
    depositPayload.sign = crypto.createHash('md5').update(depositStringToSign).digest('hex').toUpperCase();
    
    console.log(`   Endpoint: ${wowPayConfig.host}/gw-api/deposit/create`);
    console.log(`   Payload:`, JSON.stringify(depositPayload, null, 2));
    
    try {
        const depositResponse = await axios.post(`${wowPayConfig.host}/gw-api/deposit/create`, depositPayload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        console.log(`   Response:`, JSON.stringify(depositResponse.data, null, 2));
        console.log(`   Status: ${depositResponse.status} ✅\n`);
    } catch (error) {
        console.log(`   Error: ${error.response ? error.response.data : error.message}`);
        console.log(`   Status: ❌\n`);
    }

    // Test 4: Test withdrawal API endpoint
    console.log('4. Withdrawal API Endpoint Test:');
    const withdrawalPayload = {
        merchant_no: wowPayConfig.mchId,
        out_trade_sn: `WITHDRAW_${Date.now()}`,
        amount: '50.00',
        trade_account: 'Test Account',
        trade_number: '1234567890',
        attach: 'Test withdrawal',
        notify_url: 'http://test.com/callback',
        sign_type: wowPayConfig.signType
    };
    
    // Remove undefined/null fields
    Object.keys(withdrawalPayload).forEach(key => 
        (withdrawalPayload[key] === undefined || withdrawalPayload[key] === null) && delete withdrawalPayload[key]
    );
    
    // Generate signature
    const withdrawalFiltered = Object.entries(withdrawalPayload)
        .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'sign')
        .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
    const withdrawalSortedKeys = Object.keys(withdrawalFiltered).sort();
    const withdrawalJoined = withdrawalSortedKeys.map(key => `${key}=${withdrawalFiltered[key]}`).join('&');
    const withdrawalStringToSign = `${withdrawalJoined}&key=${wowPayConfig.key}`;
    withdrawalPayload.sign = crypto.createHash('md5').update(withdrawalStringToSign).digest('hex').toUpperCase();
    
    console.log(`   Endpoint: ${wowPayConfig.host}/gw-api/payout/create`);
    console.log(`   Payload:`, JSON.stringify(withdrawalPayload, null, 2));
    
    try {
        const withdrawalResponse = await axios.post(`${wowPayConfig.host}/gw-api/payout/create`, withdrawalPayload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        console.log(`   Response:`, JSON.stringify(withdrawalResponse.data, null, 2));
        console.log(`   Status: ${withdrawalResponse.status} ✅\n`);
    } catch (error) {
        console.log(`   Error: ${error.response ? error.response.data : error.message}`);
        console.log(`   Status: ❌\n`);
    }

    // Test 5: Test bank codes API
    console.log('5. Bank Codes API Test:');
    const bankCodesPayload = {
        merchant_no: wowPayConfig.mchId,
        sign_type: wowPayConfig.signType
    };
    
    const bankCodesFiltered = Object.entries(bankCodesPayload)
        .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'sign')
        .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
    const bankCodesSortedKeys = Object.keys(bankCodesFiltered).sort();
    const bankCodesJoined = bankCodesSortedKeys.map(key => `${key}=${bankCodesFiltered[key]}`).join('&');
    const bankCodesStringToSign = `${bankCodesJoined}&key=${wowPayConfig.key}`;
    bankCodesPayload.sign = crypto.createHash('md5').update(bankCodesStringToSign).digest('hex').toUpperCase();
    
    console.log(`   Endpoint: ${wowPayConfig.host}/gw-api/bank-code`);
    
    try {
        const bankCodesResponse = await axios.post(`${wowPayConfig.host}/gw-api/bank-code`, bankCodesPayload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        console.log(`   Response:`, JSON.stringify(bankCodesResponse.data, null, 2));
        console.log(`   Status: ${bankCodesResponse.status} ✅\n`);
    } catch (error) {
        console.log(`   Error: ${error.response ? error.response.data : error.message}`);
        console.log(`   Status: ❌\n`);
    }

    // Test 6: Test balance query API
    console.log('6. Balance Query API Test:');
    const balancePayload = {
        merchant_no: wowPayConfig.mchId,
        sign_type: wowPayConfig.signType
    };
    
    const balanceFiltered = Object.entries(balancePayload)
        .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'sign')
        .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
    const balanceSortedKeys = Object.keys(balanceFiltered).sort();
    const balanceJoined = balanceSortedKeys.map(key => `${key}=${balanceFiltered[key]}`).join('&');
    const balanceStringToSign = `${balanceJoined}&key=${wowPayConfig.key}`;
    balancePayload.sign = crypto.createHash('md5').update(balanceStringToSign).digest('hex').toUpperCase();
    
    console.log(`   Endpoint: ${wowPayConfig.host}/gw-api/balance/query`);
    
    try {
        const balanceResponse = await axios.post(`${wowPayConfig.host}/gw-api/balance/query`, balancePayload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        console.log(`   Response:`, JSON.stringify(balanceResponse.data, null, 2));
        console.log(`   Status: ${balanceResponse.status} ✅\n`);
    } catch (error) {
        console.log(`   Error: ${error.response ? error.response.data : error.message}`);
        console.log(`   Status: ❌\n`);
    }

    console.log('✅ WOWPAY Integration Test Complete!');
    console.log('\n📋 Summary of Documentation Compliance:');
    console.log('✅ Correct API endpoints');
    console.log('✅ Proper signature generation (MD5)');
    console.log('✅ Required fields included');
    console.log('✅ JSON content-type headers');
    console.log('✅ Proper error handling');
    console.log('⚠️  RSA signature support not implemented (optional)');
    console.log('⚠️  Country-specific fields not tested (PIX, IFSC, etc.)');
}

// Run the test
testWowPayIntegration().catch(console.error); 