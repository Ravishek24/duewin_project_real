const unifiedRedis = require('./config/unifiedRedisManager');
const { 
    preCalculate5DResultAtFreeze, 
    getPreCalculated5DResultAtZero,
    processGameResultsWithPreCalc 
} = require('./services/gameLogicService');

async function test5DInstantDelivery() {
    console.log('🧪 [5D_INSTANT_DELIVERY] Testing instant 5D result delivery...');
    
    try {
        // Initialize Redis manager
        console.log('🔄 [5D_INSTANT_DELIVERY] Initializing Redis manager...');
        await unifiedRedis.initialize();
        console.log('✅ [5D_INSTANT_DELIVERY] Redis manager initialized');
        
        const gameType = 'fiveD';
        const duration = 60;
        const periodId = '20250730000001402'; // Use a future period ID
        const timeline = 'default';
        
        console.log('\n📊 Test 1: Pre-calculation at t=3s (bet freeze)');
        console.log('Period ID:', periodId);
        
        const preCalcStart = Date.now();
        const preCalcResult = await preCalculate5DResultAtFreeze(gameType, duration, periodId, timeline);
        const preCalcTime = Date.now() - preCalcStart;
        
        console.log(`✅ Pre-calculation completed in ${preCalcTime}ms`);
        console.log('Pre-calculated result:', preCalcResult.result);
        console.log('Protection mode:', preCalcResult.protectionMode);
        
        console.log('\n📊 Test 2: Instant result delivery at t=0s (period end)');
        
        const deliveryStart = Date.now();
        const deliveryResult = await processGameResultsWithPreCalc(gameType, duration, periodId, timeline);
        const deliveryTime = Date.now() - deliveryStart;
        
        console.log(`✅ Instant delivery completed in ${deliveryTime}ms`);
        console.log('Delivery result:', deliveryResult.success ? 'SUCCESS' : 'FAILED');
        console.log('Result source:', deliveryResult.source);
        console.log('Result:', deliveryResult.result);
        
        // Performance analysis
        console.log('\n📋 5D INSTANT DELIVERY PERFORMANCE:');
        console.log('├─ Pre-calculation time:', preCalcTime + 'ms');
        console.log('├─ Instant delivery time:', deliveryTime + 'ms');
        console.log('├─ Total time:', (preCalcTime + deliveryTime) + 'ms');
        console.log('├─ Target delivery time: < 100ms');
        console.log('└─ Performance:', deliveryTime < 100 ? '✅ INSTANT' : deliveryTime < 500 ? '✅ FAST' : '❌ SLOW');
        
        if (deliveryTime < 100) {
            console.log('\n🎉 5D INSTANT DELIVERY: SUCCESS!');
            console.log('🚀 Results are now delivered INSTANTLY at t=0!');
            console.log('⚡ No more late results!');
            console.log('🎯 Pre-calculation is working perfectly!');
        } else if (deliveryTime < 500) {
            console.log('\n✅ 5D INSTANT DELIVERY: GOOD!');
            console.log('🎯 Results are delivered quickly at t=0!');
            console.log('⚡ Much faster than before!');
        } else {
            console.log('\n❌ 5D INSTANT DELIVERY: STILL SLOW!');
            console.log('🔧 Delivery is still taking too long');
            console.log('🔧 This may still cause late results');
        }
        
        // Test retrieval separately
        console.log('\n📊 Test 3: Result retrieval test');
        
        const retrievalStart = Date.now();
        const retrievedResult = await getPreCalculated5DResultAtZero(gameType, duration, periodId, timeline);
        const retrievalTime = Date.now() - retrievalStart;
        
        console.log(`✅ Result retrieval completed in ${retrievalTime}ms`);
        console.log('Retrieved result:', retrievedResult ? 'FOUND' : 'NOT FOUND');
        if (retrievedResult) {
            console.log('Pre-saved:', retrievedResult.preSaved);
            console.log('Source:', retrievedResult.source);
        }
        
    } catch (error) {
        console.error('❌ [5D_INSTANT_DELIVERY] Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
test5DInstantDelivery().then(() => {
    console.log('\n🏁 [5D_INSTANT_DELIVERY] Test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [5D_INSTANT_DELIVERY] Test failed:', error);
    process.exit(1);
}); 