#!/usr/bin/env node
/**
 * Test if the scheduler can now properly detect admin-set results
 */

const unifiedRedis = require('./config/unifiedRedisManager');
const gameLogicService = require('./services/gameLogicService');

async function testSchedulerAdminDetection() {
    console.log('🔧 [SCHEDULER_TEST] ===== TESTING SCHEDULER ADMIN DETECTION =====');
    
    try {
        // Step 1: Initialize Redis
        await unifiedRedis.initialize();
        console.log('✅ [SCHEDULER_TEST] Redis initialized');
        
        // Step 2: Create a test admin result (like what admin controller does)
        const testPeriodId = '20250808000000999';
        const testDuration = 30;
        const testNumber = 8;
        
        const testAdminResult = {
            number: testNumber,
            color: testNumber % 2 === 0 ? 'red' : 'green',
            size: testNumber >= 5 ? 'big' : 'small',
            isAdminOverride: true,
            adminUserId: 999,
            overrideTimestamp: new Date().toISOString(),
            requestId: 'TEST-123',
            duration: testDuration,
            timeline: 'default',
            periodId: testPeriodId
        };
        
        // Step 3: Store admin result in Redis (like admin controller does)
        console.log('🔧 [SCHEDULER_TEST] Step 3: Storing test admin result...');
        const helper = unifiedRedis.getHelper();
        const durationKey = testDuration === 30 ? '30s' : 
                          testDuration === 60 ? '1m' : 
                          testDuration === 180 ? '3m' : 
                          testDuration === 300 ? '5m' : '10m';
        
        const resultKey = `wingo:${durationKey}:${testPeriodId}:result`;
        await helper.set(resultKey, JSON.stringify(testAdminResult));
        console.log('✅ [SCHEDULER_TEST] Test admin result stored at key:', resultKey);
        console.log('   Test result:', testAdminResult);
        
        // Step 4: Test if scheduler can detect the admin result
        console.log('\\n🔧 [SCHEDULER_TEST] Step 4: Testing scheduler detection...');
        
        // Initialize database and models
        const { connectDB } = require('./config/db');
        await connectDB();
        await gameLogicService.ensureModelsInitialized();
        
        // Call the scheduler's processGameResults function with our test period
        console.log('🔧 [SCHEDULER_TEST] Calling processGameResults...');
        const result = await gameLogicService.processGameResults('wingo', testDuration, testPeriodId, 'default');
        
        console.log('\\n✅ [SCHEDULER_TEST] === RESULTS ===');
        console.log('✅ [SCHEDULER_TEST] Scheduler function completed');
        console.log('✅ [SCHEDULER_TEST] Returned result:', result);
        
        // Step 5: Verify if the admin result was used
        if (result && result.number === testNumber) {
            console.log('🎉 [SCHEDULER_TEST] SUCCESS! Scheduler detected and used admin result');
            console.log('✅ [SCHEDULER_TEST] Expected number:', testNumber);
            console.log('✅ [SCHEDULER_TEST] Actual number:', result.number);
            console.log('✅ [SCHEDULER_TEST] ADMIN SET RESULT IS NOW WORKING!');
        } else {
            console.log('❌ [SCHEDULER_TEST] FAILED! Scheduler did not use admin result');
            console.log('❌ [SCHEDULER_TEST] Expected number:', testNumber);
            console.log('❌ [SCHEDULER_TEST] Actual result:', result);
        }
        
        // Step 6: Cleanup
        console.log('\\n🔧 [SCHEDULER_TEST] Step 6: Cleanup...');
        await helper.del(resultKey);
        console.log('✅ [SCHEDULER_TEST] Cleanup completed');
        
    } catch (error) {
        console.error('❌ [SCHEDULER_TEST] Error:', error.message);
        console.error('❌ [SCHEDULER_TEST] Stack:', error.stack);
    }
}

testSchedulerAdminDetection().then(() => {
    console.log('🔧 [SCHEDULER_TEST] Test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [SCHEDULER_TEST] Fatal error:', error);
    process.exit(1);
});