const debug = require('./simple-debug');

async function runSimpleDebug() {
    try {
        console.log('🎯 [SIMPLE_DEBUG_RUNNER] Starting simple debug...\n');

        // Example 1: Monitor a specific period (replace with your actual period ID)
        console.log('📊 Example 1: Monitoring period...');
        await debug.monitorPeriod('wingo', 30, '20250706000000252', 'default');

        // Example 2: Show all Redis keys for Wingo 30s
        console.log('📊 Example 2: Showing Redis keys...');
        await debug.showAllRedisKeys('wingo', 30);

        console.log('✅ [SIMPLE_DEBUG_RUNNER] Simple debug completed!');

    } catch (error) {
        console.error('❌ [SIMPLE_DEBUG_RUNNER] Error running simple debug:', error);
    }
}

// Run the examples
runSimpleDebug().catch(console.error); 