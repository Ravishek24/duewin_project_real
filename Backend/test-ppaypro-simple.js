const axios = require('axios');
const crypto = require('crypto');

// Test PPayPro credentials (replace with your actual values)
const testConfig = {
    mchNo: 'test_mch_no', // Replace with your actual merchant number
    appId: 'test_app_id', // Replace with your actual app ID
    key: 'test_key_123', // Replace with your actual private key
    host: 'https://pay.ppaypros.com'
};

console.log('🔧 Test PPayPro Config:', {
    mchNo: testConfig.mchNo,
    appId: testConfig.appId,
    key: testConfig.key ? 'Present' : 'Missing',
    host: testConfig.host
});

// Generate PPayPro signature (MD5, uppercase)
function generatePpayProSignature(params, privateKey = testConfig.key) {
    // 1. Filter out undefined/null/empty values and 'sign' key
    const filtered = Object.entries(params)
        .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'sign')
        .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
    
    // 2. Sort keys by ASCII order
    const sortedKeys = Object.keys(filtered).sort();
    
    // 3. Join as key=value&key=value
    const joined = sortedKeys.map(key => `${key}=${filtered[key]}`).join('&');
    
    // 4. Append &key=PRIVATE_KEY
    const stringToSign = `${joined}&key=${privateKey}`;
    
    // 5. MD5 hash, uppercase
    const signature = crypto.createHash('md5').update(stringToSign).digest('hex').toUpperCase();
    
    console.log('🔍 Signature Generation:');
    console.log('  - String to sign:', stringToSign);
    console.log('  - Generated signature:', signature);
    
    return signature;
}

// Test callback with proper signature
async function testCallback() {
    console.log('\n🧪 Testing PPayPro Callback...');
    
    const callbackData = {
        payOrderId: 'TEST_PAY_123',
        mchOrderNo: 'TEST_ORDER_123',
        amount: '1000', // 10 rupees in paisa
        state: '2', // Success
        currency: 'INR'
    };
    
    const signature = generatePpayProSignature(callbackData);
    callbackData.sign = signature;
    
    console.log('📤 Sending callback:');
    console.log('Payload:', JSON.stringify(callbackData, null, 2));
    
    try {
        const response = await axios.post('https://api.strikecolor1.com/api/payments/ppaypro/payin-callback', 
            callbackData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                transformRequest: [function (data) {
                    return Object.keys(data)
                        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(data[key]))
                        .join('&');
                }]
            }
        );
        
        console.log('✅ Response Status:', response.status);
        console.log('✅ Response Data:', response.data);
        
    } catch (error) {
        console.error('❌ Error:', error.response?.status, error.response?.data);
        if (error.response?.data) {
            console.error('❌ Full error response:', error.response.data);
        }
    }
}

// Test withdrawal callback
async function testWithdrawalCallback() {
    console.log('\n🧪 Testing PPayPro Withdrawal Callback...');
    
    const callbackData = {
        transferId: 'TEST_TRANSFER_123',
        mchOrderNo: 'TEST_WITHDRAW_123',
        amount: '2000', // 20 rupees in paisa
        state: '2', // Success
        voucher: 'UTR123456789'
    };
    
    const signature = generatePpayProSignature(callbackData);
    callbackData.sign = signature;
    
    console.log('📤 Sending withdrawal callback:');
    console.log('Payload:', JSON.stringify(callbackData, null, 2));
    
    try {
        const response = await axios.post('https://api.strikecolor1.com/api/payments/ppaypro/payout-callback', 
            callbackData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                transformRequest: [function (data) {
                    return Object.keys(data)
                        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(data[key]))
                        .join('&');
                }]
            }
        );
        
        console.log('✅ Response Status:', response.status);
        console.log('✅ Response Data:', response.data);
        
    } catch (error) {
        console.error('❌ Error:', error.response?.status, error.response?.data);
        if (error.response?.data) {
            console.error('❌ Full error response:', error.response.data);
        }
    }
}

// Main test function
async function runTests() {
    console.log('🚀 Starting PPayPro Simple Tests...\n');
    
    await testCallback();
    await testWithdrawalCallback();
    
    console.log('\n✅ All tests completed!');
    console.log('\n📝 Note: If you get "fail" responses, it means:');
    console.log('   - The callback reached the server successfully');
    console.log('   - But signature verification or order lookup failed');
    console.log('   - This is expected for test data without real orders');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = {
    generatePpayProSignature,
    testCallback,
    testWithdrawalCallback
}; 