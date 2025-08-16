#!/usr/bin/env node
/**
 * Manually trigger scheduler processing for a specific period
 */

const periodId = '20250808000000044';

async function triggerSchedulerForPeriod() {
    console.log('🚀 [MANUAL_TRIGGER] ===== MANUALLY TRIGGERING SCHEDULER =====');
    console.log(`🚀 [MANUAL_TRIGGER] Target Period: ${periodId}`);
    
    try {
        // Import services
        const gameLogicService = require('./services/gameLogicService');
        
        console.log('\n🚀 [MANUAL_TRIGGER] === STEP 1: PROCESS GAME RESULTS ===');
        console.log('🚀 [MANUAL_TRIGGER] Calling gameLogicService.processGameResults...');
        
        const result = await gameLogicService.processGameResults(
            'wingo',     // gameType
            30,          // duration (30 seconds)
            periodId,    // periodId
            'default',   // timeline
            null         // transaction
        );
        
        console.log('\n🚀 [MANUAL_TRIGGER] === STEP 2: RESULTS ===');
        console.log('✅ [MANUAL_TRIGGER] Game processing completed!');
        console.log('🚀 [MANUAL_TRIGGER] Result:', JSON.stringify(result, null, 2));
        
        console.log('\n🚀 [MANUAL_TRIGGER] === STEP 3: VERIFICATION ===');
        console.log('🚀 [MANUAL_TRIGGER] Checking if admin result was used...');
        
        if (result && result.isAdminSet) {
            console.log('✅ [MANUAL_TRIGGER] SUCCESS: Admin-set result was used!');
            console.log(`✅ [MANUAL_TRIGGER] Admin Result: Number ${result.result.number}, Color ${result.result.color}, Size ${result.result.size}`);
            console.log(`✅ [MANUAL_TRIGGER] Admin User ID: ${result.adminUserId}`);
            console.log(`✅ [MANUAL_TRIGGER] Request ID: ${result.requestId}`);
        } else {
            console.log('❌ [MANUAL_TRIGGER] Admin result was not found or used');
            console.log('❌ [MANUAL_TRIGGER] Check Redis keys and timing');
        }
        
        console.log('\n🚀 [MANUAL_TRIGGER] ===== MANUAL TRIGGER COMPLETE =====');
        
    } catch (error) {
        console.error('❌ [MANUAL_TRIGGER] Error:', error);
        console.error('❌ [MANUAL_TRIGGER] Stack:', error.stack);
    } finally {
        console.log('\n🚀 [MANUAL_TRIGGER] Exiting...');
        process.exit(0);
    }
}

// Start the trigger
triggerSchedulerForPeriod();