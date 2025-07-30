const { 
    preload5DCombinationsToRedis, 
    getOptimal5DResultByExposureFast,
    getRedisHelper 
} = require('./services/gameLogicService');
const unifiedRedis = require('./config/unifiedRedisManager');

async function test5DFastProtection() {
    try {
        console.log('🧪 [TEST_5D_FAST_PROTECTION] Testing fast Redis-based 5D protection system...');
        console.log('🧪 [TEST_5D_FAST_PROTECTION] Using existing unified Redis manager');
        
        // Ensure unified Redis is initialized
        if (!unifiedRedis.isInitialized) {
            console.log('🔄 [TEST_5D_FAST_PROTECTION] Initializing unified Redis manager...');
            await unifiedRedis.initialize();
        }
        
        const redis = getRedisHelper();
        const testPeriodId = '20250729000001132';
        const testDuration = 60;
        const testTimeline = 'default';
        
        // Step 1: Initialize Redis cache if not already done
        console.log('🔄 [TEST_5D_FAST_PROTECTION] Step 1: Checking Redis cache...');
        const cacheKey = '5d_combinations_cache';
        const cacheExists = await redis.exists(cacheKey);
        
        if (!cacheExists) {
            console.log('🔄 [TEST_5D_FAST_PROTECTION] Cache empty, initializing...');
            await preload5DCombinationsToRedis();
        } else {
            console.log(`✅ [TEST_5D_FAST_PROTECTION] Cache already initialized with ${existingCount} combinations`);
        }
        
        // Step 2: Clear any existing test data
        console.log('🔄 [TEST_5D_FAST_PROTECTION] Step 2: Setting up test data...');
        const exposureKey = `exposure:5d:${testDuration}:${testTimeline}:${testPeriodId}`;
        await redis.del(exposureKey);
        
        // Step 3: Simulate the exact scenario from the user's example
        const testExposures = {
            'bet:SUM_SIZE:SUM_big': '100',    // 100 units on big
            'bet:SUM_PARITY:SUM_even': '100'  // 100 units on even
        };
        
        // Set the test exposures in Redis
        for (const [key, value] of Object.entries(testExposures)) {
            await redis.hset(exposureKey, key, value);
        }
        
        console.log('🧪 [TEST_5D_FAST_PROTECTION] Set test exposures:', testExposures);
        
        // Step 4: Test fast protection system
        console.log('🔄 [TEST_5D_FAST_PROTECTION] Step 3: Testing fast protection system...');
        const startTime = Date.now();
        
        const result = await getOptimal5DResultByExposureFast(testDuration, testPeriodId, testTimeline);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log('✅ [TEST_5D_FAST_PROTECTION] Fast protection test completed!');
        console.log(`📊 [TEST_5D_FAST_PROTECTION] Performance:`);
        console.log(`   - Time taken: ${duration}ms`);
        console.log(`   - Result:`, result);
        
        // Step 5: Verify the result
        console.log('🔄 [TEST_5D_FAST_PROTECTION] Step 4: Verifying result...');
        
        if (result) {
            const sum = result.A + result.B + result.C + result.D + result.E;
            const sumSize = sum < 22 ? 'small' : 'big';
            const sumParity = sum % 2 === 0 ? 'even' : 'odd';
            
            console.log('🧪 [TEST_5D_FAST_PROTECTION] Result analysis:');
            console.log(`   - Dice: A=${result.A}, B=${result.B}, C=${result.C}, D=${result.D}, E=${result.E}`);
            console.log(`   - Sum: ${sum}`);
            console.log(`   - Size: ${sumSize}`);
            console.log(`   - Parity: ${sumParity}`);
            
            // Check if result protects against the bets
            const protectsAgainstBig = sumSize === 'small';
            const protectsAgainstEven = sumParity === 'odd';
            
            console.log('🧪 [TEST_5D_FAST_PROTECTION] Protection verification:');
            console.log(`   - Protects against SUM_big: ${protectsAgainstBig} (${sumSize} instead of big)`);
            console.log(`   - Protects against SUM_even: ${protectsAgainstEven} (${sumParity} instead of even)`);
            
            if (protectsAgainstBig && protectsAgainstEven) {
                console.log('✅ [TEST_5D_FAST_PROTECTION] SUCCESS: Result correctly protects against both bets!');
            } else {
                console.log('❌ [TEST_5D_FAST_PROTECTION] FAILURE: Result does not protect against all bets!');
            }
            
            // Performance validation
            if (duration < 5000) { // Should be under 5 seconds
                console.log('✅ [TEST_5D_FAST_PROTECTION] SUCCESS: Fast performance achieved!');
            } else {
                console.log('⚠️ [TEST_5D_FAST_PROTECTION] WARNING: Performance slower than expected');
            }
        } else {
            console.log('❌ [TEST_5D_FAST_PROTECTION] FAILURE: No result generated');
        }
        
        // Clean up test data
        await redis.del(exposureKey);
        console.log('🧪 [TEST_5D_FAST_PROTECTION] Test data cleaned up');
        
        console.log('✅ [TEST_5D_FAST_PROTECTION] Test completed successfully!');
        
    } catch (error) {
        console.error('❌ [TEST_5D_FAST_PROTECTION] Test failed:', error);
    }
}

// Run the test
test5DFastProtection();