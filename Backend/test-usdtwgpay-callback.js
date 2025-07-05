require('dotenv').config();
const crypto = require('crypto');
const axios = require('axios');
const usdtwgPayConfig = require('./config/usdtwgPayConfig');

/**
 * Generate HMAC-SHA256 signature for USDT WG Pay callback
 */
function generateCallbackSignature(method, urlPath, accessKey, timestamp, nonce, accessSecret) {
  const signatureData = `${method.toUpperCase()}&${urlPath}&${accessKey}&${timestamp}&${nonce}`;
  const hmac = crypto.createHmac('sha256', accessSecret);
  hmac.update(signatureData);
  return hmac.digest('base64');
}

/**
 * Test USDT WG Pay callback with specific order details
 */
async function testUsdtwgPayCallback(orderId, gatewayOrderNo, amount, status = 'success') {
  console.log('🧪 USDT WG Pay Callback Test');
  console.log('='.repeat(50));
  
  // Check if config is properly set
  if (!usdtwgPayConfig.accessKey || !usdtwgPayConfig.accessSecret) {
    console.log('❌ Error: Access key or secret not configured');
    console.log('Please set USDTWG_PAY_ACCESS_KEY and USDTWG_PAY_ACCESS_SECRET in your .env file');
    return;
  }
  
  // Generate callback parameters
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2, 10);
  const method = 'POST';
  const urlPath = '/api/payments/usdtwgpay/payin-callback';
  const callbackUrl = 'https://api.strikecolor1.com/api/payments/usdtwgpay/payin-callback';
  
  // Generate signature
  const signature = generateCallbackSignature(method, urlPath, usdtwgPayConfig.accessKey, timestamp, nonce, usdtwgPayConfig.accessSecret);
  
  // Prepare callback body
  const callbackBody = {
    merchantorder: orderId,
    orderno: gatewayOrderNo,
    amount: amount,
    status: status,
    timestamp: timestamp
  };
  
  console.log('📋 Callback Parameters:');
  console.log('  - Order ID:', orderId);
  console.log('  - Gateway Order No:', gatewayOrderNo);
  console.log('  - Amount:', amount);
  console.log('  - Status:', status);
  console.log('  - Callback URL:', callbackUrl);
  
  console.log('\n🔐 Signature Details:');
  console.log('  - Method:', method);
  console.log('  - URL Path:', urlPath);
  console.log('  - Access Key:', usdtwgPayConfig.accessKey);
  console.log('  - Timestamp:', timestamp);
  console.log('  - Nonce:', nonce);
  console.log('  - Signature Data:', `${method}&${urlPath}&${usdtwgPayConfig.accessKey}&${timestamp}&${nonce}`);
  console.log('  - Generated Signature:', signature);
  
  console.log('\n📦 Callback Body:');
  console.log(JSON.stringify(callbackBody, null, 2));
  
  console.log('\n🧪 Making Test Callback Request...');
  
  try {
    const response = await axios.post(callbackUrl, callbackBody, {
      headers: {
        'Content-Type': 'application/json',
        'accesskey': usdtwgPayConfig.accessKey,
        'timestamp': timestamp,
        'nonce': nonce,
        'sign': signature
      },
      timeout: 10000
    });
    
    console.log('\n✅ Callback Response:');
    console.log('  - Status:', response.status);
    console.log('  - Data:', response.data);
    
  } catch (error) {
    console.log('\n❌ Callback Error:');
    if (error.response) {
      console.log('  - Status:', error.response.status);
      console.log('  - Data:', error.response.data);
    } else {
      console.log('  - Error:', error.message);
    }
  }
  
  console.log('\n📝 cURL Command for Manual Testing:');
  console.log(`curl -X POST "${callbackUrl}" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -H "accesskey: ${usdtwgPayConfig.accessKey}" \\`);
  console.log(`  -H "timestamp: ${timestamp}" \\`);
  console.log(`  -H "nonce: ${nonce}" \\`);
  console.log(`  -H "sign: ${signature}" \\`);
  console.log(`  -d '${JSON.stringify(callbackBody)}'`);
}

// Test with the exact order from your logs
async function testSpecificOrder() {
  console.log('🎯 Testing with your specific order details:');
  console.log('Order ID: PIUS175140176207413');
  console.log('Gateway Order No: 20250702015922534018717');
  console.log('Amount: 10.75268817204301');
  console.log('');
  
  await testUsdtwgPayCallback(
    'PIUS175140176207413',
    '20250702015922534018717', 
    '10.75268817204301',
    'success'
  );
}

// Example usage
if (require.main === module) {
  const testOrderId = process.argv[2] || 'PIUS175140176207413';
  const testGatewayOrderNo = process.argv[3] || '20250702015922534018717';
  const testAmount = process.argv[4] || '10.75268817204301';
  
  console.log('Usage: node test-usdtwgpay-callback.js [orderId] [gatewayOrderNo] [amount]');
  console.log('Example: node test-usdtwgpay-callback.js PIUS175140176207413 20250702015922534018717 10.75268817204301');
  console.log('');
  
  if (process.argv.length === 2) {
    // No arguments provided, test with specific order
    testSpecificOrder();
  } else {
    // Use provided arguments
    testUsdtwgPayCallback(testOrderId, testGatewayOrderNo, testAmount);
  }
}

module.exports = { testUsdtwgPayCallback }; 