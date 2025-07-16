const { updateBetExposure, initializeGameCombinations } = require('./services/gameLogicService');
const Redis = require('ioredis');
const { CACHE } = require('./config/constants');

// Redis configuration
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: process.env.REDIS_DB || 0,
    keyPrefix: CACHE.PREFIX,
    retryStrategy: function(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
};

// Create Redis client
const redisClient = new Redis(redisConfig);

async function testK3RealExposure() {
    try {
        console.log('🎲 [K3_REAL_EXPOSURE_TEST] Starting K3 real exposure test...');
        
        // Initialize game combinations
        await initializeGameCombinations();
        
        // Test different K3 bet types
        const testBets = [
            {
                bet_type: 'SUM_CATEGORY:Small',
                amount_after_tax: 100,
                netBetAmount: 100
            },
            {
                bet_type: 'SUM:10',
                amount_after_tax: 50,
                netBetAmount: 50
            },
            {
                bet_type: 'MATCHING_DICE:triple_any',
                amount_after_tax: 25,
                netBetAmount: 25
            },
            {
                bet_type: 'PATTERN:straight',
                amount_after_tax: 75,
                netBetAmount: 75
            }
        ];
        
        const gameType = 'k3';
        const duration = 60;
        const periodId = 'test_k3_exposure_' + Date.now();
        const timeline = 'default';
        
        console.log(`🎲 [K3_REAL_EXPOSURE_TEST] Testing with period: ${periodId}`);
        console.log('🎲 [K3_REAL_EXPOSURE_TEST] ==========================================');
        
        for (let i = 0; i < testBets.length; i++) {
            const bet = testBets[i];
            console.log(`\n🎲 [K3_REAL_EXPOSURE_TEST] Test ${i + 1}: ${bet.bet_type} - ₹${bet.amount_after_tax}`);
            console.log('🎲 [K3_REAL_EXPOSURE_TEST] ==========================================');
            
            await updateBetExposure(gameType, duration, periodId, bet, timeline);
            
            // Wait a moment between tests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        console.log('\n🎲 [K3_REAL_EXPOSURE_TEST] All tests completed!');
        console.log('🎲 [K3_REAL_EXPOSURE_TEST] Check the logs above to see real-time exposure calculation.');
        
    } catch (error) {
        console.error('❌ [K3_REAL_EXPOSURE_TEST] Error:', error);
    } finally {
        await redisClient.quit();
    }
}

// Run the test
testK3RealExposure(); 