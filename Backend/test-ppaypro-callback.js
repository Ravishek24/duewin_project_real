const axios = require('axios');
const crypto = require('crypto');

// PPayPro configuration (use your actual config)
const ppayProConfig = {
    mchNo: 'your_mch_no',
    appId: 'your_app_id',
    key: 'your_private_key'
};

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
    return crypto.createHash('md5').update(stringToSign).digest('hex').toUpperCase();
}

// Test callback payloads
const testCallbacks = [
    {
        name: 'Successful Deposit Callback',
        data: {
            payOrderId: 'PPAY123456789',
            mchOrderNo: 'ORDER123456',
            amount: '10000', // 100 rupees in paisa
            state: '2', // 2 = Success
            currency: 'INR',
            createdAt: Date.now(),
            successTime: Date.now()
        }
    },
    {
        name: 'Failed Deposit Callback',
        data: {
            payOrderId: 'PPAY123456790',
            mchOrderNo: 'ORDER123457',
            amount: '5000', // 50 rupees in paisa
            state: '3', // 3 = Failed
            currency: 'INR',
            createdAt: Date.now()
        }
    },
    {
        name: 'Successful Withdrawal Callback',
        data: {
            transferId: 'TRANS123456789',
            mchOrderNo: 'WITHDRAW123456',
            amount: '20000', // 200 rupees in paisa
            state: '2', // 2 = Success
            voucher: 'UTR123456789',
            createdAt: Date.now(),
            successTime: Date.now()
        }
    }
];

async function sendTestCallback(callbackData, callbackType = 'deposit') {
    try {
        // Generate signature
        const signature = generatePpayProSignature(callbackData);
        callbackData.sign = signature;
        
        console.log(`\n📤 Sending ${callbackType} callback:`);
        console.log('Payload:', JSON.stringify(callbackData, null, 2));
        console.log('Generated Signature:', signature);
        
        // Determine endpoint based on callback type
        const endpoint = callbackType === 'withdrawal' 
            ? 'https://api.strikecolor1.com/api/payments/ppaypro/payout-callback'
            : 'https://api.strikecolor1.com/api/payments/ppaypro/payin-callback';
        
        // Send callback
        const response = await axios.post(endpoint, callbackData, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            transformRequest: [function (data) {
                // Convert object to URL-encoded string
                return Object.keys(data)
                    .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(data[key]))
                    .join('&');
            }]
        });
        
        console.log('✅ Response Status:', response.status);
        console.log('✅ Response Data:', response.data);
        
        return { success: true, response: response.data };
        
    } catch (error) {
        console.error('❌ Error sending callback:', error.message);
        if (error.response) {
            console.error('Response Status:', error.response.status);
            console.error('Response Data:', error.response.data);
        }
        return { success: false, error: error.message };
    }
}

// Main test function
async function runTests() {
    console.log('🚀 Starting PPayPro Callback Tests...\n');
    
    for (const test of testCallbacks) {
        console.log(`\n${'='.repeat(50)}`);
        console.log(`Testing: ${test.name}`);
        console.log(`${'='.repeat(50)}`);
        
        const callbackType = test.data.transferId ? 'withdrawal' : 'deposit';
        await sendTestCallback(test.data, callbackType);
        
        // Wait 2 seconds between tests
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log('\n✅ All tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = {
    generatePpayProSignature,
    sendTestCallback,
    testCallbacks
}; 