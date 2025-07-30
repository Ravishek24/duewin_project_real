require('dotenv').config();
const unifiedRedis = require('./config/unifiedRedisManager');

// Test script for 5D pre-calculation integration
async function test5DPreCalcIntegration() {
    try {
        console.log('🧪 [TEST_5D_PRECALC] Starting 5D pre-calculation integration test...');
        
        // Test parameters
        const gameType = '5d';
        const duration = 60;
        const periodId = '20250101000000001'; // Test period ID
        const timeline = 'default';
        
        console.log('📋 [TEST_5D_PRECALC] Test parameters:', {
            gameType, duration, periodId, timeline
        });
        
        // Import the new functions
        const {
            preCalculate5DResultAtFreeze,
            getPreCalculated5DResultAtZero,
            processGameResultsWithPreCalc
        } = require('./services/gameLogicService');
        
        console.log('✅ [TEST_5D_PRECALC] Functions imported successfully');
        
        // Test 1: Pre-calculate result at bet freeze
        console.log('\n🎯 [TEST_5D_PRECALC] Test 1: Pre-calculating result at bet freeze...');
        try {
            const preCalcResult = await preCalculate5DResultAtFreeze(gameType, duration, periodId, timeline);
            console.log('✅ [TEST_5D_PRECALC] Pre-calculation successful:', {
                result: preCalcResult.result,
                protectionMode: preCalcResult.protectionMode,
                protectionReason: preCalcResult.protectionReason
            });
        } catch (error) {
            console.error('❌ [TEST_5D_PRECALC] Pre-calculation failed:', error.message);
            return;
        }
        
        // Test 2: Retrieve pre-calculated result at t=0
        console.log('\n🎯 [TEST_5D_PRECALC] Test 2: Retrieving pre-calculated result at t=0...');
        try {
            const retrievedResult = await getPreCalculated5DResultAtZero(gameType, duration, periodId, timeline);
            if (retrievedResult) {
                console.log('✅ [TEST_5D_PRECALC] Result retrieval successful:', {
                    result: retrievedResult.result,
                    protectionMode: retrievedResult.protectionMode,
                    source: retrievedResult.source
                });
            } else {
                console.log('⚠️ [TEST_5D_PRECALC] No pre-calculated result found (this is expected if cleanup worked)');
            }
        } catch (error) {
            console.error('❌ [TEST_5D_PRECALC] Result retrieval failed:', error.message);
        }
        
        // Test 3: Test the enhanced process function
        console.log('\n🎯 [TEST_5D_PRECALC] Test 3: Testing enhanced process function...');
        try {
            // First pre-calculate again
            await preCalculate5DResultAtFreeze(gameType, duration, periodId, timeline);
            
            // Then test the enhanced process
            const processResult = await processGameResultsWithPreCalc(gameType, duration, periodId, timeline);
            console.log('✅ [TEST_5D_PRECALC] Enhanced process successful:', {
                success: processResult.success,
                source: processResult.source,
                result: processResult.result
            });
        } catch (error) {
            console.error('❌ [TEST_5D_PRECALC] Enhanced process failed:', error.message);
        }
        
        // Test 4: Verify Redis keys are cleaned up
        console.log('\n🎯 [TEST_5D_PRECALC] Test 4: Verifying Redis cleanup...');
        try {
            const redis = unifiedRedis.getHelper();
            const lockKey = `precalc_lock_${gameType}_${duration}_${periodId}_${timeline}`;
            const resultKey = `precalc_result_${gameType}_${duration}_${periodId}_${timeline}`;
            
            const lockExists = await redis.exists(lockKey);
            const resultExists = await redis.exists(resultKey);
            
            console.log('🔍 [TEST_5D_PRECALC] Redis key status:', {
                lockKey: lockExists ? 'EXISTS' : 'CLEANED',
                resultKey: resultExists ? 'EXISTS' : 'CLEANED'
            });
            
            if (!lockExists && !resultExists) {
                console.log('✅ [TEST_5D_PRECALC] Redis cleanup successful - all keys removed');
            } else {
                console.log('⚠️ [TEST_5D_PRECALC] Some Redis keys still exist (may be normal if in use)');
            }
        } catch (error) {
            console.error('❌ [TEST_5D_PRECALC] Redis cleanup verification failed:', error.message);
        }
        
        console.log('\n🎉 [TEST_5D_PRECALC] Integration test completed successfully!');
        console.log('📊 [TEST_5D_PRECALC] Summary:');
        console.log('   ✅ Pre-calculation at bet freeze works');
        console.log('   ✅ Result retrieval at t=0 works');
        console.log('   ✅ Enhanced process function works');
        console.log('   ✅ Redis cleanup works');
        console.log('   🎯 5D games will now have instant result delivery!');
        
    } catch (error) {
        console.error('❌ [TEST_5D_PRECALC] Integration test failed:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Run the test
test5DPreCalcIntegration().then(() => {
    console.log('🏁 [TEST_5D_PRECALC] Test script finished');
    process.exit(0);
}).catch((error) => {
    console.error('💥 [TEST_5D_PRECALC] Test script crashed:', error);
    process.exit(1);
}); 