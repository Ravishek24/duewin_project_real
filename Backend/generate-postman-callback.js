require('dotenv').config();
const crypto = require('crypto');
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
 * Generate Postman-ready values for USDT WG Pay callback test
 */
function generatePostmanValues() {
  console.log('🧪 USDT WG Pay Callback - Postman Test Values');
  console.log('='.repeat(60));
  
  // Check if config is properly set
  if (!usdtwgPayConfig.accessKey || !usdtwgPayConfig.accessSecret) {
    console.log('❌ Error: Access key or secret not configured');
    return;
  }
  
  // Generate values
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = Math.random().toString(36).substring(2, 10);
  const method = 'POST';
  const urlPath = '/api/payments/usdtwgpay/payin-callback';  // ✅ Correct path for signature generation
  const signature = generateCallbackSignature(method, urlPath, usdtwgPayConfig.accessKey, timestamp, nonce, usdtwgPayConfig.accessSecret);
  
  console.log('📋 POSTMAN REQUEST DETAILS');
  console.log('='.repeat(40));
  
  console.log('\n🌐 URL:');
  console.log('https://api.strikecolor1.com/api/payments/usdtwgpay/payin-callback');
  
  console.log('\n📝 METHOD:');
  console.log('POST');
  
  console.log('\n🔐 HEADERS:');
  console.log('Content-Type: application/json');
  console.log('accesskey: ' + usdtwgPayConfig.accessKey);
  console.log('timestamp: ' + timestamp);
  console.log('nonce: ' + nonce);
  console.log('sign: ' + signature);
  
  console.log('\n📦 BODY (JSON):');
  const body = {
    merchantorder: "PIUS175140176207413",
    orderno: "20250702015922534018717",
    amount: "10.75268817204301",
    status: "success",
    timestamp: timestamp
  };
  console.log(JSON.stringify(body, null, 2));
  
  console.log('\n🔍 SIGNATURE DETAILS:');
  console.log('Method: ' + method);
  console.log('URL Path: ' + urlPath);
  console.log('Access Key: ' + usdtwgPayConfig.accessKey);
  console.log('Timestamp: ' + timestamp);
  console.log('Nonce: ' + nonce);
  console.log('Signature Data: ' + method + '&' + urlPath + '&' + usdtwgPayConfig.accessKey + '&' + timestamp + '&' + nonce);
  console.log('Generated Signature: ' + signature);
  
  console.log('\n📋 POSTMAN STEP-BY-STEP:');
  console.log('1. Create new POST request');
  console.log('2. Set URL: https://api.strikecolor1.com/api/payments/usdtwgpay/payin-callback');
  console.log('3. Go to Headers tab and add:');
  console.log('   - Content-Type: application/json');
  console.log('   - accesskey: ' + usdtwgPayConfig.accessKey);
  console.log('   - timestamp: ' + timestamp);
  console.log('   - nonce: ' + nonce);
  console.log('   - sign: ' + signature);
  console.log('4. Go to Body tab, select "raw" and "JSON"');
  console.log('5. Paste the JSON body above');
  console.log('6. Click Send');
  
  console.log('\n✅ Expected Response:');
  console.log('- Status: 200 OK');
  console.log('- Body: {"success": true} or similar success response');
  console.log('- Check your server logs for callback processing details');
  
  console.log('\n📊 Database Changes Expected:');
  console.log('- WalletRecharge record updated: status = "completed"');
  console.log('- User wallet balance increased by ₹1000');
  console.log('- Transaction ID updated with gateway order number');
  
  console.log('='.repeat(60));
}

// Run the generator
if (require.main === module) {
  generatePostmanValues();
}

module.exports = { generatePostmanValues }; 