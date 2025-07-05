require('dotenv').config();
const usdtwgPayConfig = require('./config/usdtwgPayConfig');

console.log('🔍 USDT WG Pay Configuration Check');
console.log('='.repeat(50));

console.log('Environment Variables:');
console.log('USDTWG_PAY_BASE_URL:', process.env.USDTWG_PAY_BASE_URL || 'NOT SET');
console.log('USDTWG_PAY_ACCESS_KEY:', process.env.USDTWG_PAY_ACCESS_KEY ? 'SET' : 'NOT SET');
console.log('USDTWG_PAY_ACCESS_SECRET:', process.env.USDTWG_PAY_ACCESS_SECRET ? 'SET' : 'NOT SET');
console.log('USDTWG_PAY_CHANNEL_CODE:', process.env.USDTWG_PAY_CHANNEL_CODE || 'NOT SET');
console.log('USDTWG_PAY_NOTIFY_URL:', process.env.USDTWG_PAY_NOTIFY_URL || 'NOT SET');
console.log('USDT_TO_INR:', process.env.USDT_TO_INR || '85 (default)');

console.log('\nResolved Config:');
console.log('baseUrl:', usdtwgPayConfig.baseUrl);
console.log('accessKey:', usdtwgPayConfig.accessKey ? 'SET' : 'NOT SET');
console.log('accessSecret:', usdtwgPayConfig.accessSecret ? 'SET' : 'NOT SET');
console.log('channelCode:', usdtwgPayConfig.channelCode || 'NOT SET');
console.log('notifyUrl:', usdtwgPayConfig.notifyUrl || 'NOT SET');

console.log('\n⚠️  Issues Found:');
let issues = 0;

if (!process.env.USDTWG_PAY_ACCESS_KEY) {
  console.log('❌ USDTWG_PAY_ACCESS_KEY is not set');
  issues++;
}

if (!process.env.USDTWG_PAY_ACCESS_SECRET) {
  console.log('❌ USDTWG_PAY_ACCESS_SECRET is not set');
  issues++;
}

if (!process.env.USDTWG_PAY_CHANNEL_CODE) {
  console.log('❌ USDTWG_PAY_CHANNEL_CODE is not set');
  issues++;
}

if (!process.env.USDTWG_PAY_NOTIFY_URL) {
  console.log('❌ USDTWG_PAY_NOTIFY_URL is not set');
  issues++;
}

if (issues === 0) {
  console.log('✅ All required environment variables are set');
} else {
  console.log(`\n🔧 Please set the missing environment variables in your .env file:`);
  console.log('USDTWG_PAY_ACCESS_KEY=your_access_key');
  console.log('USDTWG_PAY_ACCESS_SECRET=your_access_secret');
  console.log('USDTWG_PAY_CHANNEL_CODE=your_channel_code');
  console.log('USDTWG_PAY_NOTIFY_URL=https://your-domain.com/api/payments/usdtwgpay/payin-callback');
} 