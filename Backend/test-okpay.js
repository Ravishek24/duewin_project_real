const axios = require('axios');
const crypto = require('crypto');

console.log('🧪 OKPay Gateway Testing');
console.log('========================');

// OKPay Configuration (from your service)
const OKPAY_CONFIG = {
    mchId: process.env.OKPAY_MCH_ID || '1000',
    key: process.env.OKPAY_KEY || 'eb6080dbc8dc429ab86a1cd1c337975d',
    host: process.env.OKPAY_HOST || 'sandbox.wpay.one',
    currency: 'INR'
};

console.log('\n📋 Configuration:');
console.log('Merchant ID:', OKPAY_CONFIG.mchId);
console.log('API Key:', OKPAY_CONFIG.key ? '******' + OKPAY_CONFIG.key.slice(-6) : 'undefined');
console.log('Host:', OKPAY_CONFIG.host);
console.log('Currency:', OKPAY_CONFIG.currency);

/**
 * Calculate signature for OKPAY requests
 */
function calculateSignature(params) {
    // Filter out empty values and sign parameter
    const filteredParams = Object.entries(params)
        .filter(([_, value]) => value !== undefined && value !== null && value !== '' && value !== 'sign')
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    // Sort parameters by key (ASCII order)
    const sortedKeys = Object.keys(filteredParams).sort();
    
    // Create URL parameter string
    const stringA = sortedKeys.map(key => `${key}=${filteredParams[key]}`).join('&');
    
    // Append key
    const stringSignTemp = `${stringA}&key=${OKPAY_CONFIG.key}`;
    
    console.log('String to sign:', stringSignTemp);
    
    // Calculate MD5 hash and convert to lowercase
    return crypto.createHash('md5').update(stringSignTemp).digest('hex').toLowerCase();
}

async function testOkPayAPI() {
    try {
        console.log('\n🔍 Testing OKPay API Connection');
        console.log('===============================');
        
        // Test 1: Basic connectivity
        console.log('\n1. Testing API Endpoint Connectivity');
        console.log('-----------------------------------');
        
        const testUrl = `https://${OKPAY_CONFIG.host}/v1/Collect`;
        console.log('API URL:', testUrl);
        
        try {
            const response = await axios.get(`https://${OKPAY_CONFIG.host}`, {
                timeout: 10000,
                validateStatus: () => true
            });
            console.log('✅ OKPay host is accessible');
            console.log('Status:', response.status);
        } catch (error) {
            console.log('❌ OKPay host not accessible:', error.message);
            return;
        }
        
        // Test 2: Create payment order
        console.log('\n2. Testing Payment Order Creation');
        console.log('--------------------------------');
        
        const orderId = `OKPAY_TEST_${Date.now()}`;
        const amount = 100; // 100 INR
        
        const params = {
            mchId: OKPAY_CONFIG.mchId,
            currency: OKPAY_CONFIG.currency,
            out_trade_no: orderId,
            pay_type: 'UPI',
            money: amount,
            notify_url: 'https://api.strikecolor1.com/api/payments/okpay/payin-callback',
            returnUrl: 'https://api.strikecolor1.com/success',
            attach: 'userId=1'
        };

        // Calculate signature
        params.sign = calculateSignature(params);

        console.log('📤 Request Parameters:');
        console.log(JSON.stringify(params, null, 2));

        const apiUrl = `https://${OKPAY_CONFIG.host}/v1/Collect`;
        const response = await axios.post(apiUrl, new URLSearchParams(params).toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 15000
        });

        console.log('\n📥 Response:');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));

        if (response.data.code === 0) {
            console.log('\n✅ SUCCESS: Payment order created');
            console.log('🔗 Payment URL:', response.data.data?.url);
            console.log('📋 Transaction ID:', response.data.data?.transaction_Id);
            console.log('📝 Order ID:', orderId);
            
            // Test 3: Simulate callback
            console.log('\n3. Testing Callback Simulation');
            console.log('-----------------------------');
            
            const callbackData = {
                mchId: OKPAY_CONFIG.mchId,
                out_trade_no: orderId,
                transaction_Id: response.data.data?.transaction_Id || 'TEST_TXN_ID',
                money: amount,
                status: '1', // 1 = success
                attach: 'userId=1'
            };
            
            callbackData.sign = calculateSignature(callbackData);
            
            console.log('📤 Callback Data:');
            console.log(JSON.stringify(callbackData, null, 2));
            
            // Test callback endpoint
            try {
                const callbackResponse = await axios.post('https://api.strikecolor1.com/api/payments/okpay/payin-callback', 
                    callbackData, {
                        headers: { 'Content-Type': 'application/json' },
                        timeout: 10000,
                        validateStatus: () => true
                    }
                );
                
                console.log('\n📥 Callback Response:');
                console.log('Status:', callbackResponse.status);
                console.log('Data:', callbackResponse.data);
                
                if (callbackResponse.data && callbackResponse.data.success !== false) {
                    console.log('✅ Callback processed successfully');
                } else {
                    console.log('⚠️ Callback received but may have processing issues');
                }
            } catch (callbackError) {
                console.log('❌ Callback test failed:', callbackError.message);
            }
            
        } else {
            console.log('\n❌ FAILED:', response.data.msg || 'Unknown error');
            console.log('Error code:', response.data.code);
            
            // Provide guidance for common errors
            if (response.data.code === 1001) {
                console.log('💡 Error 1001: Invalid merchant ID or API key');
            } else if (response.data.code === 1002) {
                console.log('💡 Error 1002: Invalid signature');
            } else if (response.data.code === 1003) {
                console.log('💡 Error 1003: Invalid parameters');
            }
        }

    } catch (error) {
        console.log('\n❌ ERROR:', error.message);
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response data:', error.response.data);
        }
        
        if (error.code === 'ENOTFOUND') {
            console.log('💡 DNS resolution failed - check host configuration');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('💡 Connection refused - check if OKPay service is available');
        } else if (error.code === 'TIMEOUT') {
            console.log('💡 Request timeout - check network connectivity');
        }
    }
}

