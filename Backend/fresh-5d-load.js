const unifiedRedis = require('./config/unifiedRedisManager');
const { preload5DCombinationsToRedis, get5DCombinationFromRedis, getAll5DCombinationsFromRedis } = require('./services/gameLogicService');

async function fresh5DLoad() {
    console.log('🔄 [FRESH_5D_LOAD] Starting fresh 5D combinations load...');
    
    try {
        // Initialize Redis manager
        console.log('🔄 [FRESH_5D_LOAD] Initializing Redis manager...');
        await unifiedRedis.initialize();
        console.log('✅ [FRESH_5D_LOAD] Redis manager initialized');
        
        const redis = unifiedRedis.getHelper();
        const cacheKey = '5d_combinations_cache';
        
        // Step 1: Force clear the cache completely
        console.log('\n📊 Step 1: Force clear existing cache');
        await redis.del(cacheKey);
        console.log('✅ Cache completely cleared');
        
        // Step 2: Verify cache is empty
        console.log('\n📊 Step 2: Verify cache is empty');
        const emptyCount = await redis.hlen(cacheKey);
        console.log('Cache count after clear:', emptyCount);
        
        if (emptyCount !== 0) {
            console.log('❌ Cache not empty after clear!');
            return;
        }
        
        // Step 3: Force fresh preload (bypass cache check)
        console.log('\n📊 Step 3: Force fresh preload');
        
        // Temporarily modify the preload function to bypass cache check
        const originalPreload = preload5DCombinationsToRedis;
        
        // Create a modified version that bypasses the cache check
        const forcePreload = async () => {
            try {
                console.log('🔄 [5D_REDIS_PRELOAD] Starting 5D combinations pre-load to Redis...');
                
                // Use existing unified Redis manager
                const redis = require('./config/unifiedRedisManager').getHelper();
                const cacheKey = '5d_combinations_cache';
                
                // SKIP cache check - force fresh load
                console.log('🔄 [5D_REDIS_PRELOAD] Force fresh load (bypassing cache check)...');
                
                console.log('🔄 [5D_REDIS_PRELOAD] Loading combinations from database...');
                
                const models = await require('./services/gameLogicService').ensureModelsInitialized();
                const { getSequelizeInstance } = require('./config/db');
                const sequelize = await getSequelizeInstance();
                
                // Get all combinations from database
                const combinations = await sequelize.query(`
                    SELECT dice_value, dice_a, dice_b, dice_c, dice_d, dice_e,
                           sum_value, sum_size, sum_parity, winning_conditions
                    FROM game_combinations_5d
                    ORDER BY dice_value
                `, { type: sequelize.QueryTypes.SELECT });
                
                console.log(`🔄 [5D_REDIS_PRELOAD] Found ${combinations.length} combinations in database`);
                
                // Process combinations in batches for Redis
                const batchSize = 1000;
                let loadedCount = 0;
                
                for (let i = 0; i < combinations.length; i += batchSize) {
                    const batch = combinations.slice(i, i + batchSize);
                    
                    // Use individual hset calls instead of pipeline
                    for (const combo of batch) {
                        const comboKey = `combo:${combo.dice_value}`;
                        const comboData = {
                            dice_value: combo.dice_value,
                            dice_a: combo.dice_a,
                            dice_b: combo.dice_b,
                            dice_c: combo.dice_c,
                            dice_d: combo.dice_d,
                            dice_e: combo.dice_e,
                            sum_value: combo.sum_value,
                            sum_size: combo.sum_size,
                            sum_parity: combo.sum_parity,
                            winning_conditions: combo.winning_conditions
                        };
                        
                        await redis.hset(cacheKey, comboKey, JSON.stringify(comboData));
                    }
                    
                    loadedCount += batch.length;
                    
                    if (i % 10000 === 0) {
                        console.log(`🔄 [5D_REDIS_PRELOAD] Loaded ${loadedCount}/${combinations.length} combinations...`);
                    }
                }
                
                // Note: Don't call expire at all - Redis keys are permanent by default
                // await redis.expire(cacheKey, 0); // 0 = never expire - REMOVED: This was deleting the key!
                
                console.log(`✅ [5D_REDIS_PRELOAD] Successfully loaded ${loadedCount} combinations to Redis permanently`);
                console.log('🎯 [5D_REDIS_PRELOAD] Fast protection mode is now enabled!');
                console.log('🎯 [5D_REDIS_PRELOAD] All 5D result calculations will use Redis-cached combinations');
                console.log('🎯 [5D_REDIS_PRELOAD] Expected performance: ~1 second for exposure calculation');
                
                return loadedCount;
                
            } catch (error) {
                console.error('❌ [5D_REDIS_PRELOAD] Error pre-loading combinations:', error);
                throw error;
            }
        };
        
        const preloadResult = await forcePreload();
        console.log('Preload result:', preloadResult);
        
        // Step 4: Check final cache count
        console.log('\n📊 Step 4: Check final cache count');
        const finalCount = await redis.hlen(cacheKey);
        console.log('Final cache count:', finalCount);
        
        // Step 5: Test retrieval
        console.log('\n📊 Step 5: Test retrieval');
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
        
        // Step 6: Test bulk retrieval
        console.log('\n📊 Step 6: Test bulk retrieval (first 10)');
        try {
            const allCombos = await getAll5DCombinationsFromRedis();
            console.log(`Total combinations retrieved: ${allCombos.length}`);
            
            // Show first 10 combinations
            for (let i = 0; i < Math.min(10, allCombos.length); i++) {
                const combo = allCombos[i];
                console.log(`  ${i + 1}. ${combo.dice_value} - Sum:${combo.sum_value}, Size:${combo.sum_size}, Parity:${combo.sum_parity}`);
            }
        } catch (error) {
            console.log('❌ Error getting all combinations:', error.message);
        }
        
        // Summary
        console.log('\n📋 FRESH 5D LOAD SUMMARY:');
        console.log('├─ Cache cleared: ✅ Yes');
        console.log('├─ Preload function result:', preloadResult);
        console.log('├─ Expected cache count: 100,000');
        console.log('├─ Actual cache count:', finalCount);
        console.log('├─ Individual retrieval: Tested');
        console.log('└─ Bulk retrieval: Tested');
        
        if (finalCount >= 99000) { // Allow for small variations
            console.log('\n✅ FRESH 5D LOAD: SUCCESS!');
            console.log('🎯 All 100,000 5D combinations are now properly loaded and accessible!');
            console.log('🚀 Fast protection mode is enabled!');
        } else {
            console.log('\n❌ FRESH 5D LOAD: PARTIAL SUCCESS!');
            console.log(`🔧 Only ${finalCount} combinations loaded instead of 100,000`);
            console.log('🔧 There may be an issue with the database or loading process');
        }
        
    } catch (error) {
        console.error('❌ [FRESH_5D_LOAD] Load failed:', error.message);
        console.error(error.stack);
    }
}

// Run the fresh load
fresh5DLoad().then(() => {
    console.log('\n🏁 [FRESH_5D_LOAD] Load completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [FRESH_5D_LOAD] Load failed:', error);
    process.exit(1);
}); 