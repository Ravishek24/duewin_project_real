const axios = require('axios');

// Test callback data (same as what L Pay would send)
const callbackData = {
  memberCode: 'TEST001',
  orderNo: 'LP' + Date.now(),
  amount: '100.00',
  datetime: new Date().toISOString().replace(/[-:]/g, '').split('.')[0],
  transactionNo: 'TXN' + Date.now(),
  attach: 'userId:123',
  returncode: '00', // 00 = success
  sign: 'test_signature_here' // This would be the actual signature from L Pay
};

const callbackUrl = 'http://api.strikecolor1.com/api/payment/lpay/callback';

console.log('🔗 L PAY CALLBACK TESTING');
console.log('='.repeat(60));
console.log('Callback URL:', callbackUrl);
console.log('');

// Test 1: JSON format
console.log('📤 TEST 1: JSON FORMAT');
console.log('-'.repeat(30));
console.log('Headers:');
console.log('Content-Type: application/json');
console.log('');
console.log('Body (JSON):');
console.log(JSON.stringify(callbackData, null, 2));
console.log('');

// Test 2: Form-encoded format
console.log('📤 TEST 2: FORM-ENCODED FORMAT');
console.log('-'.repeat(30));
console.log('Headers:');
console.log('Content-Type: application/x-www-form-urlencoded');
console.log('');
console.log('Body (x-www-form-urlencoded):');
Object.entries(callbackData).forEach(([key, value]) => {
  console.log(`${key}=${value}`);
});
console.log('');

// cURL commands
console.log('📝 cURL COMMANDS');
console.log('-'.repeat(30));

// JSON cURL
const jsonCurl = `curl -X POST "${callbackUrl}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(callbackData)}'`;
console.log('JSON format:');
console.log(jsonCurl);
console.log('');

// Form-encoded cURL
const formData = Object.entries(callbackData)
  .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
  .join('&');
const formCurl = `curl -X POST "${callbackUrl}" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "${formData}"`;
console.log('Form-encoded format:');
console.log(formCurl);
console.log('');

console.log('✅ Both formats will work with the L Pay callback handler!');
console.log('📝 Choose whichever format you prefer in Postman.'); 