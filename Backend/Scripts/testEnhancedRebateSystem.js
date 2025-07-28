// scripts/testEnhancedRebateSystem.js
const enhancedRebateService = require('../services/enhancedRebateService');
const unifiedRedis = require('../config/unifiedRedisManager');

async function testEnhancedRebateSystem() {
    try {
        console.log('🚀 Testing Enhanced Rebate System...');
        
        // Initialize Redis
        await unifiedRedis.initialize();
        
        // Test with yesterday's date
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const testDate = yesterday.toISOString().split('T')[0];
        
        console.log(`📅 Testing for date: ${testDate}`);
        
        // Process rebate commissions
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
        // Close Redis connection
        await unifiedRedis.cleanup();
        process.exit(0);
    }
}

// Run the test
testEnhancedRebateSystem(); 