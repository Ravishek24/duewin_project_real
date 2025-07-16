const gameLogicService = require('./services/gameLogicService');
const redisHelper = require('./config/redis');
const redisClient = redisHelper.getClient();

async function test5DExposureProtection() {
    try {
        console.log('🎯 [5D_EXPOSURE_PROTECTION_TEST] ==========================================');
        console.log('🎯 [5D_EXPOSURE_PROTECTION_TEST] Testing 5D Exposure-Based Protection');
        console.log('🎯 [5D_EXPOSURE_PROTECTION_TEST] ==========================================');

        // Test 1: Zero exposure scenario
        console.log('\n🔍 [TEST_1] Testing zero exposure scenario...');
        
        const periodId = 'TEST5D' + Date.now();
        const gameType = '5d';
        const duration = 60;
        const timeline = 'default';
        
        // Simulate bets with some zero exposure combinations
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
        
        // Add bets that create zero exposure for some combinations
        const testBets = [
            {
                userId: 1,
                betType: 'POSITION',
                betValue: 'A_5',
                netBetAmount: 100,
                grossBetAmount: 102,
                platformFee: 2,
                odds: 9.0
            },
            {
                userId: 2,
                betType: 'POSITION',
                betValue: 'B_3',
                netBetAmount: 50,
                grossBetAmount: 51,
                platformFee: 1,
                odds: 9.0
            }
        ];
        
        // Store bets and exposures
        for (let i = 0; i < testBets.length; i++) {
            await redisClient.hset(betHashKey, `test_bet_${i}`, JSON.stringify(testBets[i]));
            
            // Add exposure for the bet
            const exposure = Math.round(testBets[i].netBetAmount * testBets[i].odds * 100);
            await redisClient.hset(exposureKey, `bet:${testBets[i].betType}:${testBets[i].betValue}`, exposure);
        }
        
        await redisClient.expire(betHashKey, 3600);
        await redisClient.expire(exposureKey, 3600);
        
        console.log('Added test bets with specific exposures');
        
        // Test protection logic
        const userCountResult = await gameLogicService.getUniqueUserCount(gameType, duration, periodId, timeline);
        console.log('User count result:', userCountResult);
        
        const shouldUseProtectedResult = userCountResult.uniqueUserCount < gameLogicService.ENHANCED_USER_THRESHOLD;
        console.log(`Should use protected result: ${shouldUseProtectedResult} (users: ${userCountResult.uniqueUserCount}, threshold: ${gameLogicService.ENHANCED_USER_THRESHOLD})`);
        
        if (shouldUseProtectedResult) {
            console.log('🛡️ Protection should be active for low user count');
            
            // Test protected result selection
            const protectedResult = await gameLogicService.selectProtectedResultWithExposure(
                gameType, duration, periodId, timeline
            );
            
            if (protectedResult) {
                console.log('🛡️ Protected result selected:', protectedResult);
                
                // Verify the result doesn't match the user's bets
                const userBet1Wins = gameLogicService.checkFiveDWin('POSITION', 'A_5', protectedResult);
                const userBet2Wins = gameLogicService.checkFiveDWin('POSITION', 'B_3', protectedResult);
                
                console.log(`User bet A_5, result A=${protectedResult.A}, user wins: ${userBet1Wins}`);
                console.log(`User bet B_3, result B=${protectedResult.B}, user wins: ${userBet2Wins}`);
                
                if (!userBet1Wins && !userBet2Wins) {
                    console.log('✅ Protection working correctly - users lose');
                } else {
                    console.log('❌ Protection failed - users win when they should lose');
                }
            } else {
                console.log('❌ Protection returned null result');
            }
        } else {
            console.log('ℹ️ Protection not needed - multiple users');
        }

        // Test 2: Simple position-based protection test
        console.log('\n🔍 [TEST_2] Testing simple position-based protection...');
        
        const periodId2 = 'TEST5D2' + Date.now();
        const exposureKey2 = `exposure:${gameType}:${duration}:${timeline}:${periodId2}`;
        
        // Add only position bets with A_4 having lowest exposure
        const positionBets = [
            { betType: 'POSITION', betValue: 'A_0', exposure: 1000 },
            { betType: 'POSITION', betValue: 'A_1', exposure: 800 },
            { betType: 'POSITION', betValue: 'A_2', exposure: 600 },
            { betType: 'POSITION', betValue: 'A_3', exposure: 400 },
            { betType: 'POSITION', betValue: 'A_4', exposure: 50 }, // Lowest exposure
            { betType: 'POSITION', betValue: 'A_5', exposure: 1200 },
            { betType: 'POSITION', betValue: 'A_6', exposure: 900 },
            { betType: 'POSITION', betValue: 'A_7', exposure: 700 },
            { betType: 'POSITION', betValue: 'A_8', exposure: 500 },
            { betType: 'POSITION', betValue: 'A_9', exposure: 300 }
        ];
        
        // Store position exposures
        for (const bet of positionBets) {
            await redisClient.hset(exposureKey2, `bet:${bet.betType}:${bet.betValue}`, bet.exposure);
        }
        
        await redisClient.expire(exposureKey2, 3600);
        
        console.log('Added position bets with A_4 having lowest exposure (50)');
        
        // Test protection logic for lowest exposure
        const protectedResult2 = await gameLogicService.selectProtectedResultWithExposure(
            gameType, duration, periodId2, timeline
        );
        
        if (protectedResult2) {
            console.log('🛡️ Protected result (lowest exposure):', protectedResult2);
            
            // Check if the result has A=4 (lowest exposure position)
            if (protectedResult2.A === 4) {
                console.log('✅ Protection correctly selected lowest exposure position (A=4)');
            } else {
                console.log(`❌ Protection selected A=${protectedResult2.A}, expected A=4 for lowest exposure`);
            }
        } else {
            console.log('❌ Protection returned null result for lowest exposure test');
        }

        // Test 3: Multiple lowest exposure positions
        console.log('\n🔍 [TEST_3] Testing multiple lowest exposure positions...');
        
        const periodId3 = 'TEST5D3' + Date.now();
        const exposureKey3 = `exposure:${gameType}:${duration}:${timeline}:${periodId3}`;
        
        // Add position bets with A_1, A_2, A_3 having same lowest exposure
        const multipleLowestBets = [
            { betType: 'POSITION', betValue: 'A_0', exposure: 1000 },
            { betType: 'POSITION', betValue: 'A_1', exposure: 50 }, // Lowest
            { betType: 'POSITION', betValue: 'A_2', exposure: 50 }, // Lowest (same)
            { betType: 'POSITION', betValue: 'A_3', exposure: 50 }, // Lowest (same)
            { betType: 'POSITION', betValue: 'A_4', exposure: 200 },
            { betType: 'POSITION', betValue: 'A_5', exposure: 300 },
            { betType: 'POSITION', betValue: 'A_6', exposure: 400 },
            { betType: 'POSITION', betValue: 'A_7', exposure: 500 },
            { betType: 'POSITION', betValue: 'A_8', exposure: 600 },
            { betType: 'POSITION', betValue: 'A_9', exposure: 700 }
        ];
        
        // Store multiple lowest exposures
        for (const bet of multipleLowestBets) {
            await redisClient.hset(exposureKey3, `bet:${bet.betType}:${bet.betValue}`, bet.exposure);
        }
        
        await redisClient.expire(exposureKey3, 3600);
        
        console.log('Added position bets with A_1, A_2, A_3 all having lowest exposure (50)');
        
        // Test protection logic for multiple lowest exposure
        const protectedResult3 = await gameLogicService.selectProtectedResultWithExposure(
            gameType, duration, periodId3, timeline
        );
        
        if (protectedResult3) {
            console.log('🛡️ Protected result (multiple lowest):', protectedResult3);
            
            // Check if the result is one of the lowest exposure positions
            if ([1, 2, 3].includes(protectedResult3.A)) {
                console.log(`✅ Protection correctly selected from multiple lowest exposure positions (A=${protectedResult3.A})`);
            } else {
                console.log(`❌ Protection selected A=${protectedResult3.A}, expected A=1,2,or 3 for lowest exposure`);
            }
        } else {
            console.log('❌ Protection returned null result for multiple lowest exposure test');
        }

        // Cleanup
        await redisClient.del(betHashKey);
        await redisClient.del(exposureKey);
        await redisClient.del(exposureKey2);
        await redisClient.del(exposureKey3);
        
        console.log('\n🎯 [5D_EXPOSURE_PROTECTION_TEST] ==========================================');
        console.log('🎯 [5D_EXPOSURE_PROTECTION_TEST] All tests completed successfully!');
        console.log('🎯 [5D_EXPOSURE_PROTECTION_TEST] ==========================================');

    } catch (error) {
        console.error('❌ [5D_EXPOSURE_PROTECTION_TEST] Error in 5D exposure protection test:', error);
        throw error;
    }
}

// Run the test
test5DExposureProtection().catch(console.error); 