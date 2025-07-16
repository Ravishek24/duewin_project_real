const { redisClient } = require('./config/redis');
const gameLogicService = require('./services/gameLogicService');

async function testSizeProtectionFix() {
    console.log('🛡️ [SIZE_PROTECTION_TEST] Testing SIZE bet protection fix');
    console.log('==========================================\n');

    const testConfig = {
        gameType: 'wingo',
        duration: 30,
        periodId: `test_size_protection_${Date.now()}`,
        timeline: 'default',
        userId: 26
    };

    try {
        // Step 1: Initialize game combinations
        console.log('1️⃣ Initializing game combinations...');
        await gameLogicService.initializeGameCombinations();
        console.log('✅ Game combinations initialized\n');

        // Step 2: Create a SIZE:big bet
        console.log('2️⃣ Creating SIZE:big bet...');
        const testBet = {
            id: 'test_bet_001',
            userId: testConfig.userId,
            betType: 'SIZE',
            betValue: 'big',
            betAmount: 100,
            netBetAmount: 98,
            odds: 2.0,
            timestamp: Date.now()
        };

        const betHashKey = `bets:${testConfig.gameType}:${testConfig.duration}:${testConfig.timeline}:${testConfig.periodId}`;
        const exposureKey = `exposure:${testConfig.gameType}:${testConfig.duration}:${testConfig.timeline}:${testConfig.periodId}`;
        const userCountKey = `unique_users:${testConfig.gameType}:${testConfig.duration}:${testConfig.timeline}:${testConfig.periodId}`;

        // Store bet
        await redisClient.hset(betHashKey, testBet.id, JSON.stringify(testBet));
        console.log('✅ Bet stored in Redis\n');

        // Step 3: Update exposure for SIZE:big bet
        console.log('3️⃣ Updating exposure for SIZE:big bet...');
        // SIZE:big covers numbers 5,6,7,8,9 with 2.0x odds
        const exposurePerNumber = Math.round(testBet.netBetAmount * 2.0 * 100); // Convert to cents
        await redisClient.hincrby(exposureKey, 'number:5', exposurePerNumber);
        await redisClient.hincrby(exposureKey, 'number:6', exposurePerNumber);
        await redisClient.hincrby(exposureKey, 'number:7', exposurePerNumber);
        await redisClient.hincrby(exposureKey, 'number:8', exposurePerNumber);
        await redisClient.hincrby(exposureKey, 'number:9', exposurePerNumber);
        console.log(`✅ Exposure updated: ${exposurePerNumber} cents per Big number (5-9)\n`);

        // Step 4: Set single user (trigger protection)
        console.log('4️⃣ Setting single user to trigger protection...');
        await redisClient.sadd(userCountKey, testConfig.userId);
        console.log('✅ Single user set (protection should activate)\n');

        // Step 5: Test protection logic manually
        console.log('5️⃣ Testing protection logic manually...');
        const betsData = await redisClient.hgetall(betHashKey);
        const userBetOutcomes = new Set();

        // Collect all outcomes the user bet on (using the FIXED logic)
        for (const [betId, betJson] of Object.entries(betsData)) {
            try {
                const bet = JSON.parse(betJson);
                console.log(`🔍 Processing bet: ${bet.betType}:${bet.betValue}`);
                
                if (bet.betType === 'COLOR' && bet.betValue === 'red') {
                    userBetOutcomes.add(0); userBetOutcomes.add(2); 
                    userBetOutcomes.add(4); userBetOutcomes.add(6); 
                    userBetOutcomes.add(8);
                    console.log('   → Added red numbers: [0,2,4,6,8]');
                } else if (bet.betType === 'COLOR' && bet.betValue === 'green') {
                    userBetOutcomes.add(1); userBetOutcomes.add(3); 
                    userBetOutcomes.add(5); userBetOutcomes.add(7); 
                    userBetOutcomes.add(9);
                    console.log('   → Added green numbers: [1,3,5,7,9]');
                } else if (bet.betType === 'NUMBER') {
                    userBetOutcomes.add(parseInt(bet.betValue));
                    console.log(`   → Added number: ${bet.betValue}`);
                } else if (bet.betType === 'SIZE' && bet.betValue === 'big') {
                    userBetOutcomes.add(5); userBetOutcomes.add(6); 
                    userBetOutcomes.add(7); userBetOutcomes.add(8); 
                    userBetOutcomes.add(9);
                    console.log('   → Added big numbers: [5,6,7,8,9]');
                } else if (bet.betType === 'SIZE' && bet.betValue === 'small') {
                    userBetOutcomes.add(0); userBetOutcomes.add(1); 
                    userBetOutcomes.add(2); userBetOutcomes.add(3); 
                    userBetOutcomes.add(4);
                    console.log('   → Added small numbers: [0,1,2,3,4]');
                } else if (bet.betType === 'PARITY' && bet.betValue === 'odd') {
                    userBetOutcomes.add(1); userBetOutcomes.add(3); 
                    userBetOutcomes.add(5); userBetOutcomes.add(7); 
                    userBetOutcomes.add(9);
                    console.log('   → Added odd numbers: [1,3,5,7,9]');
                } else if (bet.betType === 'PARITY' && bet.betValue === 'even') {
                    userBetOutcomes.add(0); userBetOutcomes.add(2); 
                    userBetOutcomes.add(4); userBetOutcomes.add(6); 
                    userBetOutcomes.add(8);
                    console.log('   → Added even numbers: [0,2,4,6,8]');
                }
            } catch (parseError) {
                console.error('❌ Error parsing bet:', parseError);
                continue;
            }
        }

        const userBetNumbers = Array.from(userBetOutcomes).sort((a, b) => a - b);
        console.log(`📋 User bet on numbers: [${userBetNumbers.join(', ')}]\n`);

        // Step 6: Find losing numbers
        console.log('6️⃣ Finding losing numbers...');
        const losingNumbers = [];
        for (let num = 0; num <= 9; num++) {
            if (!userBetOutcomes.has(num)) {
                losingNumbers.push(num);
            }
        }
        console.log(`❌ Losing numbers (user did NOT bet on): [${losingNumbers.join(', ')}]\n`);

        // Step 7: Test the actual protection function
        console.log('7️⃣ Testing actual selectProtectedResultWithExposure function...');
        const protectedResult = await gameLogicService.selectProtectedResultWithExposure(
            testConfig.gameType,
            testConfig.duration,
            testConfig.periodId,
            testConfig.timeline
        );
        console.log('🎯 Protected result:', protectedResult);

        // Step 8: Check if result is a losing number
        const resultNumber = protectedResult.number;
        const isLosingNumber = losingNumbers.includes(resultNumber);
        const isBigNumber = resultNumber >= 5;
        const userWins = isBigNumber; // User bet on Big

        console.log('\n🎯 [FINAL_ANALYSIS]');
        console.log(`   Result number: ${resultNumber}`);
        console.log(`   Is Big number: ${isBigNumber}`);
        console.log(`   Is losing number: ${isLosingNumber}`);
        console.log(`   User bet on: SIZE:big`);
        console.log(`   User would win: ${userWins}`);
        console.log(`   Protection working: ${!userWins}`);

        if (!userWins) {
            console.log('✅ [SUCCESS] Protection correctly selected a losing result!');
        } else {
            console.log('❌ [FAILURE] Protection failed - user would win!');
        }

        // Step 9: Test full result calculation
        console.log('\n8️⃣ Testing full result calculation...');
        const resultWithVerification = await gameLogicService.calculateResultWithVerification(
            testConfig.gameType,
            testConfig.duration,
            testConfig.periodId,
            testConfig.timeline
        );
        console.log('🎲 Full result calculation:', {
            result: resultWithVerification.result,
            protectionMode: resultWithVerification.protectionMode,
            protectionReason: resultWithVerification.protectionReason
        });

        const finalResultNumber = resultWithVerification.result.number;
        const finalIsBig = finalResultNumber >= 5;
        const finalUserWins = finalIsBig;

        console.log('\n🎯 [FINAL_RESULT_ANALYSIS]');
        console.log(`   Final result number: ${finalResultNumber}`);
        console.log(`   Final result is Big: ${finalIsBig}`);
        console.log(`   User would win: ${finalUserWins}`);
        console.log(`   Protection working: ${!finalUserWins}`);

        if (!finalUserWins) {
            console.log('✅ [SUCCESS] Full protection system working correctly!');
        } else {
            console.log('❌ [FAILURE] Full protection system failed!');
        }

    } catch (error) {
        console.error('❌ [SIZE_PROTECTION_TEST] Error:', error);
    } finally {
        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        await redisClient.del(betHashKey);
        await redisClient.del(exposureKey);
        await redisClient.del(userCountKey);
        console.log('✅ Test data cleaned up');
        
        await redisClient.quit();
    }
}

// Run the test
testSizeProtectionFix().catch(console.error); 