const { redis } = require('./config/redisConfig');

async function testRedisKeys() {
    try {
        const gameType = 'wingo';
        const duration = 30;
        const periodId = '20250706000000483';
        const timeline = 'default';

        console.log('🔍 [REDIS_KEY_TEST] ==========================================');
        console.log('🔍 [REDIS_KEY_TEST] Testing Redis key patterns');
        console.log('🔍 [REDIS_KEY_TEST] ==========================================');

        // Keys that backend is looking for (WRONG)
        const backendExposureKey = `exposure:${gameType}:${duration}:${periodId}`;
        const backendBetKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;

        // Keys where data actually is (CORRECT)
        const actualExposureKey = `duewin:exposure:${gameType}:${duration}:${periodId}`;
        const actualBetKey = `duewin:bets:${gameType}:${duration}:${timeline}:${periodId}`;

        console.log('\n🔍 [BACKEND KEYS] (What backend is looking for):');
        console.log(`📊 Exposure key: ${backendExposureKey}`);
        console.log(`🎲 Bet key: ${backendBetKey}`);

        console.log('\n🔍 [ACTUAL KEYS] (Where data actually is):');
        console.log(`📊 Exposure key: ${actualExposureKey}`);
        console.log(`🎲 Bet key: ${actualBetKey}`);

        // Check what backend would find
        const backendExposureData = await redis.hGetAll(backendExposureKey);
        const backendBetData = await redis.hGetAll(backendBetKey);

        console.log('\n📊 [BACKEND FINDS] (Empty because wrong keys):');
        console.log(`📊 Backend exposure data:`, backendExposureData);
        console.log(`🎲 Backend bet data:`, backendBetData);

        // Check what's actually there
        const actualExposureData = await redis.hGetAll(actualExposureKey);
        const actualBetData = await redis.hGetAll(actualBetKey);

        console.log('\n📊 [ACTUAL DATA] (What backend should be looking for):');
        console.log(`📊 Actual exposure data:`, actualExposureData);
        console.log(`🎲 Actual bet data:`, actualBetData);

        // Simulate what backend would think
        const backendUserCount = Object.keys(backendBetData).length;
        const actualUserCount = Object.keys(actualBetData).length;

        console.log('\n👥 [USER COUNT COMPARISON]:');
        console.log(`👥 Backend thinks user count: ${backendUserCount} (WRONG)`);
        console.log(`👥 Actual user count: ${actualUserCount} (CORRECT)`);
        console.log(`🛡️ Backend would trigger protection? ${backendUserCount < 100} (WRONG)`);
        console.log(`🛡️ Should trigger protection? ${actualUserCount < 100} (CORRECT)`);

        console.log('\n🔍 [REDIS_KEY_TEST] ==========================================');
        console.log('🔍 [REDIS_KEY_TEST] Test completed');
        console.log('🔍 [REDIS_KEY_TEST] ==========================================');

    } catch (error) {
        console.error('❌ Error testing Redis keys:', error);
    } finally {
        process.exit(0);
    }
}

testRedisKeys(); 