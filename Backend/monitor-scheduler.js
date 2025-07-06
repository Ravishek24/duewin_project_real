const Redis = require('ioredis');
const gameLogicService = require('./services/gameLogicService');

// Redis client setup
const redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: process.env.REDIS_DB || 0
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis client connected'));
redisClient.on('ready', () => console.log('Redis client ready'));

/**
 * Monitor scheduler and track result generation
 */
async function monitorScheduler() {
    try {
        console.log('🔍 [SCHEDULER_MONITOR] ==========================================');
        console.log('🔍 [SCHEDULER_MONITOR] Starting scheduler monitoring');
        console.log('🔍 [SCHEDULER_MONITOR] ==========================================');

        // Subscribe to scheduler events
        const subscriber = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: process.env.REDIS_PORT || 6379,
            password: process.env.REDIS_PASSWORD || null,
            db: process.env.REDIS_DB || 0
        });

        subscriber.on('error', (err) => console.log('Subscriber Error', err));
        subscriber.on('connect', () => console.log('Subscriber connected'));
        subscriber.on('ready', () => console.log('Subscriber ready'));

        // Subscribe to game scheduler events
        await subscriber.subscribe('game_scheduler:period_result');
        console.log('📡 [SCHEDULER_MONITOR] Subscribed to game_scheduler:period_result');

        // Monitor for 5 minutes
        const monitorDuration = 5 * 60 * 1000; // 5 minutes
        const startTime = Date.now();

        subscriber.on('message', async (channel, message) => {
            try {
                const eventData = JSON.parse(message);
                console.log('\n🎲 [SCHEDULER_MONITOR] ==========================================');
                console.log('🎲 [SCHEDULER_MONITOR] SCHEDULER EVENT RECEIVED');
                console.log('🎲 [SCHEDULER_MONITOR] ==========================================');
                console.log('🎲 [SCHEDULER_MONITOR] Channel:', channel);
                console.log('🎲 [SCHEDULER_MONITOR] Event data:', JSON.stringify(eventData, null, 2));

                // Analyze the result
                const { gameType, duration, periodId, result, winners, source, roomId } = eventData;
                
                console.log('\n🔍 [SCHEDULER_MONITOR] Result Analysis:');
                console.log('🔍 [SCHEDULER_MONITOR] Game Type:', gameType);
                console.log('🔍 [SCHEDULER_MONITOR] Duration:', duration);
                console.log('🔍 [SCHEDULER_MONITOR] Period ID:', periodId);
                console.log('🔍 [SCHEDULER_MONITOR] Source:', source);
                console.log('🔍 [SCHEDULER_MONITOR] Result:', result);
                console.log('🔍 [SCHEDULER_MONITOR] Winner count:', winners.length);
                console.log('🔍 [SCHEDULER_MONITOR] Winners:', winners.map(w => ({ userId: w.userId, winnings: w.winnings })));

                // Check if this is a single user scenario
                const uniqueUsers = [...new Set(winners.map(w => w.userId))];
                console.log('🔍 [SCHEDULER_MONITOR] Unique users who won:', uniqueUsers);

                if (uniqueUsers.length === 1) {
                    console.log('⚠️ [SCHEDULER_MONITOR] SINGLE USER WON - This might indicate protection failure!');
                    
                    // Check if protection should have been active
                    const userCount = await gameLogicService.getUniqueUserCount(gameType, duration, periodId, 'default');
                    console.log('🔍 [SCHEDULER_MONITOR] Total unique users in period:', userCount);
                    
                    if (userCount < 100) {
                        console.log('❌ [SCHEDULER_MONITOR] PROTECTION FAILURE: Single user won despite protection threshold not being met!');
                        console.log('❌ [SCHEDULER_MONITOR] User count:', userCount, 'Threshold: 100');
                    } else {
                        console.log('ℹ️ [SCHEDULER_MONITOR] Multiple users in period, protection not needed');
                    }
                } else if (uniqueUsers.length === 0) {
                    console.log('✅ [SCHEDULER_MONITOR] No winners - protection working correctly');
                } else {
                    console.log('ℹ️ [SCHEDULER_MONITOR] Multiple users won - normal operation');
                }

                console.log('🎲 [SCHEDULER_MONITOR] ==========================================\n');

            } catch (error) {
                console.error('❌ [SCHEDULER_MONITOR] Error processing scheduler event:', error);
            }
        });

        console.log('⏰ [SCHEDULER_MONITOR] Monitoring for', monitorDuration / 1000, 'seconds...');
        console.log('⏰ [SCHEDULER_MONITOR] Waiting for scheduler events...');

        // Wait for the monitoring duration
        await new Promise(resolve => setTimeout(resolve, monitorDuration));

        console.log('\n🔍 [SCHEDULER_MONITOR] ==========================================');
        console.log('🔍 [SCHEDULER_MONITOR] Monitoring completed');
        console.log('🔍 [SCHEDULER_MONITOR] ==========================================');

        // Unsubscribe and close
        await subscriber.unsubscribe('game_scheduler:period_result');
        await subscriber.quit();

    } catch (error) {
        console.error('❌ [SCHEDULER_MONITOR] Error in scheduler monitoring:', error);
    } finally {
        await redisClient.quit();
        console.log('🔌 Redis connection closed');
    }
}

// Run the monitor
monitorScheduler(); 