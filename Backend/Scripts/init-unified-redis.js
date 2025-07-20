
// Backend/scripts/init-unified-redis.js
const unifiedRedis = require('../config/unifiedRedisManager');

/**
 * Initialize Unified Redis Manager
 * Run this before starting your application
 */
async function initializeUnifiedRedis() {
    try {
        console.log('🚀 Initializing Unified Redis Manager...');
        await unifiedRedis.initialize();
        console.log('✅ Unified Redis Manager initialized successfully');
        
        // Test the connections
        const healthCheck = await unifiedRedis.healthCheck();
        console.log('📊 Health Check Results:', healthCheck);
        
        // Show stats
        const stats = unifiedRedis.getStats();
        console.log('📈 Manager Stats:', stats);
        
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize Unified Redis Manager:', error.message);
        return false;
    }
}

// Run if called directly
if (require.main === module) {
    initializeUnifiedRedis()
        .then(success => {
            if (success) {
                console.log('🎉 Unified Redis Manager ready for use');
                process.exit(0);
            } else {
                console.error('💥 Failed to initialize Unified Redis Manager');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('💥 Unexpected error:', error);
            process.exit(1);
        });
}

module.exports = { initializeUnifiedRedis };
