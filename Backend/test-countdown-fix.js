const unifiedRedis = require('./config/unifiedRedisManager');
const { getCurrentPeriod } = require('./services/periodService');

// Test the countdown fix
async function testCountdownFix() {
    try {
        console.log('🧪 Testing countdown timer fix...');
        
        // Initialize Redis
        await unifiedRedis.initialize();
        console.log('✅ Redis initialized');
        
        // Test data flow for a specific game
        const gameType = 'wingo';
        const duration = 30;
        
        console.log(`\n🔍 Testing ${gameType} ${duration}s game...`);
        
        // Get current period from period service
        const currentPeriod = await getCurrentPeriod(gameType, duration);
        console.log('📅 Current period from period service:', {
            periodId: currentPeriod.periodId,
            timeRemaining: currentPeriod.timeRemaining,
            bettingOpen: currentPeriod.bettingOpen,
            endTime: currentPeriod.endTime
        });
        
        // Simulate storing in Redis (like game scheduler does)
        const redisKey = `game_scheduler:${gameType}:${duration}:current`;
        const periodData = {
            periodId: currentPeriod.periodId,
            gameType,
            duration,
            startTime: currentPeriod.startTime.toISOString(),
            endTime: currentPeriod.endTime.toISOString(),
            timeRemaining: currentPeriod.timeRemaining,
            bettingOpen: currentPeriod.bettingOpen,
            updatedAt: new Date().toISOString(),
            source: 'test_script'
        };
        
        // Store in Redis using JSON.stringify (like game scheduler does)
        const jsonString = JSON.stringify(periodData);
        await unifiedRedis.getHelper().set(redisKey, jsonString);
        await unifiedRedis.getHelper().expire(redisKey, 3600);
        console.log('💾 Stored period data in Redis');
        
        // Now read from Redis (like WebSocket service does)
        const retrievedData = await unifiedRedis.getHelper().get(redisKey);
        console.log('📥 Retrieved data from Redis:', {
            dataType: typeof retrievedData,
            isObject: typeof retrievedData === 'object',
            hasPeriodId: retrievedData && retrievedData.periodId,
            timeRemaining: retrievedData ? retrievedData.timeRemaining : 'N/A'
        });
        
        // Test the parsing logic (like WebSocket service does)
        const parsed = typeof retrievedData === 'string' ? JSON.parse(retrievedData) : retrievedData;
        console.log('🔧 Parsed data:', {
            periodId: parsed.periodId,
            timeRemaining: parsed.timeRemaining,
            bettingOpen: parsed.bettingOpen
        });
        
        // Verify the data is correct
        if (parsed.periodId === currentPeriod.periodId && 
            parsed.timeRemaining === currentPeriod.timeRemaining) {
            console.log('✅ Countdown fix test PASSED - Data flow works correctly!');
        } else {
            console.log('❌ Countdown fix test FAILED - Data mismatch detected!');
        }
        
        // Clean up
        await unifiedRedis.getHelper().del(redisKey);
        console.log('🧹 Cleaned up test data');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        // Cleanup
        await unifiedRedis.cleanup();
        process.exit(0);
    }
}

// Run the test
testCountdownFix(); 