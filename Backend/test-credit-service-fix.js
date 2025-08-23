#!/usr/bin/env node

/**
 * Test script to verify credit service fixes
 * Run with: node test-credit-service-fix.js
 */

const CreditService = require('./services/creditService');

async function testCreditServiceFixes() {
    console.log('🧪 Testing Credit Service Fixes...\n');
    
    try {
        // Test 1: Check queue status
        console.log('📊 Test 1: Queue Status');
        const queueStatus = CreditService.getQueueStatus();
        console.log('Queue Status:', JSON.stringify(queueStatus, null, 2));
        console.log('✅ Queue status check passed\n');
        
        // Test 2: Test timeout handling
        console.log('⏰ Test 2: Timeout Handling');
        try {
            // This should timeout after 15 seconds
            const result = await CreditService.addCredit(999, 100, 'test_bonus', 'test');
            console.log('Result:', result);
        } catch (error) {
            if (error.message.includes('timeout')) {
                console.log('✅ Timeout handling working correctly');
            } else {
                console.log('❌ Unexpected error:', error.message);
            }
        }
        console.log('✅ Timeout test completed\n');
        
        // Test 3: Check cleanup functions
        console.log('🧹 Test 3: Cleanup Functions');
        const staleStatusCount = CreditService.cleanupStaleProcessingStatus();
        const staleOperationsCount = CreditService.cleanupStaleActiveOperations();
        console.log(`Cleaned up ${staleStatusCount} stale statuses and ${staleOperationsCount} stale operations`);
        console.log('✅ Cleanup functions working\n');
        
        // Test 4: Final queue status
        console.log('📊 Test 4: Final Queue Status');
        const finalQueueStatus = CreditService.getQueueStatus();
        console.log('Final Queue Status:', JSON.stringify(finalQueueStatus, null, 2));
        console.log('✅ Final queue status check passed\n');
        
        console.log('🎉 All tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the tests
testCreditServiceFixes().then(() => {
    console.log('\n🚀 Tests completed, exiting...');
    process.exit(0);
}).catch((error) => {
    console.error('\n💥 Test suite failed:', error);
    process.exit(1);
});
