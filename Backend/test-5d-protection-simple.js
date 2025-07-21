function getRedisClient() {
  if (!redisHelper) throw new Error('redisHelper not set!');
  return getRedisClient();
}
const { initializeModels } = require('./models');
const fiveDProtectionService = require('./services/fiveDProtectionService');
const redisHelper = require('./config/redis');


async function test5DProtectionSimple() {
    try {
        console.log('🎯 [5D_PROTECTION_SIMPLE_TEST] ==========================================');
        console.log('🎯 [5D_PROTECTION_SIMPLE_TEST] Testing 5D Protection Service (Simple)');
        console.log('🎯 [5D_PROTECTION_SIMPLE_TEST] ==========================================');

        // Step 1: Initialize models
        console.log('\n🔧 [STEP_1] Initializing models...');
        await initializeModels();
        console.log('✅ Models initialized successfully');

        const gameType = '5d';
        const duration = 60;
        const periodId = 'TEST5D' + Date.now();
        const timeline = 'default';

        // Step 2: Test basic functionality
        console.log('\n🔍 [STEP_2] Testing basic functionality...');
        
        // Test 1: Initialize zero-exposure candidates
        console.log('📋 Testing initialization...');
        const initCount = await fiveDProtectionService.initializeZeroExposureCandidates(
            gameType, duration, periodId, timeline
        );
        console.log(`✅ Initialized ${initCount} zero-exposure candidates`);

        // Test 2: Get protection stats
        console.log('📊 Getting protection stats...');
        const stats = await fiveDProtectionService.getProtectionStats(
            gameType, duration, periodId, timeline
        );
        console.log('Protection stats:', stats);

        // Test 3: Simulate a bet
        console.log('🎲 Simulating a bet...');
        const removedCount = await fiveDProtectionService.removeCombinationFromZeroExposure(
            gameType, duration, periodId, timeline,
            'POSITION', 'A_5'
        );
        console.log(`✅ Removed ${removedCount} combinations for bet A_5`);

        // Test 4: Get protected result
        console.log('🛡️ Getting protected result...');
        const result = await fiveDProtectionService.getProtectedResult(
            gameType, duration, periodId, timeline
        );
        console.log('✅ Protected result:', result);

        // Test 5: Test 60/40 distribution
        console.log('📈 Testing 60/40 distribution...');
        const results = [];
        const iterations = 10;
        
        for (let i = 0; i < iterations; i++) {
            const testResult = await fiveDProtectionService.getProtectedResult(
                gameType, duration, periodId, timeline
            );
            results.push(testResult);
            console.log(`  Iteration ${i + 1}: ${JSON.stringify(testResult)}`);
        }

        console.log(`📊 Generated ${iterations} results`);
        console.log(`📊 Unique results: ${new Set(results.map(r => JSON.stringify(r))).size}`);

        // Cleanup
        const setKey = fiveDProtectionService.getZeroExposureSetKey(gameType, duration, periodId, timeline);
        await redisClient.del(setKey);
        
        console.log('\n🎯 [5D_PROTECTION_SIMPLE_TEST] ==========================================');
        console.log('🎯 [5D_PROTECTION_SIMPLE_TEST] Simple test completed successfully!');
        console.log('🎯 [5D_PROTECTION_SIMPLE_TEST] ==========================================');

    } catch (error) {
        console.error('❌ [5D_PROTECTION_SIMPLE_TEST] Error in simple test:', error);
        console.error('Stack trace:', error.stack);
        throw error;
    }
}

// Run the simple test
test5DProtectionSimple().catch(console.error); 