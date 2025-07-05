const axios = require('axios');

// Test USDT WG Pay deposit
async function testUsdtwgPayDeposit() {
  const baseUrl = 'http://api.strikecolor1.com';
  const depositUrl = `${baseUrl}/api/payments/payin`;
  
  // Test data
  const testData = {
    amount: 1000, // Amount in INR
    gateway: 'USDTWGPAY',
    pay_type: 'USDT'
  };
  
  // You'll need to get a valid token from login
  const token = 'YOUR_JWT_TOKEN_HERE'; // Replace with actual token
  
  console.log('🔗 USDT WG PAY DEPOSIT TEST');
  console.log('='.repeat(50));
  console.log('URL:', depositUrl);
  console.log('Method: POST');
  console.log('Headers:');
  console.log('  Content-Type: application/json');
  console.log('  Authorization: Bearer YOUR_JWT_TOKEN_HERE');
  console.log('');
  console.log('Body (JSON):');
  console.log(JSON.stringify(testData, null, 2));
  console.log('');
  
  // Test the API call
  try {
    const response = await axios.post(depositUrl, testData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.success) {
      console.log('\n📋 POSTMAN TESTING GUIDE:');
      console.log('='.repeat(50));
      console.log('1. Open Postman');
      console.log('2. Create a new POST request');
      console.log('3. URL:', depositUrl);
      console.log('4. Headers:');
      console.log('   - Content-Type: application/json');
      console.log('   - Authorization: Bearer YOUR_JWT_TOKEN_HERE');
      console.log('5. Body (raw JSON):');
      console.log(JSON.stringify(testData, null, 2));
      console.log('');
      console.log('📝 Expected Response:');
      console.log('- success: true');
      console.log('- paymentUrl: USDT payment URL');
      console.log('- transactionId: Order ID from gateway');
      console.log('- orderId: Your order ID');
    }
    
  } catch (error) {
    console.log('❌ Error:', error.response?.data || error.message);
    console.log('');
    console.log('🔧 TROUBLESHOOTING:');
    console.log('1. Make sure you have a valid JWT token');
    console.log('2. Check if USDTWGPAY gateway is active in database');
    console.log('3. Verify USDT WG Pay configuration in usdtwgPayConfig.js');
    console.log('4. Check server logs for detailed error messages');
  }
}

// Test USDT WG Pay configuration
function testUsdtwgPayConfig() {
  console.log('🔧 USDT WG PAY CONFIGURATION CHECK');
  console.log('='.repeat(50));
  
  try {
    const config = require('./config/usdtwgPayConfig');
    console.log('✅ Config loaded successfully');
    console.log('Base URL:', config.baseUrl);
    console.log('Access Key:', config.accessKey ? 'SET' : 'NOT SET');
    console.log('Access Secret:', config.accessSecret ? 'SET' : 'NOT SET');
    console.log('Channel Code:', config.channelCode);
    console.log('Notify URL:', config.notifyUrl);
    console.log('Payout Notify URL:', config.payoutNotifyUrl);
  } catch (error) {
    console.log('❌ Config error:', error.message);
  }
}

// Run tests
console.log('🚀 USDT WG PAY TESTING');
console.log('='.repeat(50));

testUsdtwgPayConfig();
console.log('');
testUsdtwgPayDeposit(); 