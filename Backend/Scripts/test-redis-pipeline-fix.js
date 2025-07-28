const unifiedRedis = require('../config/unifiedRedisManager');
const gameLogicService = require('../services/gameLogicService');

async function testRedisPipelineFix() {
    console.log('🧪 Testing Redis pipeline fix...');
    
    try {
        // Initialize Redis
        await unifiedRedis.initialize();
        console.log('✅ Redis initialized');
        
        // Test data
        const testBetData = {
            userId: 13,
            gameType: 'wingo',
            duration: 30,
            timeline: 'default',
            periodId: 'test_pipeline_' + Date.now(),
            betType: 'COLOR',
            betValue: 'red',
            odds: 2,
            grossBetAmount: 1,
            platformFee: 0.02,
            netBetAmount: 0.98
        };
        
        console.log('📊 Test bet data:', testBetData);
        
        // Test the fixed storeBetInRedisWithTimeline function
        console.log('\n🎯 Testing storeBetInRedisWithTimeline...');
        const result = await gameLogicService.storeBetInRedisWithTimeline(testBetData);
        
        if (result) {
            console.log('✅ storeBetInRedisWithTimeline succeeded!');
            
            // Verify the data was stored correctly
            const redis = unifiedRedis.getHelper().getClient();
            const exposureKey = `exposure:${testBetData.gameType}:${testBetData.duration}:${testBetData.timeline}:${testBetData.periodId}`;
            const betsKey = `bets:${testBetData.gameType}:${testBetData.duration}:${testBetData.timeline}:${testBetData.periodId}`;
            
            const exposureData = await redis.hgetall(exposureKey);
            const betsData = await redis.hgetall(betsKey);
            
            console.log('📊 Exposure data:', exposureData);
            console.log('📊 Bets data:', betsData);
            
            // Clean up test data
            await redis.del(exposureKey);
            await redis.del(betsKey);
            console.log('🧹 Test data cleaned up');
            
        } else {
            console.log('❌ storeBetInRedisWithTimeline failed');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await unifiedRedis.cleanup();
        console.log('🔌 Redis connection closed');
    }
}

// Run the test
if (require.main === module) {
    testRedisPipelineFix()
        .then(() => {
            console.log('\n✅ Redis pipeline fix test completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Redis pipeline fix test failed:', error);
            process.exit(1);
        });
}

module.exports = { testRedisPipelineFix }; 