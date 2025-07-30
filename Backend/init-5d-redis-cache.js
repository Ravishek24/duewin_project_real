const { preload5DCombinationsToRedis } = require('./services/gameLogicService');
const unifiedRedis = require('./config/unifiedRedisManager');

async function initialize5DRedisCache() {
    try {
        console.log('🚀 [5D_CACHE_INIT] Starting 5D Redis cache initialization...');
        console.log('🚀 [5D_CACHE_INIT] This will load all 100,000 combinations into Redis for fast access');
        console.log('🚀 [5D_CACHE_INIT] Using existing unified Redis manager - no separate initialization needed');
        
        // Ensure unified Redis is initialized (it should already be from server startup)
        if (!unifiedRedis.isInitialized) {
            console.log('🔄 [5D_CACHE_INIT] Initializing unified Redis manager...');
            await unifiedRedis.initialize();
        } else {
            console.log('✅ [5D_CACHE_INIT] Unified Redis manager already initialized');
        }
        
        const startTime = Date.now();
        
        // Pre-load all combinations to Redis using existing infrastructure
        const loadedCount = await preload5DCombinationsToRedis();
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log('✅ [5D_CACHE_INIT] Cache initialization completed successfully!');
        console.log(`📊 [5D_CACHE_INIT] Statistics:`);
        console.log(`   - Combinations loaded: ${loadedCount}`);
        console.log(`   - Time taken: ${duration}ms`);
        console.log(`   - Average speed: ${(loadedCount / (duration / 1000)).toFixed(0)} combinations/second`);
        
        if (loadedCount > 0) {
            console.log('🎯 [5D_CACHE_INIT] Fast protection mode is now enabled!');
            console.log('🎯 [5D_CACHE_INIT] All 5D result calculations will use Redis-cached combinations');
            console.log('🎯 [5D_CACHE_INIT] Expected performance: ~1 second for exposure calculation');
        } else {
            console.log('⚠️ [5D_CACHE_INIT] No combinations loaded, falling back to database queries');
        }
        
        console.log('✅ [5D_CACHE_INIT] Initialization script completed');
        
    } catch (error) {
        console.error('❌ [5D_CACHE_INIT] Error during cache initialization:', error);
        process.exit(1);
    }
}

// Run the initialization
initialize5DRedisCache().then(() => {
    console.log('✅ [5D_CACHE_INIT] Script completed successfully');
    process.exit(0);
}).catch(error => {
    console.error('❌ [5D_CACHE_INIT] Script failed:', error);
    process.exit(1);
});