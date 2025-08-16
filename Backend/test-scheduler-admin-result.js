#!/usr/bin/env node
/**
 * Test script to manually trigger scheduler processing of admin-set result
 */

const { connectDB } = require('./config/db');

async function testSchedulerWithAdminResult() {
    console.log('🔐 [SCHEDULER_TEST] ===== TESTING SCHEDULER WITH ADMIN RESULT =====');
    
    try {
        // Connect to database
        await connectDB();
        console.log('✅ [SCHEDULER_TEST] Database connected');
        
        // Load services after DB connection
        const gameLogicService = require('./services/gameLogicService');
        console.log('✅ [SCHEDULER_TEST] Game logic service loaded');
        
        // The period that admin set result for
        const testPeriodId = '20250808000000014';
        const gameType = 'wingo';
        const duration = 30;
        const timeline = 'default';
        
        console.log('\n🔐 [SCHEDULER_TEST] Testing period:', testPeriodId);
        console.log('🔐 [SCHEDULER_TEST] This period should have admin-set result in Redis');
        console.log('🔐 [SCHEDULER_TEST] Expected: number 6, color green, size big');
        
        console.log('\n🔐 [SCHEDULER_TEST] MANUALLY TRIGGERING SCHEDULER...');
        console.log('🔐 [SCHEDULER_TEST] Calling gameLogicService.processGameResults...');
        
        // This should find the admin-set result and use it
        const result = await gameLogicService.processGameResults(
            gameType,
            duration,
            testPeriodId,
            timeline
        );
        
        console.log('\n✅ [SCHEDULER_TEST] Scheduler processing completed!');
        console.log('🔐 [SCHEDULER_TEST] Result:', JSON.stringify(result, null, 2));
        
        if (result.success) {
            console.log('✅ [SCHEDULER_TEST] SUCCESS: Scheduler processed the period');
            console.log('🔐 [SCHEDULER_TEST] Game result:', JSON.stringify(result.gameResult || result.result));
            console.log('🔐 [SCHEDULER_TEST] Source:', result.source);
            console.log('🔐 [SCHEDULER_TEST] Is admin set:', result.isAdminSet);
            console.log('🔐 [SCHEDULER_TEST] Winners count:', result.winners?.length || 0);
        } else {
            console.log('❌ [SCHEDULER_TEST] FAILED:', result.message);
        }
        
    } catch (error) {
        console.error('❌ [SCHEDULER_TEST] Error:', error.message);
        console.error('❌ [SCHEDULER_TEST] Stack:', error.stack);
    }
    
    console.log('\n🔐 [SCHEDULER_TEST] Test completed. Check server logs for detailed processing.');
    process.exit(0);
}

// Run the test
testSchedulerWithAdminResult();