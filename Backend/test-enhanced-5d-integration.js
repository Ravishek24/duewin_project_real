function getRedisClient() {
  if (!redisHelper) throw new Error('redisHelper not set!');
  return getRedisClient();
}
const gameLogicService = require('./services/gameLogicService');
const fiveDProtectionService = require('./services/fiveDProtectionService');
const redisHelper = require('./config/redis');


async function testEnhanced5DIntegration() {
    try {
        // Initialize models before any service usage
        const modelsModule = require('./models');
        await modelsModule.initializeModels();

        console.log('🎯 [ENHANCED_5D_TEST] ==========================================');
        console.log('🎯 [ENHANCED_5D_TEST] Testing Enhanced 5D Integration');
        console.log('🎯 [ENHANCED_5D_TEST] ==========================================');

        // Test 1: Check if enhanced system is ready
        console.log('\n🔍 [TEST_1] Checking enhanced system health...');
        const isHealthy = await fiveDProtectionService.isSystemReady();
        console.log('Enhanced system health:', isHealthy ? '✅ HEALTHY' : '❌ UNHEALTHY');

        // Test 2: Initialize zero-exposure candidates
        console.log('\n🔍 [TEST_2] Initializing zero-exposure candidates...');
        const gameType = '5d';
        const duration = 60;
        const periodId = 'TEST5D' + Date.now();
        const timeline = 'default';

        const initCount = await fiveDProtectionService.initializeZeroExposureCandidates(
            gameType, duration, periodId, timeline
        );
        console.log('Initialized candidates:', initCount);

        // Test 3: Check zero-exposure set
        console.log('\n🔍 [TEST_3] Checking zero-exposure set...');
        const stats = await fiveDProtectionService.getProtectionStats(
            gameType, duration, periodId, timeline
        );
        console.log('Protection stats:', stats);

        // Test 4: Simulate bet placement
        console.log('\n🔍 [TEST_4] Simulating bet placement...');
        const betType = 'POSITION';
        const betValue = 'A_5';
        
        await fiveDProtectionService.removeCombinationFromZeroExposure(
            gameType, duration, periodId, timeline,
            betType, betValue
        );
        console.log('Removed combinations for bet:', betType, betValue);

        // Test 5: Check stats after bet
        console.log('\n🔍 [TEST_5] Checking stats after bet...');
        const statsAfterBet = await fiveDProtectionService.getProtectionStats(
            gameType, duration, periodId, timeline
        );
        console.log('Stats after bet:', statsAfterBet);

        // Test 6: Get protected result
        console.log('\n🔍 [TEST_6] Getting protected result...');
        const startTime = Date.now();
        const result = await fiveDProtectionService.getProtectedResult(
            gameType, duration, periodId, timeline
        );
        const endTime = Date.now();
        
        console.log('Protected result:', result);
        console.log('Execution time:', endTime - startTime, 'ms');

        // Test 7: Test enhanced system integration
        console.log('\n🔍 [TEST_7] Testing enhanced system integration...');
        const useEnhanced = await gameLogicService.shouldUseEnhancedSystem(gameType, duration, periodId);
        console.log('Should use enhanced system:', useEnhanced);

        // Test 8: Performance comparison
        console.log('\n🔍 [TEST_8] Performance comparison...');
        
        // Enhanced system
        const enhancedStart = Date.now();
        const enhancedResult = await gameLogicService.getEnhanced5DResult(gameType, duration, periodId, timeline);
        const enhancedTime = Date.now() - enhancedStart;
        
        // Current system
        const currentStart = Date.now();
        const currentResult = await gameLogicService.getCurrent5DResult(gameType, duration, periodId, timeline);
        const currentTime = Date.now() - currentStart;
        
        console.log('Performance comparison:');
        console.log('- Enhanced system:', enhancedTime, 'ms');
        console.log('- Current system:', currentTime, 'ms');
        console.log('- Speed improvement:', (currentTime / enhancedTime).toFixed(1), 'x');

        // Cleanup
        console.log('\n🧹 [CLEANUP] Cleaning up test data...');
        const setKey = fiveDProtectionService.getZeroExposureSetKey(gameType, duration, periodId, timeline);
        await redisClient.del(setKey);
        console.log('Test data cleaned up');

        console.log('\n🎯 [ENHANCED_5D_TEST] ==========================================');
        console.log('🎯 [ENHANCED_5D_TEST] All tests completed successfully!');
        console.log('🎯 [ENHANCED_5D_TEST] ==========================================');

    } catch (error) {
        console.error('❌ [ENHANCED_5D_TEST] Error in enhanced 5D integration test:', error);
        throw error;
    }
}

// Run the test
testEnhanced5DIntegration().catch(console.error); 