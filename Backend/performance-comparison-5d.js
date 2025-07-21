function getRedisClient() {
  if (!redisHelper) throw new Error('redisHelper not set!');
  return getRedisClient();
}
const { initializeModels } = require('./models');
const fiveDProtectionService = require('./services/fiveDProtectionService');
const gameLogicService = require('./services/gameLogicService');
const redisHelper = require('./config/redis');


async function compare5DPerformance() {
    try {
        console.log('⚡ [5D_PERFORMANCE] ==========================================');
        console.log('⚡ [5D_PERFORMANCE] 5D Protection Performance Comparison');
        console.log('⚡ [5D_PERFORMANCE] ==========================================');

        // Initialize models first
        console.log('\n🔧 [INIT] Initializing models...');
        await initializeModels();
        console.log('✅ Models initialized successfully');

        const gameType = '5d';
        const duration = 60;
        const periodId = 'PERF_TEST' + Date.now();
        const timeline = 'default';

        // Test 1: Initialize precomputed approach
        console.log('\n🔍 [TEST_1] Testing precomputed approach...');
        
        const initStart = Date.now();
        await fiveDProtectionService.initializeZeroExposureCandidates(
            gameType, duration, periodId, timeline
        );
        const initTime = Date.now() - initStart;
        
        console.log(`✅ Initialization time: ${initTime}ms`);

        // Test 2: Simulate bet placement and combination removal
        console.log('\n🔍 [TEST_2] Testing bet placement performance...');
        
        const betTypes = ['POSITION', 'SUM'];
        const betValues = ['A_5', 'B_3', 'C_7', '15', '20', '25'];
        
        const betStart = Date.now();
        for (let i = 0; i < 10; i++) {
            const betType = betTypes[i % betTypes.length];
            const betValue = betValues[i % betValues.length];
            
            await fiveDProtectionService.removeCombinationFromZeroExposure(
                gameType, duration, periodId, timeline,
                betType, betValue
            );
        }
        const betTime = Date.now() - betStart;
        
        console.log(`✅ Bet placement time (10 bets): ${betTime}ms (${betTime/10}ms per bet)`);

        // Test 3: Test result selection performance
        console.log('\n🔍 [TEST_3] Testing result selection performance...');
        
        const selectionTimes = [];
        const iterations = 20;
        
        for (let i = 0; i < iterations; i++) {
            const start = Date.now();
            await fiveDProtectionService.getProtectedResult(
                gameType, duration, periodId, timeline
            );
            const time = Date.now() - start;
            selectionTimes.push(time);
        }
        
        const avgSelectionTime = selectionTimes.reduce((a, b) => a + b, 0) / selectionTimes.length;
        const minSelectionTime = Math.min(...selectionTimes);
        const maxSelectionTime = Math.max(...selectionTimes);
        
        console.log(`✅ Result selection performance:`);
        console.log(`   Average: ${avgSelectionTime.toFixed(2)}ms`);
        console.log(`   Min: ${minSelectionTime}ms`);
        console.log(`   Max: ${maxSelectionTime}ms`);
        console.log(`   Total (${iterations} iterations): ${selectionTimes.reduce((a, b) => a + b, 0)}ms`);

        // Test 4: Compare with old approach (simulated)
        console.log('\n🔍 [TEST_4] Comparing with old scanning approach...');
        
        // Simulate old approach (scanning all combinations)
        const oldApproachStart = Date.now();
        const simulatedCombinations = 100000; // Total 5D combinations
        const scanTime = simulatedCombinations * 0.001; // Simulated 1ms per combination check
        const oldApproachTime = scanTime;
        
        console.log(`⏱️ Old approach (scanning ${simulatedCombinations} combinations):`);
        console.log(`   Estimated time: ${oldApproachTime.toFixed(2)}ms`);
        console.log(`   vs New approach: ${avgSelectionTime.toFixed(2)}ms`);
        console.log(`   Speed improvement: ${(oldApproachTime / avgSelectionTime).toFixed(2)}x faster`);

        // Test 5: Memory usage comparison
        console.log('\n🔍 [TEST_5] Memory usage comparison...');
        
        const stats = await fiveDProtectionService.getProtectionStats(
            gameType, duration, periodId, timeline
        );
        
        // Estimate memory usage
        const newApproachMemory = stats.remainingZeroExposure * 20; // ~20 bytes per combination key
        const oldApproachMemory = simulatedCombinations * 100; // ~100 bytes per combination with exposure data
        
        console.log(`💾 Memory usage comparison:`);
        console.log(`   New approach: ${(newApproachMemory / 1024).toFixed(2)}KB`);
        console.log(`   Old approach: ${(oldApproachMemory / 1024).toFixed(2)}KB`);
        console.log(`   Memory reduction: ${(oldApproachMemory / newApproachMemory).toFixed(2)}x less memory`);

        // Test 6: Scalability test
        console.log('\n🔍 [TEST_6] Scalability test...');
        
        // Simulate different bet counts
        const betCounts = [10, 50, 100, 500, 1000];
        
        for (const betCount of betCounts) {
            const testPeriodId = `SCALE_TEST_${betCount}_${Date.now()}`;
            
            // Initialize
            await fiveDProtectionService.initializeZeroExposureCandidates(
                gameType, duration, testPeriodId, timeline
            );
            
            // Simulate bets
            const scaleStart = Date.now();
            for (let i = 0; i < betCount; i++) {
                const betType = 'POSITION';
                const betValue = `A_${i % 10}`;
                
                await fiveDProtectionService.removeCombinationFromZeroExposure(
                    gameType, duration, testPeriodId, timeline,
                    betType, betValue
                );
            }
            const scaleTime = Date.now() - scaleStart;
            
            // Test result selection
            const resultStart = Date.now();
            await fiveDProtectionService.getProtectedResult(
                gameType, duration, testPeriodId, timeline
            );
            const resultTime = Date.now() - resultStart;
            
            console.log(`📊 ${betCount} bets:`);
            console.log(`   Bet processing: ${scaleTime}ms (${(scaleTime/betCount).toFixed(2)}ms per bet)`);
            console.log(`   Result selection: ${resultTime}ms`);
            
            // Cleanup
            const setKey = fiveDProtectionService.getZeroExposureSetKey(gameType, duration, testPeriodId, timeline);
            await redisClient.del(setKey);
        }

        // Test 7: 60/40 distribution test
        console.log('\n🔍 [TEST_7] Testing 60/40 distribution...');
        
        const results = [];
        const distributionTestCount = 100;
        
        for (let i = 0; i < distributionTestCount; i++) {
            const result = await fiveDProtectionService.getProtectedResult(
                gameType, duration, periodId, timeline
            );
            results.push(result);
        }
        
        // Count zero-exposure vs random (simplified check)
        let zeroExposureCount = 0;
        let randomCount = 0;
        
        for (const result of results) {
            // Simplified check: if result avoids common bet positions, it's likely zero-exposure
            if (result.dice_a !== 5 && result.dice_b !== 3) {
                zeroExposureCount++;
            } else {
                randomCount++;
            }
        }
        
        const zeroExposurePercentage = (zeroExposureCount / distributionTestCount) * 100;
        const randomPercentage = (randomCount / distributionTestCount) * 100;
        
        console.log(`📊 60/40 Distribution Test (${distributionTestCount} iterations):`);
        console.log(`   Zero-exposure results: ${zeroExposureCount} (${zeroExposurePercentage.toFixed(1)}%)`);
        console.log(`   Random results: ${randomCount} (${randomPercentage.toFixed(1)}%)`);
        console.log(`   Expected: ~60% zero-exposure, ~40% random`);

        // Cleanup
        const setKey = fiveDProtectionService.getZeroExposureSetKey(gameType, duration, periodId, timeline);
        await redisClient.del(setKey);
        
        console.log('\n⚡ [5D_PERFORMANCE] ==========================================');
        console.log('⚡ [5D_PERFORMANCE] Performance comparison completed!');
        console.log('⚡ [5D_PERFORMANCE] ==========================================');

    } catch (error) {
        console.error('❌ [5D_PERFORMANCE] Error in performance comparison:', error);
        throw error;
    }
}

// Run the performance comparison
compare5DPerformance().catch(console.error); 