// Test different payment types
async function testPaymentTypes() {
    console.log('\n4. Testing Different Payment Types');
    console.log('==================================');
    
    const paymentTypes = ['UPI', 'BANK', 'WALLET'];
    const testAmount = 50;
    
    for (const payType of paymentTypes) {
        console.log(`\nTesting ${payType} payment...`);
        
        try {
            const orderId = `OKPAY_${payType}_${Date.now()}`;
            
            const params = {
                mchId: OKPAY_CONFIG.mchId,
                currency: OKPAY_CONFIG.currency,
                out_trade_no: orderId,
                pay_type: payType,
                money: testAmount,
                notify_url: 'https://api.strikecolor1.com/api/payments/okpay/payin-callback',
                returnUrl: 'https://api.strikecolor1.com/success',
                attach: `userId=1&type=${payType}`
            };

            params.sign = calculateSignature(params);

            const apiUrl = `https://${OKPAY_CONFIG.host}/v1/Collect`;
            const response = await axios.post(apiUrl, new URLSearchParams(params).toString(), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                timeout: 10000
            });

            if (response.data.code === 0) {
                console.log(`✅ ${payType} payment order created successfully`);
                console.log(`   Payment URL: ${response.data.data?.url}`);
            } else {
                console.log(`❌ ${payType} payment failed: ${response.data.msg}`);
            }
            
        } catch (error) {
            console.log(`❌ ${payType} payment error: ${error.message}`);
        }
    }
}

async function runTests() {
    await testOkPayAPI();
    await testPaymentTypes();
    
    console.log('\n🎯 Summary:');
    console.log('===========');
    console.log('✅ OKPay API integration test completed');
    console.log('📋 Check the results above for any issues');
    console.log('🔗 Test payment URLs were generated (if successful)');
    console.log('📞 Callback endpoints were tested');
    console.log('');
    console.log('Next steps:');
    console.log('1. Use the generated payment URLs to test actual payments');
    console.log('2. Monitor server logs for callback processing');
    console.log('3. Check database for payment record creation');
}

runTests().catch(console.error); 