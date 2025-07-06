const redis = require('redis');

// Redis client setup
const redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));

/**
 * Simple debug script to monitor Redis operations
 */
async function simpleDebug() {
    try {
        await redisClient.connect();
        console.log('🔍 [SIMPLE_DEBUG] Redis connected successfully');

        // Monitor all Redis operations
        const originalHset = redisClient.hset.bind(redisClient);
        const originalHgetall = redisClient.hgetall.bind(redisClient);
        const originalGet = redisClient.get.bind(redisClient);
        const originalSet = redisClient.set.bind(redisClient);

        // Override Redis methods to log operations
        redisClient.hset = async (...args) => {
            console.log('📝 [REDIS_HSET]', {
                key: args[0],
                field: args[1],
                value: typeof args[2] === 'string' ? args[2].substring(0, 100) + '...' : args[2]
            });
            return originalHset(...args);
        };

        redisClient.hgetall = async (...args) => {
            console.log('📖 [REDIS_HGETALL]', { key: args[0] });
            const result = await originalHgetall(...args);
            if (result) {
                console.log('📖 [REDIS_HGETALL_RESULT]', {
                    key: args[0],
                    fields: Object.keys(result).length,
                    sampleData: Object.keys(result).slice(0, 3)
                });
            }
            return result;
        };

        redisClient.get = async (...args) => {
            console.log('📖 [REDIS_GET]', { key: args[0] });
            return originalGet(...args);
        };

        redisClient.set = async (...args) => {
            console.log('📝 [REDIS_SET]', { 
                key: args[0], 
                value: typeof args[1] === 'string' ? args[1].substring(0, 100) + '...' : args[1]
            });
            return originalSet(...args);
        };

        console.log('🎯 [SIMPLE_DEBUG] Redis monitoring enabled');
        console.log('🎯 [SIMPLE_DEBUG] Now all Redis operations will be logged');
        console.log('🎯 [SIMPLE_DEBUG] Press Ctrl+C to stop monitoring');

        // Keep the process running
        process.on('SIGINT', async () => {
            console.log('\n🛑 [SIMPLE_DEBUG] Stopping Redis monitoring...');
            await redisClient.quit();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ [SIMPLE_DEBUG] Error setting up debug environment:', error);
    }
}

/**
 * Monitor specific period
 */
async function monitorPeriod(gameType, duration, periodId, timeline = 'default') {
    try {
        console.log('\n🔍 [MONITOR] ==========================================');
        console.log('🔍 [MONITOR] Monitoring period:', { gameType, duration, periodId, timeline });

        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const exposureKey = `exposure:${gameType}:${duration}:${periodId}`;
        
        console.log('📊 [MONITOR] Bet Hash Key:', betHashKey);
        console.log('📊 [MONITOR] Exposure Key:', exposureKey);

        // Get bet data
        const betsData = await redisClient.hgetall(betHashKey);
        console.log('📊 [MONITOR] Total bets:', Object.keys(betsData).length);
        
        if (Object.keys(betsData).length > 0) {
            const sampleBet = JSON.parse(Object.values(betsData)[0]);
            console.log('📊 [MONITOR] Sample bet:', {
                userId: sampleBet.userId,
                betType: sampleBet.betType,
                betValue: sampleBet.betValue,
                betAmount: sampleBet.betAmount
            });
        }

        // Get exposure data
        const exposureData = await redisClient.hgetall(exposureKey);
        console.log('📊 [MONITOR] Total exposures:', Object.keys(exposureData).length);
        
        if (Object.keys(exposureData).length > 0) {
            const exposuresInRupees = {};
            for (const [key, value] of Object.entries(exposureData)) {
                exposuresInRupees[key] = `${(parseInt(value) / 100).toFixed(2)}₹`;
            }
            console.log('📊 [MONITOR] Exposures:', exposuresInRupees);
        }

        // Count unique users
        const uniqueUsers = new Set();
        for (const [betId, betJson] of Object.entries(betsData)) {
            try {
                const bet = JSON.parse(betJson);
                if (bet.userId) {
                    uniqueUsers.add(bet.userId);
                }
            } catch (parseError) {
                // Skip invalid bets
            }
        }

        console.log('👥 [MONITOR] Unique users:', uniqueUsers.size);
        console.log('👥 [MONITOR] User IDs:', Array.from(uniqueUsers));
        console.log('👥 [MONITOR] Threshold (100):', uniqueUsers.size >= 100 ? '✅ MET' : '❌ NOT MET');

        console.log('🔍 [MONITOR] ==========================================\n');

    } catch (error) {
        console.error('❌ [MONITOR] Error monitoring period:', error);
    }
}

/**
 * Show all Redis keys for a game
 */
async function showAllRedisKeys(gameType, duration) {
    try {
        console.log('\n🔍 [REDIS_KEYS] ==========================================');
        console.log('🔍 [REDIS_KEYS] Showing all Redis keys for:', { gameType, duration });

        const allKeys = await redisClient.keys('*');
        const gameKeys = allKeys.filter(key => key.includes(gameType) && key.includes(duration.toString()));

        console.log('🔍 [REDIS_KEYS] Total keys found:', gameKeys.length);
        
        for (const key of gameKeys) {
            const keyType = await redisClient.type(key);
            console.log(`🔍 [REDIS_KEYS] ${key} (${keyType})`);
            
            if (keyType === 'hash') {
                const hashData = await redisClient.hgetall(key);
                console.log(`🔍 [REDIS_KEYS] Hash fields: ${Object.keys(hashData).length}`);
            }
        }

        console.log('🔍 [REDIS_KEYS] ==========================================\n');

    } catch (error) {
        console.error('❌ [REDIS_KEYS] Error showing Redis keys:', error);
    }
}

// Export functions
module.exports = {
    simpleDebug,
    monitorPeriod,
    showAllRedisKeys
};

// Run if called directly
if (require.main === module) {
    simpleDebug().catch(console.error);
} 