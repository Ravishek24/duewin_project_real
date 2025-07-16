const gameLogicService = require('./services/gameLogicService');
const redisClient = require('./config/redis').getClient();

async function test5DWithBets() {
    try {
        console.log('🎲 [5D_TEST_WITH_BETS] ==========================================');
        console.log('🎲 [5D_TEST_WITH_BETS] Testing 5D with simulated bets');
        console.log('🎲 [5D_TEST_WITH_BETS] ==========================================');

        // Test period data
        const periodId = '20241201002';
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

        // Step 1: Simulate placing bets
        console.log('\n💰 [5D_BET_PLACEMENT] Simulating bet placement...');

        const testBets = [
            {
                userId: 'user_1',
                betType: 'POSITION',
                betValue: 'A_5',
                betAmount: 100,
                odds: 9.0
            },
            {
                userId: 'user_2',
                betType: 'POSITION_SIZE',
                betValue: 'B_big',
                betAmount: 50,
                odds: 2.0
            },
            {
                userId: 'user_3',
                betType: 'SUM',
                betValue: '15',
                betAmount: 75,
                odds: 2.0
            },
            {
                userId: 'user_1', // Same user, second bet
                betType: 'POSITION_PARITY',
                betValue: 'C_odd',
                betAmount: 25,
                odds: 2.0
            }
        ];

        // Place bets and track exposure
        for (let i = 0; i < testBets.length; i++) {
            const bet = testBets[i];
            console.log(`\n💰 [5D_BET_${i + 1}] Placing bet:`, bet);

            // Store bet in Redis
            const betId = `bet_${Date.now()}_${i}`;
            await redisClient.hset(betsKey, betId, JSON.stringify(bet));

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
        } else {
            console.log('❌ [5D_EXPOSURE] No exposure data found!');
        }

        // Step 3: Check user count
        console.log('\n👥 [5D_USER_COUNT] Checking user count...');
        const userCountResult = await gameLogicService.getUniqueUserCount(gameType, duration, periodId, timeline);
        
        console.log('👥 [5D_USER_COUNT_DETAILS]:', {
            uniqueUserCount: userCountResult.uniqueUserCount,
            totalBets: userCountResult.totalBets,
            threshold: userCountResult.threshold,
            meetsThreshold: userCountResult.meetsThreshold,
            uniqueUsers: userCountResult.uniqueUsers
        });

        const protectionMode = userCountResult.uniqueUserCount < userCountResult.threshold;
        console.log(`🛡️ [5D_PROTECTION_MODE] Protection active: ${protectionMode ? '✅ YES' : '❌ NO'}`);

        // Step 4: Simulate result selection
        console.log('\n🎯 [5D_RESULT_SELECTION] Simulating result selection...');
        
        if (protectionMode) {
            console.log('🛡️ [5D_PROTECTED_SELECTION] Using PROTECTED result selection...');
            
            const protectedResult = await gameLogicService.selectProtectedResultWithExposure(
                gameType, duration, periodId, timeline
            );
            
            if (protectedResult) {
                console.log('🛡️ [5D_PROTECTED_RESULT] Selected protected result:', protectedResult);
                
                // Check why this result was selected
                console.log('🛡️ [5D_PROTECTION_ANALYSIS] Protection analysis:');
                
                const unbetPositions = findUnbetPositions(finalExposure);
                console.log('🛡️ [5D_UNBET_POSITIONS] Unbet positions:', unbetPositions);
                
                for (const [pos, values] of Object.entries(unbetPositions)) {
                    if (values.length > 0) {
                        const resultValue = protectedResult[pos];
                        const usesUnbetPosition = values.includes(resultValue);
                        console.log(`   - Position ${pos}: Result ${resultValue}, Unbet values: [${values.join(', ')}], Uses unbet: ${usesUnbetPosition ? '✅ YES' : '❌ NO'}`);
                    }
                }
            }
        } else {
            console.log('📊 [5D_NORMAL_SELECTION] Using NORMAL 60/40 enforcement...');
            
            const resultWithVerification = await gameLogicService.calculateResultWithVerification(
                gameType, duration, periodId, timeline
            );
            
            if (resultWithVerification && resultWithVerification.result) {
                console.log('📊 [5D_NORMAL_RESULT] Selected normal result:', resultWithVerification.result);
                console.log('📊 [5D_SELECTION_REASON] Selection reason:', resultWithVerification.protectionReason);
                
                // Calculate exposure for selected result
                const selectedResult = resultWithVerification.result;
                const exposure = await gameLogicService.calculate5DExposure(selectedResult, finalExposure);
                const totalBetAmount = testBets.reduce((sum, bet) => sum + bet.betAmount, 0);
                
                const payoutPercent = totalBetAmount > 0 ? (exposure / totalBetAmount) * 100 : 0;
                
                console.log('📊 [5D_EXPOSURE_ANALYSIS] Result exposure analysis:');
                console.log(`   - Selected result: ${JSON.stringify(selectedResult)}`);
                console.log(`   - Result exposure: ₹${(exposure / 100).toFixed(2)}`);
                console.log(`   - Total bet amount: ₹${totalBetAmount.toFixed(2)}`);
                console.log(`   - Payout percentage: ${payoutPercent.toFixed(2)}%`);
                console.log(`   - Meets 60% limit: ${payoutPercent <= 60 ? '✅ YES' : '❌ NO'}`);
            }
        }

        console.log('\n🎲 [5D_TEST_WITH_BETS] ==========================================');
        console.log('🎲 [5D_TEST_WITH_BETS] 5D test with bets completed');
        console.log('🎲 [5D_TEST_WITH_BETS] ==========================================');

    } catch (error) {
        console.error('❌ [5D_TEST_WITH_BETS] Error in 5D test with bets:', error);
    }
}

// Helper function to find unbet positions
function findUnbetPositions(betExposures) {
    const positions = ['A', 'B', 'C', 'D', 'E'];
    const unbetPositions = {};

    for (const pos of positions) {
        const unbetValues = [];
        for (let num = 0; num <= 9; num++) {
            const betKey = `bet:POSITION:${pos}_${num}`;
            const exposure = parseFloat(betExposures[betKey] || 0);
            if (exposure === 0) {
                unbetValues.push(num);
            }
        }
        if (unbetValues.length > 0) {
            unbetPositions[pos] = unbetValues;
        }
    }

    return unbetPositions;
}

// Run the test
test5DWithBets().then(() => {
    console.log('✅ 5D test with bets completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ 5D test with bets failed:', error);
    process.exit(1);
}); 