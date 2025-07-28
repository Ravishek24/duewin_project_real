// scripts/testCronWithFixedDate.js
const { processDailyRebates } = require('./masterCronJobs');
const unifiedRedis = require('../config/unifiedRedisManager');
const moment = require('moment-timezone');

async function testCronWithFixedDate() {
    try {
        console.log('🧪 Testing Daily Rebate Cron with Fixed Enhanced Service...');
        
        // Set environment variable to force a specific date
        const testDate = '2025-07-26'; // Date where user 110's team has bets
        process.env.FORCE_REBATE_DATE = testDate;
        
        console.log(`📅 Testing for date: ${testDate}`);
        console.log('👤 This should process user 110 with 44 team members who have bets');
        
        await unifiedRedis.initialize();
        console.log('✅ Redis initialized');
        
        console.log('\n🔄 Starting daily rebate processing with fixed enhanced service...');
        const startTime = Date.now();
        
        await processDailyRebates();
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        
        console.log(`\n✅ Daily rebate cron test completed!`);
        console.log(`⏱️  Total processing time: ${processingTime}ms`);
        console.log(`📊 Check the logs above for detailed results`);
        
        // Clean up environment variable
        delete process.env.FORCE_REBATE_DATE;
        
    } catch (error) {
        console.error('❌ Error testing daily rebate cron:', error);
    } finally {
        console.log('\n🧹 Cleaning up...');
        await unifiedRedis.cleanup();
        console.log('✅ Cleanup completed');
        process.exit(0);
    }
}

testCronWithFixedDate(); 