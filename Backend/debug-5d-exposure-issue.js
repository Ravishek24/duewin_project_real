const unifiedRedis = require('./config/unifiedRedisManager');

async function debug5DExposureIssue() {
    try {
        console.log('🔍 [DEBUG_5D_EXPOSURE] Starting 5D exposure debug...');
        
        // Initialize Redis if needed
        if (!unifiedRedis.isInitialized) {
            await unifiedRedis.initialize();
        }
        
        const redis = unifiedRedis.getHelper();
        const testPeriodId = '20250729000001207';
        const testDuration = 60;
        const testTimeline = 'default';
        
        // Get the actual exposure data from Redis
        const exposureKey = `exposure:5d:${testDuration}:${testTimeline}:${testPeriodId}`;
        const betExposures = await redis.hgetall(exposureKey);
        
        console.log('🔍 [DEBUG_5D_EXPOSURE] Actual Redis exposure data:', betExposures);
        
        // Analyze the bet data from your example
        const testBets = [
            { betType: 'SUM_PARITY', betValue: 'SUM_even', betAmount: 100 },
            { betType: 'SUM_PARITY', betValue: 'SUM_odd', betAmount: 1 },
            { betType: 'SUM_SIZE', betValue: 'SUM_small', betAmount: 100 },
            { betType: 'SUM_SIZE', betValue: 'SUM_small', betAmount: 1 },
            { betType: 'SUM_SIZE', betValue: 'SUM_big', betAmount: 1 }
        ];
        
        console.log('🔍 [DEBUG_5D_EXPOSURE] Test bet analysis:');
        testBets.forEach(bet => {
            console.log(`   - ${bet.betType}:${bet.betValue} = ${bet.betAmount} units`);
        });
        
        // Expected result: sum=13 (small + odd)
        const actualResult = {
            A: 1, B: 0, C: 0, D: 9, E: 3,
            sum: 13,
            sum_size: 'small',
            sum_parity: 'odd'
        };
        
        console.log('🔍 [DEBUG_5D_EXPOSURE] Actual result:', actualResult);
        
        // Test win checking for each bet using the actual checkFiveDWin function
        console.log('🔍 [DEBUG_5D_EXPOSURE] Win checking analysis:');
        testBets.forEach(bet => {
            // Import the function dynamically
            const { checkFiveDWin } = require('./services/gameLogicService');
            const wins = checkFiveDWin(bet.betType, bet.betValue, actualResult);
            console.log(`   - ${bet.betType}:${bet.betValue} wins: ${wins}`);
        });
        
        // Analyze the exposure calculation issue
        console.log('🔍 [DEBUG_5D_EXPOSURE] Exposure calculation analysis:');
        
        // The issue: The exposure is stored as 'bet:SUM_PARITY:SUM_even' but the winning conditions
        // are stored in a different format. Let me check what the actual winning conditions look like.
        
        // Test with a simple exposure calculation
        const sampleExposures = {
            'bet:SUM_PARITY:SUM_even': '200',  // 100 units * 2 odds
            'bet:SUM_PARITY:SUM_odd': '2',     // 1 unit * 2 odds
            'bet:SUM_SIZE:SUM_small': '202',   // 101 units * 2 odds
            'bet:SUM_SIZE:SUM_big': '2'        // 1 unit * 2 odds
        };
        
        console.log('🔍 [DEBUG_5D_EXPOSURE] Sample exposures for testing:', sampleExposures);
        
        // Calculate what the exposure should be for the actual result (sum=13, small+odd)
        let expectedExposure = 0;
        
        // SUM_even bet (100 units) - should NOT win for sum=13 (odd)
        // SUM_odd bet (1 unit) - should win for sum=13 (odd) = 2 exposure
        // SUM_small bet (101 units) - should win for sum=13 (small) = 202 exposure  
        // SUM_big bet (1 unit) - should NOT win for sum=13 (small)
        
        expectedExposure = 2 + 202; // SUM_odd + SUM_small = 204
        
        console.log('🔍 [DEBUG_5D_EXPOSURE] Expected exposure for sum=13 (small+odd):', expectedExposure);
        console.log('🔍 [DEBUG_5D_EXPOSURE] Breakdown:');
        console.log('   - SUM_odd (1 unit) wins = 2 exposure');
        console.log('   - SUM_small (101 units) wins = 202 exposure');
        console.log('   - Total = 204 exposure');
        
        // The problem: The system should select a result with ZERO exposure
        // For zero exposure, we need a result that is:
        // - NOT even (to avoid SUM_even bet)
        // - NOT small (to avoid SUM_small bet)
        // So we need: BIG + ODD
        
        console.log('🔍 [DEBUG_5D_EXPOSURE] For ZERO exposure, we need: BIG + ODD');
        console.log('🔍 [DEBUG_5D_EXPOSURE] This would make:');
        console.log('   - SUM_even lose (good, it has 100 units)');
        console.log('   - SUM_odd lose (bad, but only 1 unit)');
        console.log('   - SUM_small lose (good, it has 101 units)');
        console.log('   - SUM_big win (bad, but only 1 unit)');
        console.log('🔍 [DEBUG_5D_EXPOSURE] Net result: Avoid 201 units of exposure');
        
        // The actual result was small+odd, which means:
        // - SUM_even lost (good: saved 200 exposure)
        // - SUM_odd won (bad: cost 2 exposure)  
        // - SUM_small won (bad: cost 202 exposure)
        // - SUM_big lost (good: saved 2 exposure)
        // Net: -200 + 2 + 202 - 2 = +2 exposure (not optimal!)
        
        console.log('🔍 [DEBUG_5D_EXPOSURE] Actual result analysis:');
        console.log('   - SUM_even lost: saved 200 exposure');
        console.log('   - SUM_odd won: cost 2 exposure');
        console.log('   - SUM_small won: cost 202 exposure');
        console.log('   - SUM_big lost: saved 2 exposure');
        console.log('   - Net: -200 + 2 + 202 - 2 = +2 exposure');
        
        console.log('🔍 [DEBUG_5D_EXPOSURE] CONCLUSION: The protection system is NOT working correctly!');
        console.log('🔍 [DEBUG_5D_EXPOSURE] It should have selected BIG+ODD for zero exposure, but selected SMALL+ODD instead.');
        
    } catch (error) {
        console.error('❌ [DEBUG_5D_EXPOSURE] Debug failed:', error);
    }
}

// Run the debug
debug5DExposureIssue();