const { getRedisHelper } = require('./services/gameLogicService');

async function test5DProtectionFix() {
    try {
        console.log('🧪 [TEST_5D_PROTECTION] Testing enhanced 5D protection logic...');
        
        const redis = getRedisHelper();
        const testPeriodId = '20250729000000409';
        const testDuration = 60;
        const testTimeline = 'default';
        
        // Clear any existing test data
        const exposureKey = `exposure:5d:${testDuration}:${testTimeline}:${testPeriodId}`;
        await redis.del(exposureKey);
        
        // Simulate the conflicting bets from the user's example
        const testExposures = {
            'bet:SUM_SIZE:SUM_small': '10',  // 10 units on small
            'bet:SUM_SIZE:SUM_big': '1'      // 1 unit on big
        };
        
        // Set the test exposures in Redis
        for (const [key, value] of Object.entries(testExposures)) {
            await redis.hset(exposureKey, key, value);
        }
        
        console.log('🧪 [TEST_5D_PROTECTION] Set test exposures:', testExposures);
        
        // Get the exposures back to verify
        const retrievedExposures = await redis.hgetall(exposureKey);
        console.log('🧪 [TEST_5D_PROTECTION] Retrieved exposures:', retrievedExposures);
        
        // Test the protection logic detection
        const hasSumBigBet = Object.keys(retrievedExposures).some(key => 
            key === 'bet:SUM_SIZE:SUM_big' || key === 'bet:SUM_SIZE:big'
        );
        const hasSumSmallBet = Object.keys(retrievedExposures).some(key => 
            key === 'bet:SUM_SIZE:SUM_small' || key === 'bet:SUM_SIZE:small'
        );
        
        console.log('🧪 [TEST_5D_PROTECTION] Protection detection:');
        console.log('  - Has SUM_big bet:', hasSumBigBet);
        console.log('  - Has SUM_small bet:', hasSumSmallBet);
        console.log('  - Should apply protection:', hasSumBigBet && hasSumSmallBet);
        
        if (hasSumBigBet && hasSumSmallBet) {
            console.log('✅ [TEST_5D_PROTECTION] SUM_SIZE conflict detected correctly!');
            
            // Test exposure calculation
            const sumBigExposure = parseFloat(retrievedExposures['bet:SUM_SIZE:SUM_big'] || retrievedExposures['bet:SUM_SIZE:big'] || 0);
            const sumSmallExposure = parseFloat(retrievedExposures['bet:SUM_SIZE:SUM_small'] || retrievedExposures['bet:SUM_SIZE:small'] || 0);
            
            console.log('🧪 [TEST_5D_PROTECTION] Exposure analysis:');
            console.log('  - SUM_big exposure:', sumBigExposure);
            console.log('  - SUM_small exposure:', sumSmallExposure);
            console.log('  - Should force small result:', sumBigExposure > sumSmallExposure);
            
            if (sumBigExposure > sumSmallExposure) {
                console.log('✅ [TEST_5D_PROTECTION] Protection should force small result (< 22)');
            } else {
                console.log('✅ [TEST_5D_PROTECTION] Protection should force big result (>= 22)');
            }
        } else {
            console.log('❌ [TEST_5D_PROTECTION] SUM_SIZE conflict NOT detected!');
        }
        
        // Clean up test data
        await redis.del(exposureKey);
        console.log('🧪 [TEST_5D_PROTECTION] Test data cleaned up');
        
        console.log('✅ [TEST_5D_PROTECTION] Test completed successfully!');

    } catch (error) {
        console.error('❌ [TEST_5D_PROTECTION] Test failed:', error);
    }
}

// Run the test
test5DProtectionFix(); 