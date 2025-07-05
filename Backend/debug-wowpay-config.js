const wowPayConfig = require('./config/wowPayConfig');

console.log('🔍 WowPay Configuration Debug');
console.log('============================');

console.log('Environment Variables:');
console.log('WOWPAY_MCH_ID:', process.env.WOWPAY_MCH_ID);
console.log('WOWPAY_KEY:', process.env.WOWPAY_KEY ? process.env.WOWPAY_KEY.substring(0, 10) + '...' : 'undefined');
console.log('WOWPAY_HOST:', process.env.WOWPAY_HOST);
console.log('WOWPAY_SIGN_TYPE:', process.env.WOWPAY_SIGN_TYPE);

console.log('\nLoaded Config:');
console.log('mchId:', wowPayConfig.mchId);
console.log('key:', wowPayConfig.key ? wowPayConfig.key.substring(0, 10) + '...' : 'undefined');
console.log('host:', wowPayConfig.host);
console.log('signType:', wowPayConfig.signType);

console.log('\nComparison with Test Script:');
console.log('Test script merchant_no: ruNkLnM3bncNAzd7');
console.log('Config mchId:           ', wowPayConfig.mchId);
console.log('Match:', wowPayConfig.mchId === 'ruNkLnM3bncNAzd7' ? '✅' : '❌');

console.log('\nTest script key: yyooneljwI3hEHurYvrna14zGcEElWUS');
console.log('Config key:     ', wowPayConfig.key);
console.log('Match:', wowPayConfig.key === 'yyooneljwI3hEHurYvrna14zGcEElWUS' ? '✅' : '❌');

console.log('\nTest script host: https://test.wowpay.biz');
console.log('Config host:     ', wowPayConfig.host);
console.log('Match:', wowPayConfig.host === 'https://test.wowpay.biz' ? '✅' : '❌');

// Check if using fallback values
if (wowPayConfig.mchId === "<YOUR_MERCHANT_ID>") {
    console.log('\n❌ WARNING: Using fallback merchant ID - environment variable not loaded!');
}

if (wowPayConfig.key === "<YOUR_SECRET_KEY>") {
    console.log('❌ WARNING: Using fallback key - environment variable not loaded!');
}

if (wowPayConfig.host === "https://test.wowpay.biz" && !process.env.WOWPAY_HOST) {
    console.log('ℹ️ INFO: Using default host (this is OK)');
} 