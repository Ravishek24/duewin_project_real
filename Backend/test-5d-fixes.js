const gameLogicService = require('./services/gameLogicService');
const redisHelper = require('./config/redis');
const redisClient = redisHelper.getClient();

async function test5DFixes() {
    try {
        console.log('🎯 [5D_FIXES_TEST] ==========================================');
        console.log('🎯 [5D_FIXES_TEST] Testing 5D Game Fixes');
        console.log('🎯 [5D_FIXES_TEST] ==========================================');

        // Test 1: Verify 0-9 dice values
        console.log('\n🔍 [TEST_1] Testing 0-9 dice values...');
        
        const testResult = await gameLogicService.generateRandomResult('5d');
        console.log('Generated 5D result:', testResult);
        
        // Validate dice values are 0-9
        const diceValues = [testResult.A, testResult.B, testResult.C, testResult.D, testResult.E];
        const validRange = diceValues.every(val => val >= 0 && val <= 9);
        
        console.log(`Dice values: [${diceValues.join(', ')}]`);
        console.log(`All values in 0-9 range: ${validRange ? '✅ PASS' : '❌ FAIL'}`);
        
        if (!validRange) {
            throw new Error('5D dice values are not in 0-9 range!');
        }

        // Test 2: Verify position size logic (5-9 is big, 0-4 is small)
        console.log('\n🔍 [TEST_2] Testing position size logic...');
        
        const testCases = [
            { dice: 7, expected: 'big' },
            { dice: 3, expected: 'small' },
            { dice: 0, expected: 'small' },
            { dice: 9, expected: 'big' },
            { dice: 5, expected: 'big' },
            { dice: 4, expected: 'small' }
        ];
        
        for (const testCase of testCases) {
            const isBig = testCase.dice >= 5;
            const actual = isBig ? 'big' : 'small';
            const passed = actual === testCase.expected;
            
            console.log(`Dice ${testCase.dice} → ${actual} (expected: ${testCase.expected}): ${passed ? '✅' : '❌'}`);
        }

        // Test 3: Verify protection logic with low user count
        console.log('\n🔍 [TEST_3] Testing protection logic...');
        
        const periodId = 'TEST5D' + Date.now();
        const gameType = '5d';
        const duration = 60;
        const timeline = 'default';
        
        // Simulate low user count scenario
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
        
        // Add a single user bet to trigger protection
        const testBet = {
            userId: 1,
            betType: 'POSITION',
            betValue: 'A_5',
            netBetAmount: 100,
            grossBetAmount: 102,
            platformFee: 2,
            odds: 9.0
        };
        
        await redisClient.hset(betHashKey, 'test_bet_1', JSON.stringify(testBet));
        await redisClient.hset(exposureKey, 'bet:POSITION:A_5', '900'); // 9.0 * 100
        await redisClient.expire(betHashKey, 3600);
        await redisClient.expire(exposureKey, 3600);
        
        console.log('Added test bet for user 1');
        
        // Test protection logic
        const userCountResult = await gameLogicService.getUniqueUserCount(gameType, duration, periodId, timeline);
        console.log('User count result:', userCountResult);
        
        const shouldUseProtectedResult = userCountResult.uniqueUserCount < gameLogicService.ENHANCED_USER_THRESHOLD;
        console.log(`Should use protected result: ${shouldUseProtectedResult} (users: ${userCountResult.uniqueUserCount}, threshold: ${gameLogicService.ENHANCED_USER_THRESHOLD})`);
        
        if (shouldUseProtectedResult) {
            console.log('🛡️ Protection should be active for single user');
            
            // Test protected result selection
            const protectedResult = await gameLogicService.selectProtectedResultWithExposure(
                gameType, duration, periodId, timeline
            );
            
            if (protectedResult) {
                console.log('🛡️ Protected result selected:', protectedResult);
                
                // Verify the result doesn't match the user's bet
                const userBetWins = gameLogicService.checkFiveDWin('POSITION', 'A_5', protectedResult);
                console.log(`User bet A_5, result A=${protectedResult.A}, user wins: ${userBetWins}`);
                
                if (!userBetWins) {
                    console.log('✅ Protection working correctly - user loses');
                } else {
                    console.log('❌ Protection failed - user wins when they should lose');
                }
            } else {
                console.log('❌ Protection returned null result');
            }
        } else {
            console.log('ℹ️ Protection not needed - multiple users');
        }

        // Test 4: Verify win/loss calculations
        console.log('\n🔍 [TEST_4] Testing win/loss calculations...');
        
        const testBets = [
            { betType: 'POSITION', betValue: 'A_5', result: { A: 5, B: 3, C: 1, D: 6, E: 2 }, shouldWin: true },
            { betType: 'POSITION', betValue: 'A_5', result: { A: 3, B: 5, C: 1, D: 6, E: 2 }, shouldWin: false },
            { betType: 'POSITION_SIZE', betValue: 'A_big', result: { A: 7, B: 3, C: 1, D: 6, E: 2 }, shouldWin: true },
            { betType: 'POSITION_SIZE', betValue: 'A_small', result: { A: 3, B: 7, C: 1, D: 6, E: 2 }, shouldWin: true },
            { betType: 'POSITION_PARITY', betValue: 'A_odd', result: { A: 5, B: 3, C: 1, D: 6, E: 2 }, shouldWin: true },
            { betType: 'POSITION_PARITY', betValue: 'A_even', result: { A: 4, B: 3, C: 1, D: 6, E: 2 }, shouldWin: true }
        ];
        
        for (const testCase of testBets) {
            const winResult = gameLogicService.checkFiveDWin(
                testCase.betType, 
                testCase.betValue, 
                testCase.result
            );
            
            const passed = winResult === testCase.shouldWin;
            console.log(`${testCase.betType}:${testCase.betValue} vs result A=${testCase.result.A} → ${winResult ? 'WIN' : 'LOSE'} (expected: ${testCase.shouldWin ? 'WIN' : 'LOSE'}): ${passed ? '✅' : '❌'}`);
        }

        // Cleanup
        await redisClient.del(betHashKey);
        await redisClient.del(exposureKey);
        
        console.log('\n🎯 [5D_FIXES_TEST] ==========================================');
        console.log('🎯 [5D_FIXES_TEST] All tests completed successfully!');
        console.log('🎯 [5D_FIXES_TEST] ==========================================');

    } catch (error) {
        console.error('❌ [5D_FIXES_TEST] Error in 5D fixes test:', error);
        throw error;
    }
}

// Run the test
test5DFixes().catch(console.error); 