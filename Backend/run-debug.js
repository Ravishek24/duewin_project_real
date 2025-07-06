const debug = require('./debug-game-process');

async function runDebugExamples() {
    try {
        console.log('🎯 [DEBUG_RUNNER] Starting debug examples...\n');

        // Example 1: Monitor a specific period (replace with your actual period ID)
        console.log('📊 Example 1: Monitoring period...');
        await debug.monitorPeriod('wingo', 30, '20250706000000252', 'default');

        // Example 2: Show all Redis keys for Wingo 30s
        console.log('📊 Example 2: Showing Redis keys...');
        await debug.showAllRedisKeys('wingo', 30);

        // Example 3: Simulate bet processing (replace with your actual bet data)
        console.log('📊 Example 3: Simulating bet processing...');
        const sampleBetData = {
            gameType: 'wingo',
            duration: 30,
            periodId: '20250706000000252',
            timeline: 'default',
            userId: 13,
            betAmount: 10,
            betType: 'COLOR',
            betValue: 'red',
            odds: 2
        };
        
        await debug.simulateBetProcessing(sampleBetData);

        // Example 4: Monitor result generation
        console.log('📊 Example 4: Monitoring result generation...');
        await debug.monitorResultGeneration('wingo', 30, '20250706000000252', 'default');

        console.log('✅ [DEBUG_RUNNER] All debug examples completed!');

    } catch (error) {
        console.error('❌ [DEBUG_RUNNER] Error running debug examples:', error);
    }
}

// Run the examples
runDebugExamples().catch(console.error); 