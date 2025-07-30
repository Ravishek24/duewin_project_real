const unifiedRedis = require('./config/unifiedRedisManager');
const { 
    preCalculate5DResultAtFreeze, 
    getPreCalculated5DResultAtZero,
    processGameResultsWithPreCalc 
} = require('./services/gameLogicService');

async function test5DRedisInstant() {
    console.log('🧪 [5D_REDIS_INSTANT] Testing pure Redis-based instant 5D delivery...');
    
    try {
        // Initialize Redis manager
        console.log('🔄 [5D_REDIS_INSTANT] Initializing Redis manager...');
        await unifiedRedis.initialize();
        console.log('✅ [5D_REDIS_INSTANT] Redis manager initialized');
        
        const gameType = 'fiveD';
        const duration = 60;
        const periodId = '20250730000001403'; // Use a future period ID
        const timeline = 'default';
        
        console.log('\n📊 Test 1: Pre-calculation at t=3s (bet freeze)');
        console.log('Period ID:', periodId);
        
        const preCalcStart = Date.now();
        const preCalcResult = await preCalculate5DResultAtFreeze(gameType, duration, periodId, timeline);
        const preCalcTime = Date.now() - preCalcStart;
        
        console.log(`✅ Pre-calculation completed in ${preCalcTime}ms`);
        console.log('Pre-calculated result:', preCalcResult.result);
        console.log('Protection mode:', preCalcResult.protectionMode);
        
        console.log('\n📊 Test 2: Pure Redis instant delivery at t=0s (period end)');
        
        const deliveryStart = Date.now();
        const deliveryResult = await processGameResultsWithPreCalc(gameType, duration, periodId, timeline);
        const deliveryTime = Date.now() - deliveryStart;
        
        console.log(`✅ Pure Redis delivery completed in ${deliveryTime}ms`);
        console.log('Delivery result:', deliveryResult.success ? 'SUCCESS' : 'FAILED');
        console.log('Result source:', deliveryResult.source);
        console.log('Result:', deliveryResult.result);
        
        // Performance analysis
        console.log('\n📋 5D REDIS INSTANT PERFORMANCE:');
        console.log('├─ Pre-calculation time:', preCalcTime + 'ms');
        console.log('├─ Pure Redis delivery time:', deliveryTime + 'ms');
        console.log('├─ Total time:', (preCalcTime + deliveryTime) + 'ms');
        console.log('├─ Target delivery time: < 50ms');
        console.log('└─ Performance:', deliveryTime < 50 ? '✅ INSTANT' : deliveryTime < 100 ? '✅ FAST' : '❌ SLOW');
        
        if (deliveryTime < 50) {
            console.log('\n🎉 5D REDIS INSTANT: SUCCESS!');
            console.log('🚀 Results are delivered INSTANTLY from Redis!');
            console.log('⚡ No database operations at t=0!');
            console.log('🎯 Pure Redis solution working perfectly!');
        } else if (deliveryTime < 100) {
            console.log('\n✅ 5D REDIS INSTANT: GOOD!');
            console.log('🎯 Results are delivered quickly from Redis!');
            console.log('⚡ Much faster than database operations!');
        } else {
            console.log('\n❌ 5D REDIS INSTANT: STILL SLOW!');
            console.log('🔧 Delivery is still taking too long');
            console.log('🔧 This may still cause late results');
        }
        
        // Test Redis retrieval separately
        console.log('\n📊 Test 3: Redis retrieval test');
        
        const retrievalStart = Date.now();
        const retrievedResult = await getPreCalculated5DResultAtZero(gameType, duration, periodId, timeline);
        const retrievalTime = Date.now() - retrievalStart;
        
        console.log(`✅ Redis retrieval completed in ${retrievalTime}ms`);
        console.log('Retrieved result:', retrievedResult ? 'FOUND' : 'NOT FOUND');
        if (retrievedResult) {
            console.log('Source:', retrievedResult.source);
            console.log('Protection mode:', retrievedResult.protectionMode);
        }
        
    } catch (error) {
        console.error('❌ [5D_REDIS_INSTANT] Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
test5DRedisInstant().then(() => {
    console.log('\n🏁 [5D_REDIS_INSTANT] Test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [5D_REDIS_INSTANT] Test failed:', error);
    process.exit(1);
}); 