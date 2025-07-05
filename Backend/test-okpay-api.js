const axios = require('axios');

console.log('🧪 Testing OKPay via Your API Endpoint');
console.log('======================================');

async function testOkPayAPI() {
    try {
        console.log('\n📋 Test Configuration:');
        console.log('API URL: https://api.strikecolor1.com/api/payments/payin');
        console.log('Gateway: OKPAY');
        console.log('Amount: 100 INR');
        
        const testPayload = {
            amount: 100,
            gateway: 'OKPAY',
            pay_type: 'UPI'
        };
        
        console.log('\n📤 Request Payload:');
        console.log(JSON.stringify(testPayload, null, 2));
        
        console.log('\n🔍 Making API Request...');
        
        const response = await axios.post('https://api.strikecolor1.com/api/payments/payin', 
            testPayload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE' // You'll need to add a valid token
                },
                timeout: 15000
            }
        );
        
        console.log('\n📥 Response:');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));
        
        if (response.data.success) {
            console.log('\n✅ SUCCESS: OKPay payment order created via your API');
            console.log('🔗 Payment URL:', response.data.paymentUrl);
            console.log('📋 Order ID:', response.data.orderId);
            console.log('📝 Transaction ID:', response.data.transactionId);
        } else {
            console.log('\n❌ FAILED:', response.data.message);
            console.log('Error details:', response.data);
        }
        
    } catch (error) {
        console.log('\n❌ ERROR:', error.message);
        
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response data:', error.response.data);
            
            if (error.response.status === 401) {
                console.log('💡 Authentication required - add valid JWT token');
            } else if (error.response.status === 400) {
                console.log('💡 Bad request - check payload format');
            } else if (error.response.status === 500) {
                console.log('💡 Server error - check server logs');
            }
        } else if (error.code === 'ENOTFOUND') {
            console.log('💡 API endpoint not found - check URL');
        } else if (error.code === 'ECONNREFUSED') {
            console.log('💡 Connection refused - check if server is running');
        }
    }
}

// Test without authentication (will likely fail but shows the endpoint)
async function testWithoutAuth() {
    console.log('\n🔓 Testing without authentication (expected to fail)...');
    
    try {
        const response = await axios.post('https://api.strikecolor1.com/api/payments/payin', 
            { amount: 100, gateway: 'OKPAY' }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 10000,
                validateStatus: () => true
            }
        );
        
        console.log('Status:', response.status);
        console.log('Response:', response.data);
        
        if (response.status === 401) {
            console.log('✅ Expected authentication error - endpoint is working');
        }
        
    } catch (error) {
        console.log('Error:', error.message);
    }
}

async function runTests() {
    await testWithoutAuth();
    await testOkPayAPI();
    
    console.log('\n🎯 Summary:');
    console.log('===========');
    console.log('✅ OKPay API endpoint test completed');
    console.log('📋 Check the results above for any issues');
    console.log('');
    console.log('To test with authentication:');
    console.log('1. Get a valid JWT token from your login endpoint');
    console.log('2. Update the Authorization header in the test script');
    console.log('3. Run the test again');
    console.log('');
    console.log('Expected OKPay response format:');
    console.log('{');
    console.log('  "success": true,');
    console.log('  "paymentUrl": "https://sandbox.wpay.one/pay/...",');
    console.log('  "orderId": "OKPAY_TEST_...",');
    console.log('  "transactionId": "TXN_..."');
    console.log('}');
}

runTests().catch(console.error); 