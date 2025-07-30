const unifiedRedis = require('./config/unifiedRedisManager');
const { 
    preCalculate5DResultAtFreeze, 
    getPreCalculated5DResultAtZero,
    processGameResultsWithPreCalc 
} = require('./services/gameLogicService');

async function test5DUltraFast() {
    console.log('🧪 [5D_ULTRA_FAST] Testing ultra-fast 5D pre-calculation...');
    
    try {
        // Initialize Redis manager
        console.log('🔄 [5D_ULTRA_FAST] Initializing Redis manager...');
        await unifiedRedis.initialize();
        console.log('✅ [5D_ULTRA_FAST] Redis manager initialized');
        
        const gameType = 'fiveD';
        const duration = 60;
        const periodId = '20250730000001401'; // Use a future period ID
        const timeline = 'default';
        
        console.log('\n📊 Test: Ultra-fast pre-calculation at t=3s (bet freeze)');
        console.log('Period ID:', periodId);
        
        const preCalcStart = Date.now();
        const preCalcResult = await preCalculate5DResultAtFreeze(gameType, duration, periodId, timeline);
        const preCalcTime = Date.now() - preCalcStart;
        
        console.log(`✅ Ultra-fast pre-calculation completed in ${preCalcTime}ms`);
        console.log('Pre-calculated result:', preCalcResult.result);
        console.log('Protection mode:', preCalcResult.protectionMode);
        console.log('Protection reason:', preCalcResult.protectionReason);
        
        // Performance analysis
        console.log('\n📋 5D ULTRA-FAST PERFORMANCE:');
        console.log('├─ Pre-calculation time:', preCalcTime + 'ms');
        console.log('├─ Target time: < 500ms');
        console.log('├─ Performance:', preCalcTime < 500 ? '✅ EXCELLENT' : preCalcTime < 1000 ? '✅ GOOD' : '❌ SLOW');
        console.log('└─ Result quality:', preCalcResult.result ? '✅ VALID' : '❌ INVALID');
        
        if (preCalcTime < 500) {
            console.log('\n🎉 5D ULTRA-FAST: SUCCESS!');
            console.log('🚀 Pre-calculation is now ultra-fast!');
            console.log('⚡ Results will be delivered instantly at t=0!');
            console.log('🎯 No more late results!');
        } else if (preCalcTime < 1000) {
            console.log('\n✅ 5D ULTRA-FAST: GOOD!');
            console.log('🎯 Pre-calculation is working well!');
            console.log('⚡ Results should be delivered quickly at t=0!');
        } else {
            console.log('\n❌ 5D ULTRA-FAST: STILL SLOW!');
            console.log('🔧 Pre-calculation is still taking too long');
            console.log('🔧 This may still cause late results');
        }
        
    } catch (error) {
        console.error('❌ [5D_ULTRA_FAST] Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
test5DUltraFast().then(() => {
    console.log('\n🏁 [5D_ULTRA_FAST] Test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [5D_ULTRA_FAST] Test failed:', error);
    process.exit(1);
}); 