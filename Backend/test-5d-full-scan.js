const unifiedRedis = require('./config/unifiedRedisManager');
const { 
    preCalculate5DResultAtFreeze, 
    getPreCalculated5DResultAtZero,
    processGameResultsWithPreCalc 
} = require('./services/gameLogicService');

async function test5DFullScan() {
    console.log('🧪 [5D_FULL_SCAN] Testing full 100,000 combination scan for 5D...');
    
    try {
        // Initialize Redis manager
        console.log('🔄 [5D_FULL_SCAN] Initializing Redis manager...');
        await unifiedRedis.initialize();
        console.log('✅ [5D_FULL_SCAN] Redis manager initialized');
        
        const gameType = 'fiveD';
        const duration = 60;
        const periodId = '20250730000001404'; // Use a future period ID
        const timeline = 'default';
        
        console.log('\n📊 Test: Full 100,000 combination scan at t=3s (bet freeze)');
        console.log('Period ID:', periodId);
        
        const preCalcStart = Date.now();
        const preCalcResult = await preCalculate5DResultAtFreeze(gameType, duration, periodId, timeline);
        const preCalcTime = Date.now() - preCalcStart;
        
        console.log(`✅ Full scan completed in ${preCalcTime}ms`);
        console.log('Pre-calculated result:', preCalcResult.result);
        console.log('Protection mode:', preCalcResult.protectionMode);
        
        // Test instant delivery
        console.log('\n📊 Test: Instant delivery at t=0s (period end)');
        
        const deliveryStart = Date.now();
        const deliveryResult = await processGameResultsWithPreCalc(gameType, duration, periodId, timeline);
        const deliveryTime = Date.now() - deliveryStart;
        
        console.log(`✅ Instant delivery completed in ${deliveryTime}ms`);
        console.log('Delivery result:', deliveryResult.success ? 'SUCCESS' : 'FAILED');
        console.log('Result source:', deliveryResult.source);
        console.log('Result:', deliveryResult.result);
        
        // Performance analysis
        console.log('\n📋 5D FULL SCAN PERFORMANCE:');
        console.log('├─ Full scan time (100k combinations):', preCalcTime + 'ms');
        console.log('├─ Instant delivery time:', deliveryTime + 'ms');
        console.log('├─ Total time:', (preCalcTime + deliveryTime) + 'ms');
        console.log('├─ Target scan time: < 2000ms');
        console.log('├─ Target delivery time: < 100ms');
        console.log('└─ Performance:', preCalcTime < 2000 && deliveryTime < 100 ? '✅ EXCELLENT' : '❌ NEEDS IMPROVEMENT');
        
        if (preCalcTime < 2000 && deliveryTime < 100) {
            console.log('\n🎉 5D FULL SCAN: SUCCESS!');
            console.log('🚀 Full 100,000 combination scan completed quickly!');
            console.log('⚡ Results delivered instantly from Redis!');
            console.log('🎯 Complete protection coverage achieved!');
        } else if (preCalcTime < 3000 && deliveryTime < 200) {
            console.log('\n✅ 5D FULL SCAN: GOOD!');
            console.log('🎯 Full scan working but could be faster');
            console.log('⚡ Results delivered quickly!');
        } else {
            console.log('\n❌ 5D FULL SCAN: TOO SLOW!');
            console.log('🔧 Full scan is taking too long');
            console.log('🔧 This may still cause late results');
        }
        
        // Test Redis retrieval
        console.log('\n📊 Test: Redis retrieval verification');
        
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
        console.error('❌ [5D_FULL_SCAN] Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
test5DFullScan().then(() => {
    console.log('\n🏁 [5D_FULL_SCAN] Test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [5D_FULL_SCAN] Test failed:', error);
    process.exit(1);
}); 