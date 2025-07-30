const unifiedRedis = require('./config/unifiedRedisManager');

async function initialize5DCache() {
    console.log('🚀 [5D_CACHE_INIT] Starting 5D Redis cache initialization...');
    
    try {
        // Initialize Redis manager
        console.log('🔄 [5D_CACHE_INIT] Initializing Redis manager...');
        await unifiedRedis.initialize();
        console.log('✅ [5D_CACHE_INIT] Redis manager initialized');
        
        const redis = unifiedRedis.getHelper();
        
        // Test Redis connection
        console.log('🔄 [5D_CACHE_INIT] Testing Redis connection...');
        await redis.ping();
        console.log('✅ [5D_CACHE_INIT] Redis connection successful');
        
        // Check if cache already exists
        const cacheKey = '5d_combinations_cache';
        const existingCount = await redis.hlen(cacheKey);
        
        if (existingCount > 0) {
            console.log(`⚠️ [5D_CACHE_INIT] Cache already exists with ${existingCount} combinations`);
            console.log('💡 To reinitialize, first clear the cache: redis-cli del 5d_combinations_cache');
            return;
        }
        
        console.log('🔄 [5D_CACHE_INIT] Loading 5D combinations from database...');
        
        // Import the preload function
        const { preload5DCombinationsToRedis } = require('./services/gameLogicService');
        
        // Load combinations
        await preload5DCombinationsToRedis();
        
        // Verify the load
        const finalCount = await redis.hlen(cacheKey);
        console.log(`✅ [5D_CACHE_INIT] Successfully loaded ${finalCount} combinations`);
        
        if (finalCount >= 100000) {
            console.log('🎯 [5D_CACHE_INIT] 5D Redis cache initialization completed successfully!');
        } else {
            console.log('⚠️ [5D_CACHE_INIT] Warning: Expected 100,000 combinations, got', finalCount);
        }
        
    } catch (error) {
        console.error('❌ [5D_CACHE_INIT] Initialization failed:', error.message);
        console.error(error.stack);
    }
}

// Run the initialization
initialize5DCache().then(() => {
    console.log('\n🏁 [5D_CACHE_INIT] Initialization completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [5D_CACHE_INIT] Initialization failed:', error);
    process.exit(1);
}); 