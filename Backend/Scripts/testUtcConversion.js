// scripts/testUtcConversion.js
const moment = require('moment-timezone');

function testUtcConversion() {
    console.log('🕐 Testing UTC Conversion for IST Date Processing...\n');
    
    // Test date: 2025-07-26 (IST)
    const testDate = '2025-07-26';
    
    console.log(`📅 IST Date to process: ${testDate}`);
    
    // Convert IST date to UTC date range
    const istStartOfDay = moment.tz(testDate + ' 00:00:00', 'Asia/Kolkata');
    const istEndOfDay = moment.tz(testDate + ' 23:59:59', 'Asia/Kolkata');
    
    const utcStartDate = istStartOfDay.utc().format('YYYY-MM-DD HH:mm:ss');
    const utcEndDate = istEndOfDay.utc().format('YYYY-MM-DD HH:mm:ss');
    
    console.log('\n🔄 Conversion Results:');
    console.log(`   IST Start: ${istStartOfDay.format('YYYY-MM-DD HH:mm:ss')} (Asia/Kolkata)`);
    console.log(`   IST End:   ${istEndOfDay.format('YYYY-MM-DD HH:mm:ss')} (Asia/Kolkata)`);
    console.log(`   UTC Start: ${utcStartDate} (UTC)`);
    console.log(`   UTC End:   ${utcEndDate} (UTC)`);
    
    console.log('\n📊 What this means:');
    console.log('   When cron runs at 12:30 AM IST on 2025-07-27,');
    console.log('   it will process all bets from:');
    console.log(`   - UTC: ${utcStartDate} to ${utcEndDate}`);
    console.log('   - Which covers the full IST day: 2025-07-26 00:00 to 23:59');
    
    console.log('\n✅ This ensures we capture all bets from the previous IST day!');
}

testUtcConversion(); 