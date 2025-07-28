// scripts/testFixedEnhancedRebate.js
const enhancedRebateService = require('../services/enhancedRebateService');
const unifiedRedis = require('../config/unifiedRedisManager');

async function testFixedEnhancedRebate() {
    try {
        console.log('🧪 Testing Fixed Enhanced Rebate Service...');
        await unifiedRedis.initialize();
        
        // Use the date where we know user 110's team has bets
        const testDate = '2025-07-26';
        console.log(`📅 Testing for date: ${testDate}`);
        
        const result = await enhancedRebateService.processDailyRebateCommissions(testDate);
        
        if (result.success) {
            console.log('\n✅ Enhanced Rebate System Test Results:');
            console.log(`📊 Processed Users: ${result.processedUsers}`);
            console.log(`💰 Total Commission: ₹${result.totalCommission.toFixed(2)}`);
            console.log(`⏱️  Processing Time: ${result.processingTime}ms`);
            console.log(`❌ Errors: ${result.errors.length}`);
            
            if (result.errors.length > 0) {
                console.log('\n⚠️ Errors encountered:');
                result.errors.slice(0, 5).forEach((error, index) => {
                    console.log(`   ${index + 1}. User ${error.userId}: ${error.error}`);
                });
                if (result.errors.length > 5) {
                    console.log(`   ... and ${result.errors.length - 5} more errors`);
                }
            }
        } else {
            console.log('\n❌ Enhanced Rebate System Test Failed:');
            console.log(`Error: ${result.error}`);
        }
        
    } catch (error) {
        console.error('💥 Error testing enhanced rebate system:', error);
    } finally {
        await unifiedRedis.cleanup();
        process.exit(0);
    }
}

testFixedEnhancedRebate(); 