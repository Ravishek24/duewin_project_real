const axios = require('axios');
const crypto = require('crypto');

function generateTestCallbackSignature(data, secretKey) {
    const sortedParams = {};
    Object.keys(data)
        .filter(key => key !== 'sign')
        .sort()
        .forEach(key => {
            if (data[key] !== undefined && data[key] !== null && data[key] !== '') {
                sortedParams[key] = data[key];
            }
        });

    const queryString = Object.keys(sortedParams)
        .map(key => `${key}=${sortedParams[key]}`)
        .join('&');
    
    const stringToSign = queryString + '&key=' + secretKey;
    return crypto.createHash('md5').update(stringToSign).digest('hex').toUpperCase();
}

async function testCallbackEndpoint() {
    console.log('🧪 Testing WowPay Callback Endpoint');
    console.log('===================================');
    
    const callbackUrl = 'https://api.strikecolor1.com/api/payments/wowpay/payin-callback';
    const secretKey = 'yyooneljwI3hEHurYvrna14zGcEElWUS';
    
    // Test 1: Basic connectivity
    console.log('\n1. Testing Basic Connectivity');
    console.log('-----------------------------');
    try {
        const response = await axios.post(callbackUrl, { test: 'connectivity' }, {
            timeout: 10000,
            validateStatus: () => true // Accept any status code
        });
        
        console.log('✅ Endpoint is accessible');
        console.log('Status:', response.status);
        console.log('Response:', response.data);
    } catch (error) {
        console.log('❌ Endpoint not accessible:', error.message);
        if (error.code === 'ENOTFOUND') {
            console.log('💡 DNS resolution failed - check domain configuration');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('💡 Connection refused - check if server is running');
        } else if (error.code === 'TIMEOUT') {
            console.log('💡 Request timeout - check server responsiveness');
        }
        return;
    }
    
    // Test 2: Simulate WowPay success callback
    console.log('\n2. Testing WowPay Success Callback Simulation');
    console.log('---------------------------------------------');
    
    const successCallbackData = {
        merchant_no: 'ruNkLnM3bncNAzd7',
        out_trade_sn: 'PIWOW17511245436301', // Your original order ID
        order_sn: 'TPOLY2025062800013',      // WowPay's order ID
        amount: '1000.00',
        trade_status: 'success',
        trade_time: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };
    
    // Generate signature
    successCallbackData.sign = generateTestCallbackSignature(successCallbackData, secretKey);
    
    console.log('📤 Sending success callback:');
    console.log(JSON.stringify(successCallbackData, null, 2));
    
    try {
        const response = await axios.post(callbackUrl, successCallbackData, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000,
            validateStatus: () => true
        });
        
        console.log('\n📥 Response:');
        console.log('Status:', response.status);
        console.log('Data:', response.data);
        
        if (response.data && response.data.success !== false) {
            console.log('✅ Callback processed successfully');
        } else {
            console.log('⚠️ Callback received but may have processing issues');
        }
    } catch (error) {
        console.log('❌ Error sending callback:', error.message);
    }
    
    // Test 3: Test with invalid signature
    console.log('\n3. Testing Invalid Signature Handling');
    console.log('-------------------------------------');
    
    const invalidCallbackData = {
        ...successCallbackData,
        sign: 'INVALID_SIGNATURE'
    };
    
    try {
        const response = await axios.post(callbackUrl, invalidCallbackData, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000,
            validateStatus: () => true
        });
        
        console.log('📥 Response for invalid signature:');
        console.log('Status:', response.status);
        console.log('Data:', response.data);
        
        if (response.data && response.data.message && response.data.message.includes('Invalid signature')) {
            console.log('✅ Signature validation working correctly');
        } else {
            console.log('⚠️ Signature validation may not be working');
        }
    } catch (error) {
        console.log('❌ Error testing invalid signature:', error.message);
    }
    
    console.log('\n🎯 Summary:');
    console.log('===========');
    console.log('If all tests passed, your callback endpoint is working correctly.');
    console.log('WowPay should be able to send callbacks to your server.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Monitor server logs for actual WowPay callbacks');
    console.log('2. Check database for payment record updates');
    console.log('3. Verify user wallet balance changes');
}

testCallbackEndpoint().catch(console.error); 