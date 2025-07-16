const gameLogicService = require('./services/gameLogicService');
const redisClient = require('./config/redis').getClient();

async function test5DProtectionFix() {
    try {
        console.log('🎯 [5D_PROTECTION_FIX_TEST] ==========================================');
        console.log('🎯 [5D_PROTECTION_FIX_TEST] Testing 5D Protection Logic Fix');
        console.log('🎯 [5D_PROTECTION_FIX_TEST] ==========================================');

        // Test period data
        const periodId = '20241201003';
        const gameType = '5d';
        const duration = 30;
        const timeline = 'default';

        console.log('\n📊 [5D_TEST_INFO] Test Period Details:');
        console.log(`   - Period ID: ${periodId}`);
        console.log(`   - Game Type: ${gameType}`);
        console.log(`   - Duration: ${duration}s`);
        console.log(`   - Timeline: ${timeline}`);

        // Clear any existing data
        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
        const betsKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        await redisClient.del(exposureKey);
        await redisClient.del(betsKey);

        console.log('\n🧹 [5D_CLEANUP] Cleared existing data');

        // Step 1: Simulate your exact bet scenario
        console.log('\n💰 [5D_BET_SCENARIO] Simulating your bet scenario...');
        console.log('💰 [5D_BET_SCENARIO] You bet on A_1, A_2, A_3, A_4, A_5, A_6, A_7, A_8, A_9');
        console.log('💰 [5D_BET_SCENARIO] You did NOT bet on A_0 (this should be the unbet position)');

        const testBets = [
            { betType: 'POSITION', betValue: 'A_1', betAmount: 100, odds: 9.0 },
            { betType: 'POSITION', betValue: 'A_2', betAmount: 100, odds: 9.0 },
            { betType: 'POSITION', betValue: 'A_3', betAmount: 100, odds: 9.0 },
            { betType: 'POSITION', betValue: 'A_4', betAmount: 100, odds: 9.0 },
            { betType: 'POSITION', betValue: 'A_5', betAmount: 100, odds: 9.0 },
            { betType: 'POSITION', betValue: 'A_6', betAmount: 100, odds: 9.0 },
            { betType: 'POSITION', betValue: 'A_7', betAmount: 100, odds: 9.0 },
            { betType: 'POSITION', betValue: 'A_8', betAmount: 100, odds: 9.0 },
            { betType: 'POSITION', betValue: 'A_9', betAmount: 100, odds: 9.0 }
            // A_0 is intentionally missing - this should be the unbet position
        ];

        // Place bets and track exposure
        for (let i = 0; i < testBets.length; i++) {
            const bet = testBets[i];
            console.log(`\n💰 [5D_BET_${i + 1}] Placing bet: ${bet.betType}:${bet.betValue}`);

            // Store bet in Redis
            const betId = `bet_${Date.now()}_${i}`;
            await redisClient.hset(betsKey, betId, JSON.stringify({
                userId: 'test_user',
                betType: bet.betType,
                betValue: bet.betValue,
                betAmount: bet.betAmount,
                odds: bet.odds
            }));

            // Update exposure
            const exposure = Math.round(bet.betAmount * bet.odds * 100);
            const betKey = `${bet.betType}:${bet.betValue}`;
            await redisClient.hincrby(exposureKey, `bet:${betKey}`, exposure);

            console.log(`💰 [5D_BET_${i + 1}_EXPOSURE] Added exposure: ${exposure} cents (₹${(exposure / 100).toFixed(2)}) for ${betKey}`);
        }

        // Step 2: Check final exposure data
        console.log('\n💰 [5D_FINAL_EXPOSURE] Final exposure data:');
        const finalExposure = await redisClient.hgetall(exposureKey);
        
        if (Object.keys(finalExposure).length > 0) {
            console.log('💰 [5D_EXPOSURE_BREAKDOWN]:');
            let totalExposure = 0;
            
            for (const [betKey, exposure] of Object.entries(finalExposure)) {
                const exposureRupees = (parseFloat(exposure) / 100).toFixed(2);
                totalExposure += parseFloat(exposure);
                console.log(`   - ${betKey}: ${exposure} cents (₹${exposureRupees})`);
            }
            
            console.log(`💰 [5D_TOTAL_EXPOSURE] Total exposure: ${totalExposure} cents (₹${(totalExposure / 100).toFixed(2)})`);
        }

        // Step 3: Test the findUnbetPositions function
        console.log('\n🛡️ [5D_UNBET_TEST] Testing findUnbetPositions function...');
        const unbetPositions = findUnbetPositions(finalExposure);
        console.log('🛡️ [5D_UNBET_RESULT] Unbet positions:', unbetPositions);

        // Step 4: Verify A_0 is in unbet positions
        console.log('\n✅ [5D_VERIFICATION] Verifying protection logic...');
        if (unbetPositions.A && unbetPositions.A.includes(0)) {
            console.log('✅ [5D_VERIFICATION] SUCCESS: A_0 is correctly identified as unbet position');
        } else {
            console.log('❌ [5D_VERIFICATION] FAILURE: A_0 is NOT in unbet positions');
            console.log('❌ [5D_VERIFICATION] Expected: A_0 to be unbet, Actual:', unbetPositions.A);
        }

        // Step 5: Test protection result selection
        console.log('\n🎯 [5D_PROTECTION_TEST] Testing protection result selection...');
        const protectedResult = await gameLogicService.selectProtectedResultWithExposure(
            gameType, duration, periodId, timeline
        );

        if (protectedResult) {
            console.log('🎯 [5D_PROTECTION_RESULT] Selected protected result:', protectedResult);
            
            // Check if the result uses A_0
            if (protectedResult.A === 0) {
                console.log('✅ [5D_PROTECTION_SUCCESS] SUCCESS: Result correctly uses A_0 (unbet position)');
            } else {
                console.log('❌ [5D_PROTECTION_FAILURE] FAILURE: Result uses A:', protectedResult.A, 'instead of A: 0');
                console.log('❌ [5D_PROTECTION_FAILURE] This means the protection logic is still not working correctly');
            }
        } else {
            console.log('❌ [5D_PROTECTION_FAILURE] No protected result found');
        }

        console.log('\n🎯 [5D_PROTECTION_FIX_TEST] ==========================================');
        console.log('🎯 [5D_PROTECTION_FIX_TEST] 5D Protection Fix Test completed');
        console.log('🎯 [5D_PROTECTION_FIX_TEST] ==========================================');

    } catch (error) {
        console.error('❌ [5D_PROTECTION_FIX_TEST] Error in 5D protection fix test:', error);
    }
}

// Helper function to find unbet positions (copied from gameLogicService)
function findUnbetPositions(betExposures) {
    const unbetPositions = {
        A: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        B: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        C: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        D: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
        E: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    };

    // Remove bet positions
    for (const betKey of Object.keys(betExposures)) {
        if (betKey.startsWith('bet:POSITION:')) {
            const match = betKey.match(/POSITION:([A-E])_(\d)/);
            if (match) {
                const [_, position, value] = match;
                const index = unbetPositions[position].indexOf(parseInt(value));
                if (index > -1) {
                    unbetPositions[position].splice(index, 1);
                }
            }
        }
    }

    return unbetPositions;
}

// Run the test
test5DProtectionFix().then(() => {
    console.log('✅ 5D protection fix test completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ 5D protection fix test failed:', error);
    process.exit(1);
}); 