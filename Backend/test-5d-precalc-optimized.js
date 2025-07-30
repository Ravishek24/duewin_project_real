const unifiedRedis = require('./config/unifiedRedisManager');
const { 
    preCalculate5DResultAtFreeze, 
    getPreCalculated5DResultAtZero,
    processGameResultsWithPreCalc 
} = require('./services/gameLogicService');

async function test5DOptimizedPrecalc() {
    console.log('🧪 [5D_OPTIMIZED_PRECALC] Testing optimized 5D pre-calculation...');
    
    try {
        // Initialize Redis manager
        console.log('🔄 [5D_OPTIMIZED_PRECALC] Initializing Redis manager...');
        await unifiedRedis.initialize();
        console.log('✅ [5D_OPTIMIZED_PRECALC] Redis manager initialized');
        
        const gameType = 'fiveD';
        const duration = 60;
        const periodId = '20250730000001400'; // Use a future period ID
        const timeline = 'default';
        
        console.log('\n📊 Test: Optimized pre-calculation at t=3s (bet freeze)');
        console.log('Period ID:', periodId);
        
        const preCalcStart = Date.now();
        const preCalcResult = await preCalculate5DResultAtFreeze(gameType, duration, periodId, timeline);
        const preCalcTime = Date.now() - preCalcStart;
        
        console.log(`✅ Optimized pre-calculation completed in ${preCalcTime}ms`);
        console.log('Pre-calculated result:', preCalcResult.result);
        console.log('Protection mode:', preCalcResult.protectionMode);
        console.log('Protection reason:', preCalcResult.protectionReason);
        
        // Test retrieval
        console.log('\n📊 Test: Result retrieval at t=0s (period end)');
        
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
        
        // Test full processing
        console.log('\n📊 Test: Full result processing at t=0s');
        
        const processingStart = Date.now();
        const processingResult = await processGameResultsWithPreCalc(gameType, duration, periodId, timeline);
        const processingTime = Date.now() - processingStart;
        
        console.log(`✅ Full processing completed in ${processingTime}ms`);
        console.log('Processing result:', processingResult.success ? 'SUCCESS' : 'FAILED');
        console.log('Result source:', processingResult.source);
        
        // Performance analysis
        console.log('\n📋 5D OPTIMIZED PRECALC PERFORMANCE:');
        console.log('├─ Pre-calculation time:', preCalcTime + 'ms');
        console.log('├─ Result retrieval time:', retrievalTime + 'ms');
        console.log('├─ Full processing time:', processingTime + 'ms');
        console.log('├─ Total time saved:', (preCalcTime + retrievalTime) + 'ms');
        console.log('└─ Result source:', processingResult.source);
        
        // Performance targets
        if (preCalcTime < 500 && retrievalTime < 50 && processingTime < 1000) {
            console.log('\n✅ 5D OPTIMIZED PRECALC: EXCELLENT!');
            console.log('🎯 Pre-calculation is now ultra-fast!');
            console.log('⚡ Results should be delivered instantly at t=0!');
            console.log('🚀 No more late results!');
        } else if (preCalcTime < 1000 && retrievalTime < 100 && processingTime < 2000) {
            console.log('\n✅ 5D OPTIMIZED PRECALC: GOOD!');
            console.log('🎯 Pre-calculation is working well!');
            console.log('⚡ Results should be delivered quickly at t=0!');
        } else {
            console.log('\n❌ 5D OPTIMIZED PRECALC: STILL SLOW!');
            console.log('🔧 Pre-calculation is still taking too long');
            console.log('🔧 This may still cause late results');
        }
        
    } catch (error) {
        console.error('❌ [5D_OPTIMIZED_PRECALC] Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
test5DOptimizedPrecalc().then(() => {
    console.log('\n🏁 [5D_OPTIMIZED_PRECALC] Test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [5D_OPTIMIZED_PRECALC] Test failed:', error);
    process.exit(1);
}); 