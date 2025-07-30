const unifiedRedis = require('./config/unifiedRedisManager');
const { 
    calculate5DExposureFast,
    getOptimal5DResultByExposureFast,
    checkFiveDWin
} = require('./services/gameLogicService');

async function test5DExposureFix() {
    try {
        console.log('🧪 [TEST_5D_EXPOSURE_FIX] Testing fixed 5D exposure calculation...');
        
        // Initialize Redis if needed
        if (!unifiedRedis.isInitialized) {
            await unifiedRedis.initialize();
        }
        
        const redis = unifiedRedis.getHelper();
        
        // Simulate the exact scenario from your example
        const testExposures = {
            'bet:SUM_PARITY:SUM_even': '200',  // 100 units * 2 odds
            'bet:SUM_PARITY:SUM_odd': '2',     // 1 unit * 2 odds
            'bet:SUM_SIZE:SUM_small': '202',   // 101 units * 2 odds
            'bet:SUM_SIZE:SUM_big': '2'        // 1 unit * 2 odds
        };
        
        console.log('🧪 [TEST_5D_EXPOSURE_FIX] Test exposures:', testExposures);
        
        // Test different combinations to see their exposure
        const testCombinations = [
            {
                name: 'SMALL + ODD (sum=13)',
                combination: {
                    dice_value: 10093,
                    dice_a: 1, dice_b: 0, dice_c: 0, dice_d: 9, dice_e: 3,
                    sum_value: 13,
                    sum_size: 'small',
                    sum_parity: 'odd'
                }
            },
            {
                name: 'BIG + ODD (sum=23)',
                combination: {
                    dice_value: 20093,
                    dice_a: 5, dice_b: 5, dice_c: 5, dice_d: 5, dice_e: 3,
                    sum_value: 23,
                    sum_size: 'big',
                    sum_parity: 'odd'
                }
            },
            {
                name: 'SMALL + EVEN (sum=12)',
                combination: {
                    dice_value: 10092,
                    dice_a: 1, dice_b: 0, dice_c: 0, dice_d: 9, dice_e: 2,
                    sum_value: 12,
                    sum_size: 'small',
                    sum_parity: 'even'
                }
            },
            {
                name: 'BIG + EVEN (sum=24)',
                combination: {
                    dice_value: 20094,
                    dice_a: 5, dice_b: 5, dice_c: 5, dice_d: 5, dice_e: 4,
                    sum_value: 24,
                    sum_size: 'big',
                    sum_parity: 'even'
                }
            }
        ];
        
        console.log('🧪 [TEST_5D_EXPOSURE_FIX] Testing exposure calculation for different combinations:');
        
        for (const testCase of testCombinations) {
            const exposure = await calculate5DExposureFast(testCase.combination, testExposures);
            console.log(`   - ${testCase.name}: ${exposure} exposure`);
            
            // Show which bets win for this combination
            const winningBets = [];
            if (testCase.combination.sum_value < 22 && testCase.combination.sum_value % 2 === 0) {
                winningBets.push('SUM_small', 'SUM_even');
            } else if (testCase.combination.sum_value < 22 && testCase.combination.sum_value % 2 === 1) {
                winningBets.push('SUM_small', 'SUM_odd');
            } else if (testCase.combination.sum_value >= 22 && testCase.combination.sum_value % 2 === 0) {
                winningBets.push('SUM_big', 'SUM_even');
            } else if (testCase.combination.sum_value >= 22 && testCase.combination.sum_value % 2 === 1) {
                winningBets.push('SUM_big', 'SUM_odd');
            }
            
            console.log(`     Winning bets: ${winningBets.join(', ')}`);
        }
        
        // The optimal result should be BIG + ODD (zero exposure)
        console.log('🧪 [TEST_5D_EXPOSURE_FIX] Expected optimal result: BIG + ODD (zero exposure)');
        
        // Test the fast protection system
        console.log('🧪 [TEST_5D_EXPOSURE_FIX] Testing fast protection system...');
        
        // Set up test data in Redis
        const testPeriodId = '20250729000001207';
        const testDuration = 60;
        const testTimeline = 'default';
        const exposureKey = `exposure:5d:${testDuration}:${testTimeline}:${testPeriodId}`;
        
        // Clear any existing data
        await redis.del(exposureKey);
        
        // Set test exposures
        for (const [key, value] of Object.entries(testExposures)) {
            await redis.hset(exposureKey, key, value);
        }
        
        const startTime = Date.now();
        
        try {
            const result = await getOptimal5DResultByExposureFast(testDuration, testPeriodId, testTimeline);
            const endTime = Date.now();
            
            console.log('🧪 [TEST_5D_EXPOSURE_FIX] Fast protection result:', result);
            console.log('🧪 [TEST_5D_EXPOSURE_FIX] Time taken:', endTime - startTime, 'ms');
            
            if (result) {
                const sum = result.A + result.B + result.C + result.D + result.E;
                const sumSize = sum < 22 ? 'small' : 'big';
                const sumParity = sum % 2 === 0 ? 'even' : 'odd';
                
                console.log('🧪 [TEST_5D_EXPOSURE_FIX] Result analysis:');
                console.log(`   - Sum: ${sum} (${sumSize} + ${sumParity})`);
                
                // Check if it protects against the large bets
                const protectsAgainstEven = sumParity === 'odd';
                const protectsAgainstSmall = sumSize === 'big';
                
                console.log('🧪 [TEST_5D_EXPOSURE_FIX] Protection analysis:');
                console.log(`   - Protects against SUM_even (100 units): ${protectsAgainstEven}`);
                console.log(`   - Protects against SUM_small (101 units): ${protectsAgainstSmall}`);
                
                if (protectsAgainstEven && protectsAgainstSmall) {
                    console.log('✅ [TEST_5D_EXPOSURE_FIX] SUCCESS: Result correctly protects against both large bets!');
                } else {
                    console.log('❌ [TEST_5D_EXPOSURE_FIX] FAILURE: Result does not protect correctly!');
                }
                
                // Calculate actual exposure for this result
                const actualExposure = await calculate5DExposureFast(result, testExposures);
                console.log('🧪 [TEST_5D_EXPOSURE_FIX] Actual exposure for selected result:', actualExposure);
                
                if (actualExposure === 0) {
                    console.log('✅ [TEST_5D_EXPOSURE_FIX] SUCCESS: Zero exposure achieved!');
                } else {
                    console.log('❌ [TEST_5D_EXPOSURE_FIX] FAILURE: Non-zero exposure!');
                }
            }
        } catch (error) {
            console.error('❌ [TEST_5D_EXPOSURE_FIX] Error in fast protection:', error);
        }
        
        // Clean up test data
        await redis.del(exposureKey);
        
    } catch (error) {
        console.error('❌ [TEST_5D_EXPOSURE_FIX] Test failed:', error);
    }
}

// Run the test
test5DExposureFix();