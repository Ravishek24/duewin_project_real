console.log('🔍 OKPay Configuration Check');
console.log('============================');

console.log('\n📋 Environment Variables:');
console.log('OKPAY_MCH_ID:', process.env.OKPAY_MCH_ID || '(not set - using default: 1000)');
console.log('OKPAY_KEY:', process.env.OKPAY_KEY ? '******' + process.env.OKPAY_KEY.slice(-6) : '(not set - using default)');
console.log('OKPAY_HOST:', process.env.OKPAY_HOST || '(not set - using default: sandbox.wpay.one)');

console.log('\n📋 Current Configuration:');
const config = {
    mchId: process.env.OKPAY_MCH_ID || '1000',
    key: process.env.OKPAY_KEY || 'eb6080dbc8dc429ab86a1cd1c337975d',
    host: process.env.OKPAY_HOST || 'sandbox.wpay.one',
    currency: 'INR'
};

console.log('Merchant ID:', config.mchId);
console.log('API Key:', '******' + config.key.slice(-6));
console.log('Host:', config.host);
console.log('Currency:', config.currency);

console.log('\n🔗 API Endpoints:');
console.log('Payment URL:', `https://${config.host}/v1/Collect`);
console.log('Callback URL:', 'https://api.strikecolor1.com/api/payments/okpay/payin-callback');

console.log('\n📝 Test Parameters:');
console.log('Amount: 100 INR (integer)');
console.log('Payment Type: UPI, BANK, WALLET');
console.log('Currency: INR');

console.log('\n🎯 Expected Response:');
console.log('Success: { "code": 0, "data": { "url": "...", "transaction_Id": "..." } }');
console.log('Error: { "code": 1001, "msg": "Invalid merchant ID" }');

console.log('\n💡 Common Error Codes:');
console.log('1001: Invalid merchant ID or API key');
console.log('1002: Invalid signature');
console.log('1003: Invalid parameters');
console.log('1004: Insufficient balance');
console.log('1005: Payment type not supported');

console.log('\n🚀 Ready to test OKPay integration!'); 