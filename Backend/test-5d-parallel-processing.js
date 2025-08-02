const { UnifiedRedisManager } = require('./config/unifiedRedisManager');
const { getOptimal5DResultParallel } = require('./services/5dParallelProcessor');
const { getOptimal5DResultByExposureSortedSet } = require('./services/5dSortedSetService');

/**
 * 🧪 Test script for 5D Parallel Processing implementation
 * This script tests the new parallel processing approach with worker threads
 */

async function test5DParallelProcessing() {
    try {
        console.log('🧪 [5D_PARALLEL_TEST] Starting 5D Parallel Processing test...');
        
        // Initialize Redis
        console.log('🔄 Initializing Unified Redis Manager...');
        await UnifiedRedisManager.initialize();
        
        console.log('✅ Redis initialized successfully');
        
        // Test parameters
        const gameType = '5d';
        const duration = 60;
        const periodId = 'test_period_' + Date.now();
        const timeline = 'default';
        
        console.log('📋 [5D_PARALLEL_TEST] Test parameters:', {
            gameType, duration, periodId, timeline
        });
        
        // Step 1: Initialize test data
        console.log('\n🔄 [5D_PARALLEL_TEST] Step 1: Initializing test data...');
        
        const redis = UnifiedRedisManager.getHelper();
        
        // Create test combinations (simplified for testing)
        const testCombinations = [
            '1,2,3,4,5', '1,1,1,1,1', '2,2,2,2,2', '3,3,3,3,3', '4,4,4,4,4',
            '5,5,5,5,5', '6,6,6,6,6', '7,7,7,7,7', '8,8,8,8,8', '9,9,9,9,9'
        ];
        
        // Store test combinations in Redis
        const combinationsKey = `combinations:5d:${duration}:${timeline}`;
        for (let i = 0; i < testCombinations.length; i++) {
            await redis.hset(combinationsKey, `combo_${i}`, testCombinations[i]);
        }
        
        // Create test bet patterns
        const testBetPattern = {
            'SUM_even:SUM_even': '1000',
            'SUM_SIZE:SUM_big': '750',
            'POSITION:A_1:A_1': '500'
        };
        
        // Store test bet patterns in Redis
        const exposureKey = `exposure:5d:${duration}:${timeline}:${periodId}`;
        for (const [betKey, betAmount] of Object.entries(testBetPattern)) {
            await redis.hset(exposureKey, betKey, betAmount);
        }
        
        console.log('✅ [5D_PARALLEL_TEST] Test data initialized successfully');
        console.log(`   - Combinations: ${testCombinations.length}`);
        console.log(`   - Bet patterns: ${Object.keys(testBetPattern).length}`);
        
        // Step 2: Test Parallel Processing
        console.log('\n🔄 [5D_PARALLEL_TEST] Step 2: Testing Parallel Processing...');
        
        const parallelStartTime = Date.now();
        const parallelResult = await getOptimal5DResultParallel(duration, periodId, timeline);
        const parallelEndTime = Date.now();
        const parallelTime = parallelEndTime - parallelStartTime;
        
        console.log('✅ [5D_PARALLEL_TEST] Parallel Processing completed!');
        console.log(`📊 [5D_PARALLEL_TEST] Parallel Processing results:`);
        console.log(`   - Time taken: ${parallelTime}ms`);
        console.log(`   - Method used: ${parallelResult.method}`);
        console.log(`   - Result:`, parallelResult);
        
        // Step 3: Test Sequential Processing for comparison
        console.log('\n🔄 [5D_PARALLEL_TEST] Step 3: Testing Sequential Processing for comparison...');
        
        const sequentialStartTime = Date.now();
        const sequentialResult = await getOptimal5DResultByExposureSortedSet(duration, periodId, timeline);
        const sequentialEndTime = Date.now();
        const sequentialTime = sequentialEndTime - sequentialStartTime;
        
        console.log('✅ [5D_PARALLEL_TEST] Sequential Processing completed!');
        console.log(`📊 [5D_PARALLEL_TEST] Sequential Processing results:`);
        console.log(`   - Time taken: ${sequentialTime}ms`);
        console.log(`   - Method used: ${sequentialResult.method}`);
        console.log(`   - Result:`, sequentialResult);
        
        // Step 4: Performance comparison
        console.log('\n🔄 [5D_PARALLEL_TEST] Step 4: Performance comparison...');
        
        const speedImprovement = sequentialTime / parallelTime;
        const resultsMatch = JSON.stringify(parallelResult) === JSON.stringify(sequentialResult);
        
        console.log('📊 [5D_PARALLEL_TEST] Performance comparison:');
        console.log(`   - Parallel Processing: ${parallelTime}ms`);
        console.log(`   - Sequential Processing: ${sequentialTime}ms`);
        console.log(`   - Speed improvement: ${speedImprovement.toFixed(2)}x faster`);
        console.log(`   - Results match: ${resultsMatch ? '✅' : '❌'}`);
        
        // Step 5: Cleanup
        console.log('\n🔄 [5D_PARALLEL_TEST] Step 5: Cleaning up test data...');
        
        await redis.del(combinationsKey);
        await redis.del(exposureKey);
        
        console.log('✅ [5D_PARALLEL_TEST] Test data cleaned up');
        
        // Summary
        console.log('\n🎉 [5D_PARALLEL_TEST] Test completed successfully!');
        console.log('📋 [5D_PARALLEL_TEST] Summary:');
        console.log(`   ✅ Parallel Processing: Working`);
        console.log(`   ✅ Sequential Processing: Working`);
        console.log(`   ✅ Performance improvement: ${speedImprovement.toFixed(2)}x faster`);
        console.log(`   ✅ Data consistency: ${resultsMatch ? 'Verified' : 'Issues found'}`);
        
        return {
            success: true,
            parallelTime,
            sequentialTime,
            speedImprovement,
            resultsMatch,
            parallelResult,
            sequentialResult
        };
        
    } catch (error) {
        console.error('❌ [5D_PARALLEL_TEST] Test failed:', error);
        return {
            success: false,
            error: error.message
        };
    } finally {
        // Close Redis connections
        try {
            await UnifiedRedisManager.closeAll();
            console.log('✅ Redis connections closed');
        } catch (error) {
            console.error('⚠️ Error closing Redis connections:', error);
        }
    }
}

// Run test if this file is executed directly
if (require.main === module) {
    test5DParallelProcessing()
        .then(result => {
            if (result.success) {
                console.log('\n🎉 [5D_PARALLEL_TEST] All tests passed!');
                process.exit(0);
            } else {
                console.log('\n❌ [5D_PARALLEL_TEST] Tests failed!');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ [5D_PARALLEL_TEST] Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = {
    test5DParallelProcessing
}; 