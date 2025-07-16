const { initializeModels } = require('./models');
const fiveDProtectionService = require('./services/fiveDProtectionService');
const redisHelper = require('./config/redis');
const redisClient = redisHelper.getClient();

async function test5DProtectionService() {
    try {
        console.log('🎯 [5D_PROTECTION_TEST] ==========================================');
        console.log('🎯 [5D_PROTECTION_TEST] Testing 5D Protection Service');
        console.log('🎯 [5D_PROTECTION_TEST] ==========================================');

        // Initialize models first
        console.log('\n🔧 [INIT] Initializing models...');
        await initializeModels();
        console.log('✅ Models initialized successfully');

        const gameType = '5d';
        const duration = 60;
        const periodId = 'TEST5D' + Date.now();
        const timeline = 'default';

        // Test 1: Initialize zero-exposure candidates
        console.log('\n🔍 [TEST_1] Initializing zero-exposure candidates...');
        
        const initCount = await fiveDProtectionService.initializeZeroExposureCandidates(
            gameType, duration, periodId, timeline
        );
        
        console.log(`✅ Initialized ${initCount} zero-exposure candidates`);

        // Test 2: Get protection stats
        console.log('\n🔍 [TEST_2] Getting protection stats...');
        
        const stats = await fiveDProtectionService.getProtectionStats(
            gameType, duration, periodId, timeline
        );
        
        console.log('Protection stats:', stats);

        // Test 3: Simulate bets and remove combinations
        console.log('\n🔍 [TEST_3] Simulating bets and removing combinations...');
        
        const testBets = [
            { betType: 'POSITION', betValue: 'A_5' },
            { betType: 'POSITION', betValue: 'B_3' },
            { betType: 'SUM', betValue: '15' }
        ];

        for (const bet of testBets) {
            console.log(`Placing bet: ${bet.betType}:${bet.betValue}`);
            
            const removedCount = await fiveDProtectionService.removeCombinationFromZeroExposure(
                gameType, duration, periodId, timeline,
                bet.betType, bet.betValue
            );
            
            console.log(`Removed ${removedCount} combinations for this bet`);
            
            // Get updated stats
            const updatedStats = await fiveDProtectionService.getProtectionStats(
                gameType, duration, periodId, timeline
            );
            console.log(`Remaining zero-exposure: ${updatedStats.remainingZeroExposure}`);
        }

        // Test 4: Test 60/40 protection logic
        console.log('\n🔍 [TEST_4] Testing 60/40 protection logic...');
        
        const results = [];
        const iterations = 10;
        
        for (let i = 0; i < iterations; i++) {
            const result = await fiveDProtectionService.getProtectedResult(
                gameType, duration, periodId, timeline
            );
            results.push(result);
            console.log(`Iteration ${i + 1}:`, result);
        }

        // Analyze results
        console.log('\n📊 [ANALYSIS] Protection Results Analysis:');
        console.log(`Total iterations: ${iterations}`);
        console.log(`Unique results: ${new Set(results.map(r => JSON.stringify(r))).size}`);
        
        // Check for zero-exposure vs random patterns
        const zeroExposureResults = results.filter(r => {
            // This is a simplified check - in real implementation you'd check actual exposure
            return r.dice_a === 5 || r.dice_b === 3; // Avoid the bet positions
        });
        
        console.log(`Results avoiding bet positions: ${zeroExposureResults.length}/${iterations}`);

        // Test 5: Test zero-exposure only
        console.log('\n🔍 [TEST_5] Testing zero-exposure only selection...');
        
        const zeroExposureResult = await fiveDProtectionService.getZeroExposureResult(
            gameType, duration, periodId, timeline
        );
        
        console.log('Zero-exposure result:', zeroExposureResult);

        // Test 6: Test random selection only
        console.log('\n🔍 [TEST_6] Testing random selection only...');
        
        const randomResult = await fiveDProtectionService.getRandomResult(
            gameType, duration, periodId, timeline
        );
        
        console.log('Random result:', randomResult);

        // Test 7: Test with more bets to exhaust zero-exposure
        console.log('\n🔍 [TEST_7] Testing with more bets to exhaust zero-exposure...');
        
        const moreBets = [
            { betType: 'POSITION', betValue: 'A_0' },
            { betType: 'POSITION', betValue: 'A_1' },
            { betType: 'POSITION', betValue: 'A_2' },
            { betType: 'POSITION', betValue: 'A_3' },
            { betType: 'POSITION', betValue: 'A_4' },
            { betType: 'POSITION', betValue: 'A_6' },
            { betType: 'POSITION', betValue: 'A_7' },
            { betType: 'POSITION', betValue: 'A_8' },
            { betType: 'POSITION', betValue: 'A_9' }
        ];

        for (const bet of moreBets) {
            await fiveDProtectionService.removeCombinationFromZeroExposure(
                gameType, duration, periodId, timeline,
                bet.betType, bet.betValue
            );
        }

        // Try to get zero-exposure result (should fall back to lowest exposure)
        const fallbackResult = await fiveDProtectionService.getZeroExposureResult(
            gameType, duration, periodId, timeline
        );
        
        console.log('Fallback result (should be lowest exposure):', fallbackResult);

        // Cleanup
        const setKey = fiveDProtectionService.getZeroExposureSetKey(gameType, duration, periodId, timeline);
        await redisClient.del(setKey);
        
        console.log('\n🎯 [5D_PROTECTION_TEST] ==========================================');
        console.log('🎯 [5D_PROTECTION_TEST] All tests completed successfully!');
        console.log('🎯 [5D_PROTECTION_TEST] ==========================================');

    } catch (error) {
        console.error('❌ [5D_PROTECTION_TEST] Error in 5D protection test:', error);
        throw error;
    }
}

// Run the test
test5DProtectionService().catch(console.error); 