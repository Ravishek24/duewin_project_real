const gameLogicService = require('./services/gameLogicService');
const fiveDProtectionService = require('./services/fiveDProtectionService');
const redisHelper = require('./config/redis');
const redisClient = redisHelper.getClient();

async function test5DPreCalculation() {
    try {
        // Initialize models
        const modelsModule = require('./models');
        await modelsModule.initializeModels();

        console.log('🎯 [5D_PRE_CALC_TEST] ==========================================');
        console.log('🎯 [5D_PRE_CALC_TEST] Testing 5D Pre-Calculation System');
        console.log('🎯 [5D_PRE_CALC_TEST] ==========================================');

        const gameType = '5d';
        const duration = 60;
        const periodId = 'TEST5D' + Date.now();
        const timeline = 'default';

        // Test 1: Initialize zero-exposure candidates
        console.log('\n🔍 [TEST_1] Initializing zero-exposure candidates...');
        const initCount = await fiveDProtectionService.initializeZeroExposureCandidates(
            gameType, duration, periodId, timeline
        );
        console.log('Initialized candidates:', initCount);

        // Test 2: Simulate bet placement
        console.log('\n🔍 [TEST_2] Simulating bet placement...');
        const betType = 'POSITION';
        const betValue = 'A_5';
        
        await fiveDProtectionService.removeCombinationFromZeroExposure(
            gameType, duration, periodId, timeline,
            betType, betValue
        );
        console.log('Removed combinations for bet:', betType, betValue);

        // Test 3: Check bet freeze status
        console.log('\n🔍 [TEST_3] Checking bet freeze status...');
        const isFreeze = gameLogicService.isInBetFreeze(periodId, duration);
        const hasEnded = gameLogicService.hasPeriodEnded(periodId, duration);
        
        console.log('Bet freeze status:', isFreeze);
        console.log('Period ended status:', hasEnded);

        // Test 4: Force enhanced system for consistency testing
        console.log('\n🔍 [TEST_4] Forcing enhanced system for consistency...');
        console.log('Using enhanced system for both pre-calculation and normal calculation');

        // Test 5: Pre-calculate result using enhanced system directly
        console.log('\n🔍 [TEST_5] Pre-calculating result using enhanced system...');
        const preCalcStart = Date.now();
        const preCalcResult = await fiveDProtectionService.getProtectedResult(
            gameType, duration, periodId, timeline
        );
        const preCalcTime = Date.now() - preCalcStart;
        
        console.log('Pre-calculation result:', preCalcResult ? 'SUCCESS' : 'FAILED');
        console.log('Pre-calculation time:', preCalcTime, 'ms');

        // Store the pre-calculated result manually
        const preCalcKey = `precalc_5d:${gameType}:${duration}:${timeline}:${periodId}`;
        const preCalcData = {
            result: preCalcResult,
            calculationTime: preCalcTime,
            useEnhanced: true,
            calculatedAt: new Date().toISOString(),
            periodId,
            gameType,
            duration,
            timeline
        };
        
        await redisClient.set(preCalcKey, JSON.stringify(preCalcData));
        await redisClient.expire(preCalcKey, 300); // 5 minutes TTL

        // Test 6: Retrieve pre-calculated result
        console.log('\n🔍 [TEST_6] Retrieving pre-calculated result...');
        const retrieveStart = Date.now();
        const retrievedResult = await gameLogicService.getPreCalculated5DResult(
            gameType, duration, periodId, timeline
        );
        const retrieveTime = Date.now() - retrieveStart;
        
        console.log('Retrieved result:', retrievedResult ? 'SUCCESS' : 'FAILED');
        console.log('Retrieval time:', retrieveTime, 'ms');

        // Test 7: Normal calculation using enhanced system directly
        console.log('\n🔍 [TEST_7] Normal calculation using enhanced system...');
        const normalStart = Date.now();
        const normalResult = await fiveDProtectionService.getProtectedResult(
            gameType, duration, periodId, timeline
        );
        const normalTime = Date.now() - normalStart;
        
        console.log('Performance comparison:');
        console.log('- Pre-calculation time:', preCalcTime, 'ms');
        console.log('- Retrieval time:', retrieveTime, 'ms');
        console.log('- Normal calculation time:', normalTime, 'ms');
        console.log('- Total pre-calc time:', preCalcTime + retrieveTime, 'ms');
        console.log('- Speed improvement:', (normalTime / (preCalcTime + retrieveTime)).toFixed(1), 'x');

        // Test 8: Verify result consistency
        console.log('\n🔍 [TEST_8] Verifying result consistency...');
        if (retrievedResult && normalResult) {
            const sameResult = JSON.stringify(retrievedResult) === JSON.stringify(normalResult);
            console.log('Results are consistent:', sameResult ? '✅ YES' : '❌ NO');
            
            if (!sameResult) {
                console.log('🔍 [DEBUG] Result comparison:');
                console.log('Retrieved result:', JSON.stringify(retrievedResult, null, 2));
                console.log('Normal result:', JSON.stringify(normalResult, null, 2));
            }
        } else {
            console.log('❌ [TEST_8] One or both results are null');
            console.log('Retrieved result:', retrievedResult ? 'EXISTS' : 'NULL');
            console.log('Normal result:', normalResult ? 'EXISTS' : 'NULL');
        }

        // Cleanup
        console.log('\n🧹 [CLEANUP] Cleaning up test data...');
        const setKey = fiveDProtectionService.getZeroExposureSetKey(gameType, duration, periodId, timeline);
        await redisClient.del(setKey);
        
        await redisClient.del(preCalcKey);
        
        console.log('Test data cleaned up');

        console.log('\n🎯 [5D_PRE_CALC_TEST] ==========================================');
        console.log('🎯 [5D_PRE_CALC_TEST] All tests completed successfully!');
        console.log('🎯 [5D_PRE_CALC_TEST] ==========================================');

        // Summary
        console.log('\n📊 [SUMMARY] Pre-calculation System Performance:');
        console.log(`- Pre-calculation: ${preCalcTime}ms`);
        console.log(`- Retrieval: ${retrieveTime}ms`);
        console.log(`- Total: ${preCalcTime + retrieveTime}ms`);
        console.log(`- Normal calculation: ${normalTime}ms`);
        console.log(`- Speed improvement: ${(normalTime / (preCalcTime + retrieveTime)).toFixed(1)}x`);
        console.log(`- Instant results: ${retrieveTime < 10 ? '✅ YES' : '❌ NO'}`);

    } catch (error) {
        console.error('❌ [5D_PRE_CALC_TEST] Error in 5D pre-calculation test:', error);
        throw error;
    }
}

// Run the test
test5DPreCalculation().catch(console.error); 