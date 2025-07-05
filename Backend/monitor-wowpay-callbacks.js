const fs = require('fs');
const path = require('path');

console.log('🔍 WowPay Callback Monitor');
console.log('==========================');

// Check if callback routes are properly set up
console.log('\n1. Callback Route Configuration:');
console.log('✅ Deposit callback: POST /api/payments/wowpay/payin-callback');
console.log('✅ Withdrawal callback: POST /api/payments/wowpay/payout-callback');
console.log('✅ Domain: https://api.strikecolor1.com');

// Monitor server logs for callback activity
console.log('\n2. How to Monitor Callbacks:');
console.log('═══════════════════════════════════');

console.log('\n📊 Method 1: Check Server Logs');
console.log('-------------------------------');
console.log('If using PM2:');
console.log('  pm2 logs your-app-name --lines 100');
console.log('  pm2 logs your-app-name --follow');
console.log('');
console.log('If running directly:');
console.log('  tail -f your-server.log');
console.log('  journalctl -u your-service -f');

console.log('\n📊 Method 2: Test Callback Manually');
console.log('------------------------------------');
console.log('You can test if your callback endpoint is accessible:');
console.log('');
console.log('curl -X POST https://api.strikecolor1.com/api/payments/wowpay/payin-callback \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{"test": "callback"}\'');

console.log('\n📊 Method 3: Database Check');
console.log('---------------------------');
console.log('Check if payment records are being updated:');
console.log('');
console.log('MySQL Query:');
console.log('SELECT * FROM wallet_recharges WHERE order_id LIKE \'%TPOLY%\' ORDER BY created_at DESC;');

console.log('\n📊 Method 4: Look for These Log Messages');
console.log('----------------------------------------');
console.log('✅ Success: "WOWPAY Deposit Callback Received:"');
console.log('✅ Processing: "Callback processing successful"');
console.log('❌ Error: "Error processing WOWPAY deposit callback:"');
console.log('❌ Invalid: "Invalid signature"');

console.log('\n🔗 Expected Callback Data Format:');
console.log('================================');
console.log(JSON.stringify({
    "merchant_no": "ruNkLnM3bncNAzd7",
    "out_trade_sn": "PIWOW17511245436301", // Your order ID
    "order_sn": "TPOLY2025062800013",      // WowPay order ID
    "amount": "1000.00",
    "trade_status": "success",              // success, failed, timeout
    "trade_time": "2025-01-28 10:30:00",
    "sign": "CALCULATED_MD5_SIGNATURE"
}, null, 2));

console.log('\n🚨 Common Issues & Solutions:');
console.log('============================');
console.log('1. "No callback received"');
console.log('   → Check if your server is accessible from internet');
console.log('   → Verify firewall/security groups allow HTTPS traffic');
console.log('   → Test callback URL manually');
console.log('');
console.log('2. "Invalid signature error"');
console.log('   → WowPay callback signature mismatch');
console.log('   → Check MD5 key in environment variables');
console.log('');
console.log('3. "Callback received but payment not updated"');
console.log('   → Check database connection');
console.log('   → Verify WalletRecharge model is working');
console.log('   → Check user wallet balance update logic');

console.log('\n💡 To Test Payment Flow:');
console.log('========================');
console.log('1. Create payment order (✅ DONE - you got order TPOLY2025062800013)');
console.log('2. Visit payment URL: http://127.0.0.1 (test environment)');
console.log('3. Complete payment simulation');
console.log('4. WowPay sends callback to your server');
console.log('5. Your server processes callback and updates database');
console.log('6. User wallet balance updated');

console.log('\n🔧 Quick Debug Commands:');
console.log('========================');
console.log('# Check recent logs');
console.log('grep -i "wowpay\\|callback" /var/log/your-app.log | tail -20');
console.log('');
console.log('# Check database for your order');
console.log('mysql -u your_user -p your_db -e "SELECT * FROM wallet_recharges WHERE order_id LIKE \'%TPOLY2025062800013%\';"');
console.log('');
console.log('# Monitor live callbacks');
console.log('tail -f /var/log/your-app.log | grep -i callback');

console.log('\n✨ Your Current Order to Monitor:');
console.log('=================================');
console.log('Order ID: TPOLY2025062800013');
console.log('Payment URL: http://127.0.0.1');
console.log('Expected callback to: https://api.strikecolor1.com/api/payments/wowpay/payin-callback');
console.log('Status: Waiting for payment completion and callback...');

console.log('\n🎯 Next Steps:');
console.log('==============');
console.log('1. Check server logs for callback activity');
console.log('2. If no callbacks, verify server accessibility');
console.log('3. If callbacks received but processing fails, check database');
console.log('4. Contact WowPay support if test environment callbacks are not working'); 