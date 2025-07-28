// scripts/testActualCronManually.js
const { processDailyRebates } = require('./masterCronJobs');
const unifiedRedis = require('../config/unifiedRedisManager');

async function testActualCronManually() {
    try {
        console.log('🚀 Testing Actual Daily Rebate Cron Manually...');
        console.log('📅 This will test the real cron job that runs daily at 12:30 AM IST');
        
        // Initialize Redis
        await unifiedRedis.initialize();
        console.log('✅ Redis initialized');
        
        // Test the actual cron function
        console.log('\n🔄 Starting daily rebate processing...');
        const startTime = Date.now();
        
        await processDailyRebates();
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        
        console.log(`\n✅ Daily rebate cron test completed!`);
        console.log(`⏱️  Total processing time: ${processingTime}ms`);
        console.log(`📊 Check the logs above for detailed results`);
        
    } catch (error) {
        console.error('❌ Error testing daily rebate cron:', error);
    } finally {
        console.log('\n🧹 Cleaning up...');
        await unifiedRedis.cleanup();
        console.log('✅ Cleanup completed');
        process.exit(0);
    }
}

testActualCronManually(); 