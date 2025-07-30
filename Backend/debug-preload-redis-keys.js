const unifiedRedis = require('./config/unifiedRedisManager');

async function debugPreloadRedisKeys() {
    console.log('🔍 [PRELOAD_DEBUG] Debugging Redis keys during preload...');
    
    try {
        // Initialize Redis manager
        console.log('🔄 [PRELOAD_DEBUG] Initializing Redis manager...');
        await unifiedRedis.initialize();
        console.log('✅ [PRELOAD_DEBUG] Redis manager initialized');
        
        const redis = unifiedRedis.getHelper();
        
        // Clear any existing cache
        console.log('\n📊 Step 1: Clear existing cache');
        await redis.del('5d_combinations_cache');
        console.log('✅ Cache cleared');
        
        // Check initial state
        console.log('\n📊 Step 2: Check initial Redis state');
        const initialCount = await redis.hlen('5d_combinations_cache');
        console.log('Initial cache count:', initialCount);
        
        // Monitor Redis keys before preload
        console.log('\n📊 Step 3: Check all Redis keys before preload');
        try {
            const allKeys = await redis.keys('*');
            console.log('All Redis keys before preload:', allKeys);
            console.log('Total keys before preload:', allKeys.length);
        } catch (error) {
            console.log('❌ Could not get keys:', error.message);
        }
        
        // Start monitoring Redis during preload
        console.log('\n📊 Step 4: Start Redis monitoring during preload');
        
        // Import the preload function
        const { preload5DCombinationsToRedis } = require('./services/gameLogicService');
        
        // Run preload in background and monitor
        const preloadPromise = preload5DCombinationsToRedis();
        
        // Monitor Redis every 2 seconds during preload
        const monitorInterval = setInterval(async () => {
            try {
                const currentCount = await redis.hlen('5d_combinations_cache');
                console.log(`📊 Monitor: Cache count = ${currentCount}`);
                
                // Check if any keys exist
                const allKeys = await redis.keys('*');
                const cacheKeys = allKeys.filter(key => key.includes('5d') || key.includes('combo'));
                if (cacheKeys.length > 0) {
                    console.log(`📊 Monitor: Found cache-related keys: ${cacheKeys.slice(0, 5)}...`);
                }
                
            } catch (error) {
                console.log('❌ Monitor error:', error.message);
            }
        }, 2000);
        
        // Wait for preload to complete
        console.log('\n📊 Step 5: Waiting for preload to complete...');
        const preloadResult = await preloadPromise;
        clearInterval(monitorInterval);
        
        console.log('Preload completed with result:', preloadResult);
        
        // Check final state
        console.log('\n📊 Step 6: Check final Redis state');
        const finalCount = await redis.hlen('5d_combinations_cache');
        console.log('Final cache count:', finalCount);
        
        // Check all Redis keys after preload
        console.log('\n📊 Step 7: Check all Redis keys after preload');
        try {
            const allKeys = await redis.keys('*');
            console.log('All Redis keys after preload:', allKeys);
            console.log('Total keys after preload:', allKeys.length);
            
            // Look for any keys that might contain 5D data
            const potentialKeys = allKeys.filter(key => 
                key.includes('5d') || 
                key.includes('combo') || 
                key.includes('combination') ||
                key.includes('game')
            );
            
            if (potentialKeys.length > 0) {
                console.log('Potential 5D-related keys:', potentialKeys);
                
                // Check each potential key
                for (const key of potentialKeys) {
                    try {
                        const keyType = await redis.type(key);
                        console.log(`Key: ${key}, Type: ${keyType}`);
                        
                        if (keyType === 'hash') {
                            const hashCount = await redis.hlen(key);
                            console.log(`  └─ Hash count: ${hashCount}`);
                            
                            if (hashCount > 0) {
                                // Get a sample key from the hash
                                const sampleKeys = await redis.hkeys(key);
                                console.log(`  └─ Sample keys: ${sampleKeys.slice(0, 3)}...`);
                            }
                        }
                    } catch (error) {
                        console.log(`  └─ Error checking key ${key}:`, error.message);
                    }
                }
            }
        } catch (error) {
            console.log('❌ Could not get keys after preload:', error.message);
        }
        
        // Try to find the actual cache key
        console.log('\n📊 Step 8: Search for actual cache data');
        try {
            // Try different possible key names
            const possibleKeys = [
                '5d_combinations_cache',
                '5d_combinations',
                'combinations_5d',
                'game_combinations_5d',
                '5d_cache',
                'combinations_cache'
            ];
            
            for (const key of possibleKeys) {
                try {
                    const exists = await redis.exists(key);
                    if (exists) {
                        const keyType = await redis.type(key);
                        const count = keyType === 'hash' ? await redis.hlen(key) : 'N/A';
                        console.log(`✅ Found key: ${key}, Type: ${keyType}, Count: ${count}`);
                    }
                } catch (error) {
                    console.log(`❌ Error checking key ${key}:`, error.message);
                }
            }
        } catch (error) {
            console.log('❌ Error searching for cache data:', error.message);
        }
        
        // Summary
        console.log('\n📋 PRELOAD DEBUG SUMMARY:');
        console.log('├─ Preload function result:', preloadResult);
        console.log('├─ Expected cache count: 100,000');
        console.log('├─ Actual cache count:', finalCount);
        console.log('├─ Redis keys monitored: Yes');
        console.log('└─ Key search completed: Yes');
        
        if (finalCount === 0) {
            console.log('\n❌ PRELOAD DEBUG: DATA NOT FOUND!');
            console.log('🔧 The preload function is not storing data in the expected Redis key.');
            console.log('🔧 This suggests a Redis key mismatch or storage issue.');
        } else {
            console.log('\n✅ PRELOAD DEBUG: DATA FOUND!');
            console.log('🎯 The 5D combinations are properly stored.');
        }
        
    } catch (error) {
        console.error('❌ [PRELOAD_DEBUG] Debug failed:', error.message);
        console.error(error.stack);
    }
}

// Run the debug
debugPreloadRedisKeys().then(() => {
    console.log('\n🏁 [PRELOAD_DEBUG] Debug completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [PRELOAD_DEBUG] Debug failed:', error);
    process.exit(1);
}); 