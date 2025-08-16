const { calculateResultWithVerification, getPreCalculated5DResult } = require('./services/gameLogicService');

async function debug5DResultConsistency() {
    try {
        console.log('🔍 [DEBUG_5D_CONSISTENCY] Starting 5D result consistency debug...');
        
        // Test parameters
        const gameType = 'fiveD';
        const duration = 180; // Test with 180 seconds period
        const periodId = '20250816000000237'; // Use a recent period ID
        const timeline = 'default';
        
        console.log('📋 [DEBUG_5D_CONSISTENCY] Test parameters:', {
            gameType, duration, periodId, timeline
        });
        
        // Step 1: Test getPreCalculated5DResult directly
        console.log('\n🔍 [STEP_1] Testing getPreCalculated5DResult directly...');
        const preCalcResult = await getPreCalculated5DResult(gameType, duration, periodId, timeline);
        
        if (preCalcResult) {
            console.log('✅ [STEP_1] Pre-calculated result found:', preCalcResult);
        } else {
            console.log('❌ [STEP_1] No pre-calculated result found');
        }
        
        // Step 2: Test calculateResultWithVerification
        console.log('\n🔍 [STEP_2] Testing calculateResultWithVerification...');
        const resultWithVerification = await calculateResultWithVerification(gameType, duration, periodId, timeline);
        
        console.log('✅ [STEP_2] Result with verification:', {
            success: resultWithVerification.success,
            source: resultWithVerification.source,
            result: resultWithVerification.result,
            protectionMode: resultWithVerification.protectionMode
        });
        
        // Step 3: Compare results
        console.log('\n🔍 [STEP_3] Comparing results...');
        if (preCalcResult && resultWithVerification.result) {
            const preCalcString = `${preCalcResult.A},${preCalcResult.B},${preCalcResult.C},${preCalcResult.D},${preCalcResult.E}`;
            const calcString = `${resultWithVerification.result.A},${resultWithVerification.result.B},${resultWithVerification.result.C},${resultWithVerification.result.D},${resultWithVerification.result.E}`;
            
            if (preCalcString === calcString) {
                console.log('✅ [STEP_3] RESULTS MATCH! Both are consistent');
                console.log('📊 [STEP_3] Result:', preCalcString);
            } else {
                console.log('❌ [STEP_3] RESULTS DO NOT MATCH! Inconsistency detected');
                console.log('📊 [STEP_3] Pre-calculated:', preCalcString);
                console.log('📊 [STEP_3] Calculated:', calcString);
            }
        } else {
            console.log('⚠️ [STEP_3] Cannot compare - missing one or both results');
        }
        
        console.log('\n🎯 [DEBUG_5D_CONSISTENCY] Debug completed');
        
    } catch (error) {
        console.error('❌ [DEBUG_5D_CONSISTENCY] Error during debug:', error);
    }
}

// Run debug if this file is executed directly
if (require.main === module) {
    debug5DResultConsistency();
}

module.exports = { debug5DResultConsistency };
