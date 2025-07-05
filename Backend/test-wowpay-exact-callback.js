const axios = require('axios');

console.log('🧪 Testing WowPay Exact Callback Data');
console.log('=====================================');

// The exact callback data you received from WowPay
const exactCallbackData = {
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

console.log('📥 Sending exact callback data:');
console.log(JSON.stringify(exactCallbackData, null, 2));

// Test the callback endpoint
async function testExactCallback() {
    try {
        console.log('\n🚀 Sending to your callback endpoint...');
        
        const response = await axios.post('http://localhost:3000/api/payments/wowpay/payin-callback', exactCallbackData, {
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'WowPay-Exact-Callback-Test'
            },
            timeout: 15000
        });
        
        console.log('\n✅ Success! Callback Response:');
        console.log('Status:', response.status);
        console.log('Response:', response.data);
        
    } catch (error) {
        console.log('\n❌ Callback Test Failed:');
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', error.response.data);
        } else if (error.request) {
            console.log('No response received - server might not be running');
            console.log('Error:', error.message);
        } else {
            console.log('Error:', error.message);
        }
    }
}

// Test with curl command for manual testing
function showCurlCommand() {
    console.log('\n💡 Manual Test with curl:');
    console.log('========================');
    console.log('curl -X POST http://localhost:3000/api/payments/wowpay/payin-callback \\');
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'' + JSON.stringify(exactCallbackData) + '\'');
    
    console.log('\n💡 Alternative URLs to try:');
    console.log('===========================');
    console.log('1. Local server: http://localhost:3000/api/payments/wowpay/payin-callback');
    console.log('2. Production: https://api.strikecolor1.com/api/payments/wowpay/payin-callback');
    console.log('3. Server IP: http://172.31.41.86:3000/api/payments/wowpay/payin-callback');
    console.log('4. Different port: http://localhost:5000/api/payments/wowpay/payin-callback');
}

// Check server status on multiple URLs
async function checkServer() {
    const urls = [
        'http://localhost:3000/api/health',
        'http://localhost:3000/',
        'http://172.31.41.86:3000/api/health',
        'http://172.31.41.86:3000/',
        'http://localhost:5000/api/health',
        'http://localhost:5000/'
    ];
    
    for (const url of urls) {
        try {
            console.log(`🔍 Checking: ${url}`);
            const response = await axios.get(url, { timeout: 5000 });
            console.log(`✅ Server running at: ${url}`);
            return url.replace('/api/health', '').replace('/', '');
        } catch (error) {
            console.log(`❌ Not available: ${url}`);
        }
    }
    return null;
}

async function main() {
    console.log('🔍 Checking server status...');
    const serverUrl = await checkServer();
    
    if (serverUrl) {
        console.log(`\n✅ Server found at: ${serverUrl}`);
        console.log('🚀 Testing callback...');
        
        // Update the callback URL to use the found server
        const callbackUrl = `${serverUrl}/api/payments/wowpay/payin-callback`;
        console.log(`📡 Using callback URL: ${callbackUrl}`);
        
        try {
            const response = await axios.post(callbackUrl, exactCallbackData, {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'WowPay-Exact-Callback-Test'
                },
                timeout: 15000
            });
            
            console.log('\n✅ Success! Callback Response:');
            console.log('Status:', response.status);
            console.log('Response:', response.data);
            
        } catch (error) {
            console.log('\n❌ Callback Test Failed:');
            if (error.response) {
                console.log('Status:', error.response.status);
                console.log('Response:', error.response.data);
            } else if (error.request) {
                console.log('No response received');
                console.log('Error:', error.message);
            } else {
                console.log('Error:', error.message);
            }
        }
    } else {
        console.log('\n❌ No server found on common ports');
        console.log('Please start your server first: npm start');
        showCurlCommand();
    }
    
    console.log('\n📋 Expected Behavior:');
    console.log('====================');
    console.log('1. Callback should be accepted (no signature verification)');
    console.log('2. Order should be found in database (if exists)');
    console.log('3. No status update (this is just a notification)');
    console.log('4. Response should be: {"success": true, "message": "success"}');
    console.log('5. Check server logs for detailed processing information');
    
    console.log('\n🔧 Next Steps:');
    console.log('==============');
    console.log('1. Start your server: npm start');
    console.log('2. Run this test again: node test-wowpay-exact-callback.js');
    console.log('3. Check database: node check-wowpay-order.js');
    console.log('4. Monitor server logs for callback processing');
}

main().catch(console.error);