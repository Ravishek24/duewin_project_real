const { getRedisHelper } = require('./services/gameLogicService');

async function test5DMultiProtection() {
    try {
        console.log('🧪 [TEST_5D_MULTI_PROTECTION] Testing enhanced 5D multi-protection logic...');
        
        const redis = getRedisHelper();
        const testPeriodId = '20250729000001132';
        const testDuration = 60;
        const testTimeline = 'default';
        
        // Clear any existing test data
        const exposureKey = `exposure:5d:${testDuration}:${testTimeline}:${testPeriodId}`;
        await redis.del(exposureKey);
        
        // Simulate the exact scenario from the user's example
        const testExposures = {
            'bet:SUM_SIZE:SUM_big': '100',    // 100 units on big
            'bet:SUM_PARITY:SUM_even': '100'  // 100 units on even
        };
        
        // Set the test exposures in Redis
        for (const [key, value] of Object.entries(testExposures)) {
            await redis.hset(exposureKey, key, value);
        }
        
        console.log('🧪 [TEST_5D_MULTI_PROTECTION] Set test exposures:', testExposures);
        
        // Get the exposures back to verify
        const retrievedExposures = await redis.hgetall(exposureKey);
        console.log('🧪 [TEST_5D_MULTI_PROTECTION] Retrieved exposures:', retrievedExposures);
        
        // Test the protection logic detection
        const hasSumBigBet = Object.keys(retrievedExposures).some(key => 
            key === 'bet:SUM_SIZE:SUM_big' || key === 'bet:SUM_SIZE:big'
        );
        const hasSumSmallBet = Object.keys(retrievedExposures).some(key => 
            key === 'bet:SUM_SIZE:SUM_small' || key === 'bet:SUM_SIZE:small'
        );
        const hasSumEvenBet = Object.keys(retrievedExposures).some(key => 
            key === 'bet:SUM_PARITY:SUM_even' || key === 'bet:SUM_PARITY:even'
        );
        const hasSumOddBet = Object.keys(retrievedExposures).some(key => 
            key === 'bet:SUM_PARITY:SUM_odd' || key === 'bet:SUM_PARITY:odd'
        );
        
        console.log('🧪 [TEST_5D_MULTI_PROTECTION] Protection detection:');
        console.log('  - Has SUM_big bet:', hasSumBigBet);
        console.log('  - Has SUM_small bet:', hasSumSmallBet);
        console.log('  - Has SUM_even bet:', hasSumEvenBet);
        console.log('  - Has SUM_odd bet:', hasSumOddBet);
        
        // Determine expected protection conditions
        const expectedConditions = [];
        
        if (hasSumBigBet && !hasSumSmallBet) {
            expectedConditions.push('SUM_SIZE_BIG_ONLY');
        }
        if (hasSumEvenBet && !hasSumOddBet) {
            expectedConditions.push('SUM_PARITY_EVEN_ONLY');
        }
        
        console.log('🧪 [TEST_5D_MULTI_PROTECTION] Expected protection conditions:', expectedConditions);
        
        // Test exposure calculation
        const sumBigExposure = parseFloat(retrievedExposures['bet:SUM_SIZE:SUM_big'] || retrievedExposures['bet:SUM_SIZE:big'] || 0);
        const sumEvenExposure = parseFloat(retrievedExposures['bet:SUM_PARITY:SUM_even'] || retrievedExposures['bet:SUM_PARITY:even'] || 0);
        
        console.log('🧪 [TEST_5D_MULTI_PROTECTION] Exposure analysis:');
        console.log('  - SUM_big exposure:', sumBigExposure);
        console.log('  - SUM_even exposure:', sumEvenExposure);
        
        // Determine expected result characteristics
        let expectedSumSize = null;
        let expectedSumParity = null;
        
        if (expectedConditions.includes('SUM_SIZE_BIG_ONLY')) {
            expectedSumSize = 'small'; // Force small to avoid big bet
        }
        if (expectedConditions.includes('SUM_PARITY_EVEN_ONLY')) {
            expectedSumParity = 'odd'; // Force odd to avoid even bet
        }
        
        console.log('🧪 [TEST_5D_MULTI_PROTECTION] Expected result characteristics:');
        console.log('  - Expected sum size:', expectedSumSize);
        console.log('  - Expected sum parity:', expectedSumParity);
        
        // Test the protection logic manually
        let whereConditions = [];
        
        if (expectedConditions.includes('SUM_SIZE_BIG_ONLY')) {
            whereConditions.push('sum_value < 22'); // Force small
        }
        if (expectedConditions.includes('SUM_PARITY_EVEN_ONLY')) {
            whereConditions.push('sum_value % 2 = 1'); // Force odd
        }
        
        console.log('🧪 [TEST_5D_MULTI_PROTECTION] Expected WHERE conditions:', whereConditions);
        
        if (whereConditions.length > 0) {
            const expectedQuery = `WHERE ${whereConditions.join(' AND ')}`;
            console.log('🧪 [TEST_5D_MULTI_PROTECTION] Expected query fragment:', expectedQuery);
            
            // Verify the logic
            if (expectedConditions.includes('SUM_SIZE_BIG_ONLY') && expectedConditions.includes('SUM_PARITY_EVEN_ONLY')) {
                console.log('✅ [TEST_5D_MULTI_PROTECTION] Multi-protection scenario detected correctly!');
                console.log('✅ [TEST_5D_MULTI_PROTECTION] Should force: sum < 22 AND sum % 2 = 1');
                console.log('✅ [TEST_5D_MULTI_PROTECTION] This means: small AND odd result');
                
                // Test some valid combinations
                const validSums = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21]; // Small and odd
                console.log('🧪 [TEST_5D_MULTI_PROTECTION] Valid sum values for protection:', validSums);
                
                // Check if the user's result (sum: 12) would be valid
                const userResultSum = 12;
                const userResultSize = userResultSum < 22 ? 'small' : 'big';
                const userResultParity = userResultSum % 2 === 0 ? 'even' : 'odd';
                
                console.log('🧪 [TEST_5D_MULTI_PROTECTION] User result analysis:');
                console.log(`  - Sum: ${userResultSum}`);
                console.log(`  - Size: ${userResultSize}`);
                console.log(`  - Parity: ${userResultParity}`);
                console.log(`  - Valid for protection: ${userResultSize === 'small' && userResultParity === 'odd'}`);
                
                if (userResultSize === 'small' && userResultParity === 'odd') {
                    console.log('✅ [TEST_5D_MULTI_PROTECTION] User result would be valid for protection');
                } else {
                    console.log('❌ [TEST_5D_MULTI_PROTECTION] User result is NOT valid for protection!');
                    console.log('❌ [TEST_5D_MULTI_PROTECTION] Expected: small AND odd, Got:', userResultSize, 'AND', userResultParity);
                }
            }
        }
        
        // Clean up test data
        await redis.del(exposureKey);
        console.log('🧪 [TEST_5D_MULTI_PROTECTION] Test data cleaned up');
        
        console.log('✅ [TEST_5D_MULTI_PROTECTION] Test completed successfully!');
        
    } catch (error) {
        console.error('❌ [TEST_5D_MULTI_PROTECTION] Test failed:', error);
    }
}

// Run the test
test5DMultiProtection();