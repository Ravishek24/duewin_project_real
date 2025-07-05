const axios = require('axios');
const crypto = require('crypto');

// Import the actual PPayPro config
const ppayProConfig = require('./config/ppayProConfig');

console.log('🔧 PPayPro Config:', {
    mchNo: ppayProConfig.mchNo,
    appId: ppayProConfig.appId,
    key: ppayProConfig.key ? 'Present' : 'Missing',
    host: ppayProConfig.host
});

// Generate PPayPro signature (MD5, uppercase)
function generatePpayProSignature(params, privateKey = ppayProConfig.key) {
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
    
    console.log('🔍 Signature Generation Debug:');
    console.log('  - Filtered params:', filtered);
    console.log('  - Sorted keys:', sortedKeys);
    console.log('  - String to sign:', stringToSign);
    console.log('  - Generated signature:', signature);
    
    return signature;
}

// Test with a simple callback first
async function testSimpleCallback() {
    console.log('\n🧪 Testing Simple Callback...');
    
    const simpleData = {
        payOrderId: 'TEST123',
        mchOrderNo: 'ORDER123',
        amount: '1000',
        state: '2'
    };
    
    const signature = generatePpayProSignature(simpleData);
    simpleData.sign = signature;
    
    console.log('📤 Sending simple callback:');
    console.log('Payload:', JSON.stringify(simpleData, null, 2));
    
    try {
        const response = await axios.post('https://api.strikecolor1.com/api/payments/ppaypro/payin-callback', 
            simpleData, {
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
    }
}

// Test with database order that exists
async function testWithExistingOrder() {
    console.log('\n🧪 Testing with Database Order...');
    
    // First, let's create a test order in the database
    const { WalletRecharge } = require('./models');
    
    try {
        // Create a test recharge record
        const testOrder = await WalletRecharge.create({
            user_id: 1, // Use a valid user ID
            amount: 10.00, // 10 rupees
            payment_gateway_id: 1, // Use a valid gateway ID
            status: 'pending',
            order_id: 'TEST_ORDER_123',
            transaction_id: 'TEST_TXN_123'
        });
        
        console.log('✅ Created test order:', testOrder.order_id);
        
        // Now send callback for this order
        const callbackData = {
            payOrderId: 'TEST_TXN_123',
            mchOrderNo: 'TEST_ORDER_123',
            amount: '1000', // 10 rupees in paisa
            state: '2', // Success
            currency: 'INR'
        };
        
        const signature = generatePpayProSignature(callbackData);
        callbackData.sign = signature;
        
        console.log('📤 Sending callback for existing order:');
        console.log('Payload:', JSON.stringify(callbackData, null, 2));
        
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
            console.error('❌ Error details:', error.response.data);
        }
    }
}

// Test signature verification
async function testSignatureVerification() {
    console.log('\n🔐 Testing Signature Verification...');
    
    const testData = {
        payOrderId: 'SIG_TEST_123',
        mchOrderNo: 'SIG_ORDER_123',
        amount: '5000',
        state: '2'
    };
    
    // Generate signature with correct key
    const correctSignature = generatePpayProSignature(testData);
    
    // Test with correct signature
    testData.sign = correctSignature;
    console.log('✅ Testing with correct signature:', correctSignature);
    
    try {
        const response = await axios.post('https://api.strikecolor1.com/api/payments/ppaypro/payin-callback', 
            testData, {
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
        
        console.log('✅ Correct signature response:', response.status, response.data);
        
    } catch (error) {
        console.error('❌ Correct signature error:', error.response?.status, error.response?.data);
    }
    
    // Test with wrong signature
    testData.sign = 'WRONG_SIGNATURE_123';
    console.log('❌ Testing with wrong signature:', testData.sign);
    
    try {
        const response = await axios.post('https://api.strikecolor1.com/api/payments/ppaypro/payin-callback', 
            testData, {
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
        
        console.log('✅ Wrong signature response:', response.status, response.data);
        
    } catch (error) {
        console.error('❌ Wrong signature error:', error.response?.status, error.response?.data);
    }
}

// Main test function
async function runDebugTests() {
    console.log('🚀 Starting PPayPro Callback Debug Tests...\n');
    
    await testSimpleCallback();
    await testSignatureVerification();
    await testWithExistingOrder();
    
    console.log('\n✅ All debug tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runDebugTests().catch(console.error);
}

module.exports = {
    generatePpayProSignature,
    testSimpleCallback,
    testSignatureVerification,
    testWithExistingOrder
}; 