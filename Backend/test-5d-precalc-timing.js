const unifiedRedis = require('./config/unifiedRedisManager');
const { 
    preCalculate5DResultAtFreeze, 
    getPreCalculated5DResultAtZero,
    processGameResultsWithPreCalc 
} = require('./services/gameLogicService');

async function test5DPrecalcTiming() {
    console.log('🧪 [5D_PRECALC_TEST] Testing 5D pre-calculation timing...');
    
    try {
        // Initialize Redis manager
        console.log('🔄 [5D_PRECALC_TEST] Initializing Redis manager...');
        await unifiedRedis.initialize();
        console.log('✅ [5D_PRECALC_TEST] Redis manager initialized');
        
        const gameType = 'fiveD';
        const duration = 60;
        const periodId = '20250730000001399'; // Use a future period ID
        const timeline = 'default';
        
        console.log('\n📊 Test 1: Simulate pre-calculation at t=3s (bet freeze)');
        console.log('Period ID:', periodId);
        
        const preCalcStart = Date.now();
        const preCalcResult = await preCalculate5DResultAtFreeze(gameType, duration, periodId, timeline);
        const preCalcTime = Date.now() - preCalcStart;
        
        console.log(`✅ Pre-calculation completed in ${preCalcTime}ms`);
        console.log('Pre-calculated result:', preCalcResult.result);
        console.log('Protection mode:', preCalcResult.protectionMode);
        console.log('Protection reason:', preCalcResult.protectionReason);
        
        console.log('\n📊 Test 2: Simulate result retrieval at t=0s (period end)');
        
        const retrievalStart = Date.now();
        const retrievedResult = await getPreCalculated5DResultAtZero(gameType, duration, periodId, timeline);
        const retrievalTime = Date.now() - retrievalStart;
        
        console.log(`✅ Result retrieval completed in ${retrievalTime}ms`);
        
        if (retrievedResult) {
            console.log('Retrieved result:', retrievedResult.result);
            console.log('Protection mode:', retrievedResult.protectionMode);
            console.log('Protection reason:', retrievedResult.protectionReason);
        } else {
            console.log('❌ No pre-calculated result found');
        }
        
        console.log('\n📊 Test 3: Simulate full result processing at t=0s');
        
        const processingStart = Date.now();
        const processingResult = await processGameResultsWithPreCalc(gameType, duration, periodId, timeline);
        const processingTime = Date.now() - processingStart;
        
        console.log(`✅ Full processing completed in ${processingTime}ms`);
        console.log('Processing result:', processingResult.success ? 'SUCCESS' : 'FAILED');
        console.log('Result source:', processingResult.source);
        
        // Summary
        console.log('\n📋 5D PRECALC TIMING SUMMARY:');
        console.log('├─ Pre-calculation time:', preCalcTime + 'ms');
        console.log('├─ Result retrieval time:', retrievalTime + 'ms');
        console.log('├─ Full processing time:', processingTime + 'ms');
        console.log('├─ Total time saved:', (preCalcTime + retrievalTime) + 'ms');
        console.log('└─ Result source:', processingResult.source);
        
        if (preCalcTime < 2000 && retrievalTime < 100 && processingTime < 3000) {
            console.log('\n✅ 5D PRECALC TIMING: SUCCESS!');
            console.log('🎯 Pre-calculation is working correctly!');
            console.log('⚡ Results should now be delivered instantly at t=0!');
        } else {
            console.log('\n❌ 5D PRECALC TIMING: SLOW!');
            console.log('🔧 Pre-calculation is taking too long');
            console.log('🔧 This may still cause late results');
        }
        
    } catch (error) {
        console.error('❌ [5D_PRECALC_TEST] Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
test5DPrecalcTiming().then(() => {
    console.log('\n🏁 [5D_PRECALC_TEST] Test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [5D_PRECALC_TEST] Test failed:', error);
    process.exit(1);
}); 