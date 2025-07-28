// scripts/testMasterCronWithFixes.js
const { processDailyRebates } = require('./masterCronJobs');
const unifiedRedis = require('../config/unifiedRedisManager');
const moment = require('moment-timezone');

async function testMasterCronWithFixes() {
    try {
        console.log('🧪 Testing Master Cron with All Fixes Applied...\n');
        
        // Test with a specific date where we know user 110 has team bets
        const testDate = '2025-07-26';
        process.env.FORCE_REBATE_DATE = testDate;
        
        console.log(`📅 Testing master cron for IST date: ${testDate}`);
        console.log('🕐 This will test the complete flow with:');
        console.log('   - UTC conversion for bet data');
        console.log('   - Corrected rate calculation');
        console.log('   - Enhanced rebate service');
        console.log('   - Redis locking mechanism');
        
        await unifiedRedis.initialize();
        console.log('✅ Redis initialized');
        
        console.log('\n🔄 Starting master cron daily rebate processing...');
        const startTime = Date.now();
        
        await processDailyRebates();
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        
        console.log(`\n✅ Master Cron Test Completed!`);
        console.log(`⏱️  Total processing time: ${processingTime}ms`);
        console.log(`📊 Check the logs above for detailed results`);
        
        // Clean up environment variable
        delete process.env.FORCE_REBATE_DATE;
        
    } catch (error) {
        console.error('❌ Error testing master cron:', error);
    } finally {
        console.log('\n🧹 Cleaning up...');
        await unifiedRedis.cleanup();
        console.log('✅ Cleanup completed');
        process.exit(0);
    }
}

testMasterCronWithFixes(); 