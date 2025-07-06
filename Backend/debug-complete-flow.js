const { updateBetExposure, storeBetInRedisWithTimeline, processBet, ensureModelsInitialized } = require('./services/gameLogicService');
const redisClient = require('./config/redis');

// Import the game logic functions (simplified versions for debugging)
function checkWinCondition(combination, betType, betValue) {
    switch (betType) {
        case 'NUMBER':
            return combination.number === parseInt(betValue);
        case 'COLOR':
            if (betValue === 'red') {
                return combination.color === 'red' || combination.color === 'red_violet';
            }
            if (betValue === 'green') {
                return combination.color === 'green' || combination.color === 'green_violet';
            }
            return combination.color === betValue;
        case 'SIZE':
            return combination.size.toLowerCase() === betValue.toLowerCase();
        case 'PARITY':
            return combination.parity === betValue;
        default:
            return false;
    }
}

const getColorForNumber = (number) => {
    const colorMap = {
        0: 'red_violet',
        1: 'green',
        2: 'red',
        3: 'green',
        4: 'red',
        5: 'green_violet',
        6: 'red',
        7: 'green',
        8: 'red',
        9: 'green'
    };
    return colorMap[number];
};

async function debugCompleteFlow() {
    try {
        console.log('🔧 [COMPLETE_DEBUG] ==========================================');
        console.log('🔧 [COMPLETE_DEBUG] Testing complete production bet flow');
        console.log('🔧 [COMPLETE_DEBUG] ==========================================');

        // Initialize models
        console.log('🔧 Initializing models...');
        await ensureModelsInitialized();

        const testData = {
            gameType: 'wingo',
            duration: 30,
            timeline: 'default',
            periodId: '20250706000001849',
            userId: 13,
            betType: 'COLOR',
            betValue: 'red',
            grossBetAmount: 100,
            platformFee: 2,
            netBetAmount: 98,
            odds: 2
        };

        console.log('📊 [COMPLETE_DEBUG] Test data:', testData);

        // Clear existing exposure data
        const exposureKey = `exposure:${testData.gameType}:${testData.duration}:${testData.timeline}:${testData.periodId}`;
        const deletedCount = await redisClient.del(exposureKey);
        console.log('🧹 [COMPLETE_DEBUG] Cleared exposure key:', exposureKey, '- deleted count:', deletedCount);

        // Test 1: Direct updateBetExposure call
        console.log('\n🎯 [TEST 1] Testing direct updateBetExposure call...');
        try {
            await updateBetExposure(testData.gameType, testData.duration, testData.periodId, {
                betType: testData.betType,
                betValue: testData.betValue,
                netBetAmount: testData.netBetAmount,
                odds: testData.odds
            }, testData.timeline);
            
            const exposuresAfterDirect = await redisClient.hgetall(exposureKey);
            console.log('✅ [TEST 1] Direct updateBetExposure success');
            console.log('📊 [TEST 1] Exposures after direct call:', exposuresAfterDirect);
        } catch (error) {
            console.error('❌ [TEST 1] Direct updateBetExposure failed:', error.message);
        }

        // Clear for next test
        await redisClient.del(exposureKey);
        console.log('🧹 [TEST 1] Cleared exposure for next test');

        // Test 2: storeBetInRedisWithTimeline call
        console.log('\n🎯 [TEST 2] Testing storeBetInRedisWithTimeline call...');
        try {
            const redisResult = await storeBetInRedisWithTimeline(testData);
            console.log('📊 [TEST 2] storeBetInRedisWithTimeline result:', redisResult);
            
            const exposuresAfterRedis = await redisClient.hgetall(exposureKey);
            console.log('📊 [TEST 2] Exposures after storeBetInRedisWithTimeline:', exposuresAfterRedis);
            
            if (Object.keys(exposuresAfterRedis).length === 0) {
                console.error('❌ [TEST 2] Exposure hash is empty - updateBetExposure was not called or failed');
            } else {
                console.log('✅ [TEST 2] storeBetInRedisWithTimeline successfully created exposures');
            }
        } catch (error) {
            console.error('❌ [TEST 2] storeBetInRedisWithTimeline failed:', error.message);
            console.error('❌ [TEST 2] Stack:', error.stack);
        }

        // Clear for next test  
        await redisClient.del(exposureKey);
        console.log('🧹 [TEST 2] Cleared exposure for next test');

        // Test 3: Check for any Redis errors during updateBetExposure
        console.log('\n🎯 [TEST 3] Testing updateBetExposure with error monitoring...');
        try {
            // Monitor Redis commands
            let redisCommands = [];
            const originalHincrby = redisClient.hincrby;
            redisClient.hincrby = async function(...args) {
                redisCommands.push({ command: 'hincrby', args: args, timestamp: new Date().toISOString() });
                try {
                    const result = await originalHincrby.apply(this, args);
                    redisCommands[redisCommands.length - 1].result = result;
                    return result;
                } catch (error) {
                    redisCommands[redisCommands.length - 1].error = error.message;
                    throw error;
                }
            };

            await updateBetExposure(testData.gameType, testData.duration, testData.periodId, {
                betType: testData.betType,
                betValue: testData.betValue,
                netBetAmount: testData.netBetAmount,
                odds: testData.odds
            }, testData.timeline);

            // Restore original hincrby
            redisClient.hincrby = originalHincrby;

            console.log('📊 [TEST 3] Redis commands executed:', redisCommands);
            
            const exposuresAfterMonitoring = await redisClient.hgetall(exposureKey);
            console.log('📊 [TEST 3] Final exposures:', exposuresAfterMonitoring);

        } catch (error) {
            console.error('❌ [TEST 3] updateBetExposure with monitoring failed:', error.message);
        }

        // Test 4: Check Redis connection and permissions
        console.log('\n🎯 [TEST 4] Testing Redis connection and permissions...');
        try {
            // Test basic Redis operations
            await redisClient.set('test_key', 'test_value');
            const testValue = await redisClient.get('test_key');
            console.log('✅ [TEST 4] Basic Redis operations work:', testValue);
            
            // Test hash operations
            await redisClient.hset('test_hash', 'test_field', 'test_value');
            const hashValue = await redisClient.hget('test_hash', 'test_field');
            console.log('✅ [TEST 4] Redis hash operations work:', hashValue);
            
            // Test hincrby specifically
            await redisClient.hincrby('test_hash', 'number_field', 100);
            const incrValue = await redisClient.hget('test_hash', 'number_field');
            console.log('✅ [TEST 4] Redis hincrby operations work:', incrValue);
            
            // Cleanup
            await redisClient.del('test_key', 'test_hash');
            
        } catch (error) {
            console.error('❌ [TEST 4] Redis operations failed:', error.message);
        }

        console.log('\n🔧 [COMPLETE_DEBUG] ==========================================');
        console.log('🔧 [COMPLETE_DEBUG] Complete flow testing finished');
        console.log('🔧 [COMPLETE_DEBUG] ==========================================');

    } catch (error) {
        console.error('❌ [COMPLETE_DEBUG] Error during complete flow debug:', error.message);
        console.error('❌ [COMPLETE_DEBUG] Stack:', error.stack);
    } finally {
        process.exit(0);
    }
}

// Run the complete flow debug
debugCompleteFlow(); 