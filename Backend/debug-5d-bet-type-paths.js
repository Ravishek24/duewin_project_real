const { processBet, calculateResultWithVerification, getPreCalculated5DResult } = require('./services/gameLogicService');

async function debug5DBetTypePaths() {
    try {
        console.log('🔍 [DEBUG_5D_BET_PATHS] Starting 5D bet type path debug...');
        
        // Test parameters
        const gameType = 'fiveD';
        const duration = 180; // Test with 180 seconds period
        const periodId = '20250816000000237'; // Use a recent period ID
        const timeline = 'default';
        
        console.log('📋 [DEBUG_5D_BET_PATHS] Test parameters:', {
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
        
        // Step 3: Test SUM bet processing
        console.log('\n🔍 [STEP_3] Testing SUM bet processing...');
        const sumBetData = {
            userId: 999999, // Test user ID
            gameType: gameType,
            duration: duration,
            timeline: timeline,
            periodId: periodId,
            betType: 'SUM',
            betValue: '25',
            betAmount: 100,
            odds: 9
        };
        
        console.log('📋 [STEP_3] SUM bet data:', sumBetData);
        
        try {
            const sumBetResult = await processBet(sumBetData);
            console.log('✅ [STEP_3] SUM bet processing result:', {
                success: sumBetResult.success,
                message: sumBetResult.message,
                hasData: !!sumBetResult.data
            });
        } catch (sumError) {
            console.log('❌ [STEP_3] SUM bet processing error:', sumError.message);
        }
        
        // Step 4: Test POSITION bet processing
        console.log('\n🔍 [STEP_4] Testing POSITION bet processing...');
        const positionBetData = {
            userId: 999999, // Test user ID
            gameType: gameType,
            duration: duration,
            timeline: timeline,
            periodId: periodId,
            betType: 'POSITION',
            betValue: 'A_5',
            betAmount: 100,
            odds: 9
        };
        
        console.log('📋 [STEP_4] POSITION bet data:', positionBetData);
        
        try {
            const positionBetResult = await processBet(positionBetData);
            console.log('✅ [STEP_4] POSITION bet processing result:', {
                success: positionBetResult.success,
                message: positionBetResult.message,
                hasData: !!positionBetResult.data
            });
        } catch (positionError) {
            console.log('❌ [STEP_4] POSITION bet processing error:', positionError.message);
        }
        
        // Step 5: Compare results
        console.log('\n🔍 [STEP_5] Comparing results...');
        if (preCalcResult && resultWithVerification.result) {
            const preCalcString = `${preCalcResult.A},${preCalcResult.B},${preCalcResult.C},${preCalcResult.D},${preCalcResult.E}`;
            const calcString = `${resultWithVerification.result.A},${resultWithVerification.result.B},${resultWithVerification.result.C},${resultWithVerification.result.D},${resultWithVerification.result.E}`;
            
            if (preCalcString === calcString) {
                console.log('✅ [STEP_5] RESULTS MATCH! Both are consistent');
                console.log('📊 [STEP_5] Result:', preCalcString);
            } else {
                console.log('❌ [STEP_5] RESULTS DO NOT MATCH! Inconsistency detected');
                console.log('📊 [STEP_5] Pre-calculated:', preCalcString);
                console.log('📊 [STEP_5] Calculated:', calcString);
            }
        } else {
            console.log('⚠️ [STEP_5] Cannot compare - missing one or both results');
        }
        
        console.log('\n🎯 [DEBUG_5D_BET_PATHS] Debug completed');
        
    } catch (error) {
        console.error('❌ [DEBUG_5D_BET_PATHS] Error during debug:', error);
    }
}

// Run debug if this file is executed directly
if (require.main === module) {
    debug5DBetTypePaths();
}

module.exports = { debug5DBetTypePaths };
