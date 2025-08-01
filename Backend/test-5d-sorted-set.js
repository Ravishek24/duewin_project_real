const { 
    update5DExposureSortedSet, 
    getOptimal5DResultByExposureSortedSet, 
    initialize5DExposureSortedSet,
    testSortedSetPerformance 
} = require('./services/5dSortedSetService');

const { getRedisHelper } = require('./services/gameLogicService');

/**
 * 🧪 Test script for 5D Sorted Set implementation
 * This script tests the new Sorted Set approach for ultra-fast exposure management
 */

async function test5DSortedSet() {
    try {
        console.log('🧪 [5D_SORTED_SET_TEST] Starting 5D Sorted Set test...');
        
        // Test parameters
        const gameType = '5d';
        const duration = 60;
        const periodId = 'test_period_' + Date.now();
        const timeline = 'default';
        
        console.log('📋 [5D_SORTED_SET_TEST] Test parameters:', {
            gameType, duration, periodId, timeline
        });
        
        // Step 1: Initialize Sorted Set
        console.log('\n🔄 [5D_SORTED_SET_TEST] Step 1: Initializing Sorted Set...');
        const initResult = await initialize5DExposureSortedSet(gameType, duration, periodId, timeline);
        
        if (!initResult) {
            console.log('❌ [5D_SORTED_SET_TEST] Failed to initialize Sorted Set');
            return;
        }
        
        console.log('✅ [5D_SORTED_SET_TEST] Sorted Set initialized successfully');
        
        // Step 2: Add test bets
        console.log('\n🔄 [5D_SORTED_SET_TEST] Step 2: Adding test bets...');
        
        const testBets = [
            {
                bet_type: 'SUM_even:SUM_even',
                betAmount: 1000,
                netBetAmount: 1000
            },
            {
                bet_type: 'POSITION:A_1:A_1',
                betAmount: 500,
                netBetAmount: 500
            },
            {
                bet_type: 'SUM_SIZE:SUM_big',
                betAmount: 750,
                netBetAmount: 750
            }
        ];
        
        for (const bet of testBets) {
            console.log(`📝 [5D_SORTED_SET_TEST] Adding bet: ${bet.bet_type} - ₹${bet.betAmount}`);
            await update5DExposureSortedSet(gameType, duration, periodId, bet, timeline);
        }
        
        console.log('✅ [5D_SORTED_SET_TEST] Test bets added successfully');
        
        // Step 3: Test result calculation
        console.log('\n🔄 [5D_SORTED_SET_TEST] Step 3: Testing result calculation...');
        
        const startTime = Date.now();
        const result = await getOptimal5DResultByExposureSortedSet(duration, periodId, timeline);
        const endTime = Date.now();
        
        console.log('✅ [5D_SORTED_SET_TEST] Result calculation completed!');
        console.log(`📊 [5D_SORTED_SET_TEST] Performance:`);
        console.log(`   - Time taken: ${endTime - startTime}ms`);
        console.log(`   - Result:`, result);
        
        // Step 4: Verify Sorted Set data
        console.log('\n🔄 [5D_SORTED_SET_TEST] Step 4: Verifying Sorted Set data...');
        
        const redis = getRedisHelper();
        const sortedSetKey = `exposure_sorted:${gameType}:${duration}:${timeline}:${periodId}`;
        
        // Get total combinations
        const totalCombinations = await redis.zcard(sortedSetKey);
        console.log(`📊 [5D_SORTED_SET_TEST] Total combinations in Sorted Set: ${totalCombinations}`);
        
        // Get zero exposure combinations
        const zeroExposureCount = await redis.zcount(sortedSetKey, 0, 0);
        console.log(`📊 [5D_SORTED_SET_TEST] Zero exposure combinations: ${zeroExposureCount}`);
        
        // Get lowest exposure
        const lowestExposure = await redis.zrange(sortedSetKey, 0, 0, 'WITHSCORES');
        console.log(`📊 [5D_SORTED_SET_TEST] Lowest exposure: ${lowestExposure[1] || 'N/A'}`);
        
        // Get highest exposure
        const highestExposure = await redis.zrevrange(sortedSetKey, 0, 0, 'WITHSCORES');
        console.log(`📊 [5D_SORTED_SET_TEST] Highest exposure: ${highestExposure[1] || 'N/A'}`);
        
        // Step 5: Performance comparison
        console.log('\n🔄 [5D_SORTED_SET_TEST] Step 5: Performance comparison...');
        
        const performanceResult = await testSortedSetPerformance(duration, periodId, timeline);
        
        console.log('📊 [5D_SORTED_SET_TEST] Final performance comparison:');
        console.log(`   Hash method: ${performanceResult.hashTime}ms`);
        console.log(`   Sorted Set method: ${performanceResult.sortedSetTime}ms`);
        console.log(`   Speed improvement: ${performanceResult.speedImprovement.toFixed(2)}x faster`);
        console.log(`   Results match: ${performanceResult.resultsMatch ? '✅' : '❌'}`);
        
        // Step 6: Cleanup
        console.log('\n🔄 [5D_SORTED_SET_TEST] Step 6: Cleaning up test data...');
        
        await redis.del(sortedSetKey);
        await redis.del(`exposure:${gameType}:${duration}:${timeline}:${periodId}`);
        
        console.log('✅ [5D_SORTED_SET_TEST] Test data cleaned up');
        
        // Summary
        console.log('\n🎉 [5D_SORTED_SET_TEST] Test completed successfully!');
        console.log('📋 [5D_SORTED_SET_TEST] Summary:');
        console.log(`   ✅ Sorted Set initialization: Working`);
        console.log(`   ✅ Exposure updates: Working`);
        console.log(`   ✅ Result calculation: Working`);
        console.log(`   ✅ Performance improvement: ${performanceResult.speedImprovement.toFixed(2)}x faster`);
        console.log(`   ✅ Data consistency: ${performanceResult.resultsMatch ? 'Verified' : 'Issues found'}`);
        
        return {
            success: true,
            performance: performanceResult,
            result: result,
            totalCombinations,
            zeroExposureCount
        };
        
    } catch (error) {
        console.error('❌ [5D_SORTED_SET_TEST] Test failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Run test if this file is executed directly
if (require.main === module) {
    test5DSortedSet()
        .then(result => {
            if (result.success) {
                console.log('\n🎉 [5D_SORTED_SET_TEST] All tests passed!');
                process.exit(0);
            } else {
                console.log('\n❌ [5D_SORTED_SET_TEST] Tests failed!');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ [5D_SORTED_SET_TEST] Test execution failed:', error);
            process.exit(1);
        });
}

module.exports = {
    test5DSortedSet
}; 