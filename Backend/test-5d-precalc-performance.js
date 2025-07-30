const unifiedRedis = require('./config/unifiedRedisManager');
const {
    preCalculate5DResultAtFreeze,
    getPreCalculated5DResultAtZero,
    processGameResultsWithPreCalc,
    processGameResults
} = require('./services/gameLogicService');

async function test5DPrecalcPerformance() {
    console.log('🚀 [5D_PRECALC_PERFORMANCE] Starting comprehensive performance test...');
    
    const gameType = '5d';
    const duration = 60;
    const periodId = `20250101000000001`;
    const timeline = 'default';
    
    try {
        // Test 1: Check if Redis is working
        console.log('\n📊 Test 1: Redis Connection Check');
        const redis = unifiedRedis.getHelper();
        await redis.ping();
        console.log('✅ Redis connection working');
        
        // Test 2: Measure pre-calculation time at freeze (t = -5s)
        console.log('\n📊 Test 2: Pre-calculation Performance at Freeze');
        const preCalcStart = Date.now();
        
        const preCalcResult = await preCalculate5DResultAtFreeze(gameType, duration, periodId, timeline);
        const preCalcTime = Date.now() - preCalcStart;
        
        console.log(`⏱️ Pre-calculation time: ${preCalcTime}ms`);
        console.log(`📈 Result:`, preCalcResult.result);
        console.log(`🛡️ Protection mode: ${preCalcResult.protectionMode}`);
        
        if (preCalcTime > 5000) {
            console.log('⚠️ WARNING: Pre-calculation is taking too long (>5s)');
        } else {
            console.log('✅ Pre-calculation performance is acceptable');
        }
        
        // Test 3: Measure retrieval time at t = 0
        console.log('\n📊 Test 3: Retrieval Performance at t=0');
        const retrievalStart = Date.now();
        
        const retrievedResult = await getPreCalculated5DResultAtZero(gameType, duration, periodId, timeline);
        const retrievalTime = Date.now() - retrievalStart;
        
        console.log(`⏱️ Retrieval time: ${retrievalTime}ms`);
        
        if (retrievedResult) {
            console.log(`✅ Retrieved result:`, retrievedResult.result);
            console.log(`🛡️ Protection mode: ${retrievedResult.protectionMode}`);
        } else {
            console.log('❌ No pre-calculated result found');
        }
        
        if (retrievalTime > 100) {
            console.log('⚠️ WARNING: Retrieval is taking too long (>100ms)');
        } else {
            console.log('✅ Retrieval performance is excellent');
        }
        
        // Test 4: Measure full processGameResultsWithPreCalc time
        console.log('\n📊 Test 4: Full Processing Performance');
        const fullProcessStart = Date.now();
        
        // Re-calculate first since we consumed the result
        await preCalculate5DResultAtFreeze(gameType, duration, periodId, timeline);
        
        const fullProcessResult = await processGameResultsWithPreCalc(gameType, duration, periodId, timeline);
        const fullProcessTime = Date.now() - fullProcessStart;
        
        console.log(`⏱️ Full processing time: ${fullProcessTime}ms`);
        console.log(`📈 Result:`, fullProcessResult.result);
        console.log(`🛡️ Source: ${fullProcessResult.source}`);
        
        if (fullProcessTime > 1000) {
            console.log('⚠️ WARNING: Full processing is taking too long (>1s)');
        } else {
            console.log('✅ Full processing performance is good');
        }
        
        // Test 5: Compare with regular processGameResults
        console.log('\n📊 Test 5: Comparison with Regular Processing');
        const regularStart = Date.now();
        
        const regularResult = await processGameResults(gameType, duration, periodId, timeline);
        const regularTime = Date.now() - regularStart;
        
        console.log(`⏱️ Regular processing time: ${regularTime}ms`);
        console.log(`📈 Result:`, regularResult.result);
        
        const timeDifference = regularTime - fullProcessTime;
        console.log(`⚡ Performance improvement: ${timeDifference}ms faster with pre-calculation`);
        
        if (timeDifference > 0) {
            console.log(`✅ Pre-calculation is ${Math.round((timeDifference / regularTime) * 100)}% faster`);
        } else {
            console.log('⚠️ Pre-calculation is not showing performance improvement');
        }
        
        // Test 6: Check Redis keys
        console.log('\n📊 Test 6: Redis Key Analysis');
        const resultKey = `precalc_result_${gameType}_${duration}_${periodId}_${timeline}`;
        const lockKey = `precalc_lock_${gameType}_${duration}_${periodId}_${timeline}`;
        
        const resultExists = await redis.exists(resultKey);
        const lockExists = await redis.exists(lockKey);
        
        console.log(`🔑 Result key exists: ${resultExists ? 'Yes' : 'No'}`);
        console.log(`🔒 Lock key exists: ${lockExists ? 'Yes' : 'No'}`);
        
        if (lockExists) {
            console.log('⚠️ WARNING: Lock key still exists - potential cleanup issue');
        }
        
        // Test 7: Check timing accuracy
        console.log('\n📊 Test 7: Timing Accuracy Check');
        const now = new Date();
        const periodEndTime = new Date(periodId.replace(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{3})/, '$1-$2-$3T$4:$5:$6.$7Z'));
        const timeRemaining = Math.max(0, Math.floor((periodEndTime - now) / 1000));
        
        console.log(`⏰ Current time: ${now.toISOString()}`);
        console.log(`🏁 Period end time: ${periodEndTime.toISOString()}`);
        console.log(`⏱️ Time remaining: ${timeRemaining}s`);
        
        // Summary
        console.log('\n📋 PERFORMANCE SUMMARY:');
        console.log(`├─ Pre-calculation: ${preCalcTime}ms`);
        console.log(`├─ Retrieval: ${retrievalTime}ms`);
        console.log(`├─ Full processing: ${fullProcessTime}ms`);
        console.log(`├─ Regular processing: ${regularTime}ms`);
        console.log(`└─ Performance gain: ${timeDifference}ms`);
        
        if (preCalcTime < 5000 && retrievalTime < 100 && fullProcessTime < 1000) {
            console.log('\n✅ OVERALL ASSESSMENT: Pre-calculation system is performing well');
        } else {
            console.log('\n⚠️ OVERALL ASSESSMENT: Performance issues detected');
        }
        
    } catch (error) {
        console.error('❌ [5D_PRECALC_PERFORMANCE] Test failed:', error.message);
        console.error(error.stack);
    }
}

// Run the test
test5DPrecalcPerformance().then(() => {
    console.log('\n🏁 [5D_PRECALC_PERFORMANCE] Test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [5D_PRECALC_PERFORMANCE] Test failed:', error);
    process.exit(1);
}); 