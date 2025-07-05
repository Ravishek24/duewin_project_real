const axios = require('axios');

console.log('🧪 Testing WowPay Callback Handler');
console.log('==================================');

// The exact callback data you received from WowPay
const callbackData = {
    "merchant_no": "ruNkLnM3bncNAzd7",
    "out_trade_sn": "PIWO175112611525513",
    "title": null,
    "amount": "1000.00",
    "attach": null,
    "return_url": null,
    "notify_url": "https://api.strikecolor1.com/api/payments/wowpay/payin-callback",
    "sign_type": "MD5",
    "user_name": null,
    "bank_card_no": null
};

console.log('\n📥 Callback Data to Test:');
console.log(JSON.stringify(callbackData, null, 2));

// Test the callback endpoint
async function testCallback() {
    try {
        console.log('\n🚀 Sending callback to your endpoint...');
        
        const response = await axios.post('http://localhost:3000/api/payments/wowpay/payin-callback', callbackData, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'WowPay-Callback-Test'
            },
            timeout: 10000
        });
        
        console.log('\n✅ Callback Response:');
        console.log('Status:', response.status);
        console.log('Headers:', response.headers);
        console.log('Data:', response.data);
        
    } catch (error) {
        console.log('\n❌ Callback Test Failed:');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Headers:', error.response.headers);
            console.log('Data:', error.response.data);
        } else if (error.request) {
            console.log('No response received');
            console.log('Error:', error.message);
        } else {
            console.log('Error:', error.message);
        }
    }
}

// Test with different callback scenarios
async function testAllScenarios() {
    console.log('\n🧪 Testing All Callback Scenarios');
    console.log('==================================');
    
    // Scenario 1: Your received callback (no status, no signature)
    console.log('\n1️⃣ Testing: Payment Notification (Your Received Data)');
    await testCallback();
    
    // Scenario 2: Status update callback (with status and signature)
    console.log('\n2️⃣ Testing: Status Update Callback');
    const statusCallback = {
        ...callbackData,
        "trade_status": "success",
        "order_sn": "TPOLY2025062800013",
        "sign": "TEST_SIGNATURE_123"
    };
    
    try {
        const response = await axios.post('http://localhost:3000/api/payments/wowpay/payin-callback', statusCallback, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        console.log('Status Update Response:', response.data);
    } catch (error) {
        console.log('Status Update Error:', error.response?.data || error.message);
    }
    
    // Scenario 3: Failed payment callback
    console.log('\n3️⃣ Testing: Failed Payment Callback');
    const failedCallback = {
        ...callbackData,
        "trade_status": "failed",
        "order_sn": "TPOLY2025062800013",
        "sign": "TEST_SIGNATURE_456"
    };
    
    try {
        const response = await axios.post('http://localhost:3000/api/payments/wowpay/payin-callback', failedCallback, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        console.log('Failed Payment Response:', response.data);
    } catch (error) {
        console.log('Failed Payment Error:', error.response?.data || error.message);
    }
}

// Check if server is running
async function checkServer() {
    try {
        console.log('\n🔍 Checking if server is running...');
        const response = await axios.get('http://localhost:3000/api/health', { timeout: 5000 });
        console.log('✅ Server is running');
        return true;
    } catch (error) {
        console.log('❌ Server is not running or health endpoint not available');
        console.log('Please start your server first: npm start');
        return false;
    }
}

// Main execution
async function main() {
    const serverRunning = await checkServer();
    
    if (serverRunning) {
        await testAllScenarios();
    } else {
        console.log('\n💡 To test callbacks manually, you can use curl:');
        console.log('curl -X POST http://localhost:3000/api/payments/wowpay/payin-callback \\');
        console.log('  -H "Content-Type: application/json" \\');
        console.log('  -d \'' + JSON.stringify(callbackData) + '\'');
    }
    
    console.log('\n📋 Summary:');
    console.log('===========');
    console.log('1. Your callback data is missing trade_status and sign fields');
    console.log('2. This appears to be a payment notification, not a status update');
    console.log('3. The updated callback handler should now handle this gracefully');
    console.log('4. Check your server logs for detailed callback processing information');
    console.log('5. WowPay should send a separate status update callback later');
}

main().catch(console.error); 