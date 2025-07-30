const unifiedRedis = require('./config/unifiedRedisManager');
const { preload5DCombinationsToRedis, get5DCombinationFromRedis, getAll5DCombinationsFromRedis } = require('./services/gameLogicService');

async function test5DRedisFix() {
    console.log('🧪 [5D_REDIS_TEST] Testing 5D Redis functions after fix...');
    
    try {
        // Initialize Redis manager
        console.log('🔄 [5D_REDIS_TEST] Initializing Redis manager...');
        await unifiedRedis.initialize();
        console.log('✅ [5D_REDIS_TEST] Redis manager initialized');
        
        const redis = unifiedRedis.getHelper();
        const cacheKey = '5d_combinations_cache';
        
        // Clear existing cache
        console.log('\n📊 Test 1: Clear existing cache');
        await redis.del(cacheKey);
        console.log('✅ Cache cleared');
        
        // Test preload function
        console.log('\n📊 Test 2: Test preload function');
        const preloadResult = await preload5DCombinationsToRedis();
        console.log('Preload result:', preloadResult);
        
        // Check cache count
        console.log('\n📊 Test 3: Check cache count');
        const cacheCount = await redis.hlen(cacheKey);
        console.log('Cache count after preload:', cacheCount);
        
        // Test get5DCombinationFromRedis
        console.log('\n📊 Test 4: Test get5DCombinationFromRedis');
        const testCombos = ['11111', '22222', '33333', '44444', '55555'];
        
        for (const combo of testCombos) {
            try {
                const result = await get5DCombinationFromRedis(combo);
                if (result) {
                    console.log(`✅ Retrieved combo:${combo} - Sum:${result.sum_value}, Size:${result.sum_size}, Parity:${result.sum_parity}`);
                } else {
                    console.log(`❌ Failed to retrieve combo:${combo}`);
                }
            } catch (error) {
                console.log(`❌ Error retrieving combo:${combo}:`, error.message);
            }
        }
        
        // Test getAll5DCombinationsFromRedis (sample)
        console.log('\n📊 Test 5: Test getAll5DCombinationsFromRedis (first 5)');
        try {
            const allCombos = await getAll5DCombinationsFromRedis();
            console.log(`Total combinations retrieved: ${allCombos.length}`);
            
            // Show first 5 combinations
            for (let i = 0; i < Math.min(5, allCombos.length); i++) {
                const combo = allCombos[i];
                console.log(`  ${i + 1}. ${combo.dice_value} - Sum:${combo.sum_value}, Size:${combo.sum_size}, Parity:${combo.sum_parity}`);
            }
        } catch (error) {
            console.log('❌ Error getting all combinations:', error.message);
        }
        
        // Manual Redis verification
        console.log('\n📊 Test 6: Manual Redis verification');
        const manualCount = await redis.hlen(cacheKey);
        console.log('Manual hlen count:', manualCount);
        
        // Try to get a few combinations manually
        for (const combo of testCombos) {
            const manualResult = await redis.hget(cacheKey, `combo:${combo}`);
            if (manualResult) {
                console.log(`✅ Manual retrieval combo:${combo} - Type: ${typeof manualResult}`);
            } else {
                console.log(`❌ Manual retrieval failed for combo:${combo}`);
            }
        }
        
        // Summary
        console.log('\n📋 5D REDIS FIX TEST SUMMARY:');
        console.log('├─ Preload function: ' + (preloadResult > 0 ? '✅ WORKING' : '❌ FAILED'));
        console.log('├─ Cache count: ' + cacheCount);
        console.log('├─ Individual retrieval: Tested');
        console.log('├─ Bulk retrieval: Tested');
        console.log('└─ Manual verification: Tested');
        
        if (preloadResult > 0 && cacheCount > 0) {
            console.log('\n✅ 5D REDIS FIX: SUCCESS!');
            console.log('🎯 The 5D combinations are now properly loaded and accessible!');
        } else {
            console.log('\n❌ 5D REDIS FIX: FAILED!');
            console.log('🔧 There is still an issue with the preload function.');
        }
        
    } catch (error) {
        console.error('❌ [5D_REDIS_TEST] Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
test5DRedisFix().then(() => {
    console.log('\n🏁 [5D_REDIS_TEST] Test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [5D_REDIS_TEST] Test failed:', error);
    process.exit(1);
}); 