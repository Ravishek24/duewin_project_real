const redis = require('redis');
const gameLogicService = require('./services/gameLogicService');

async function testCurrentScenario() {
    const client = redis.createClient();
    
    try {
        await client.connect();
        console.log('Connected to Redis');
        
        const periodId = 'TEST_CURRENT_' + Date.now();
        const gameType = 'fiveD';
        const duration = 60;
        const timeline = 'default';
        
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
        
        console.log('Testing current scenario for period:', periodId);
        console.log('Scenario: A_0 has zero exposure, A_1 through A_9 have bets');
        
        // Simulate the exact current scenario: bets on A_1 through A_9, A_0 has zero exposure
        const currentBets = [
            { userId: 13, betType: 'POSITION', betValue: 'A_1', netBetAmount: 98, odds: 2 },
            { userId: 13, betType: 'POSITION', betValue: 'A_2', netBetAmount: 98, odds: 2 },
            { userId: 13, betType: 'POSITION', betValue: 'A_3', netBetAmount: 98, odds: 2 },
            { userId: 13, betType: 'POSITION', betValue: 'A_4', netBetAmount: 98, odds: 2 },
            { userId: 13, betType: 'POSITION', betValue: 'A_5', netBetAmount: 98, odds: 2 },
            { userId: 13, betType: 'POSITION', betValue: 'A_6', netBetAmount: 98, odds: 2 },
            { userId: 13, betType: 'POSITION', betValue: 'A_7', netBetAmount: 98, odds: 2 },
            { userId: 13, betType: 'POSITION', betValue: 'A_8', netBetAmount: 98, odds: 2 },
            { userId: 13, betType: 'POSITION', betValue: 'A_9', netBetAmount: 98, odds: 2 }
        ];
        
        // Store bets and exposures
        for (let i = 0; i < currentBets.length; i++) {
            await client.hSet(betHashKey, `test_bet_${i}`, JSON.stringify(currentBets[i]));
            
            // Add exposure for the bet
            const exposure = Math.round(currentBets[i].netBetAmount * currentBets[i].odds * 100);
            await client.hSet(exposureKey, `bet:${currentBets[i].betType}:${currentBets[i].betValue}`, exposure);
        }
        
        await client.expire(betHashKey, 3600);
        await client.expire(exposureKey, 3600);
        
        console.log('✅ Added bets on A_1 through A_9 (A_0 has zero exposure)');
        
        // Check user count
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
                
                // Check which A position won
                const winningAPosition = protectedResult.A;
                console.log(`🎯 Result A=${winningAPosition}, which means A_${winningAPosition} won`);
                
                // Check if A_0 (zero exposure) won
                if (winningAPosition === 0) {
                    console.log('✅ Protection correctly selected A_0 (zero exposure position)');
                } else {
                    console.log(`❌ Protection selected A=${winningAPosition}, expected A=0 for zero exposure`);
                }
                
                // Verify that only one A position wins
                let winningCount = 0;
                for (let i = 0; i <= 9; i++) {
                    const wins = gameLogicService.checkFiveDWin('POSITION', `A_${i}`, protectedResult);
                    if (wins) {
                        winningCount++;
                        console.log(`✅ A_${i} wins`);
                    } else {
                        console.log(`❌ A_${i} loses`);
                    }
                }
                
                console.log(`📊 Total winning A positions: ${winningCount}`);
                
                if (winningCount === 1) {
                    console.log('✅ Protection working correctly - only one A position wins');
                } else {
                    console.log('❌ Protection failed - multiple A positions win');
                }
            } else {
                console.log('❌ Protection returned null result');
            }
        } else {
            console.log('ℹ️ Protection not needed - multiple users');
        }
        
        // Cleanup
        await client.del(betHashKey);
        await client.del(exposureKey);
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await client.quit();
    }
}

testCurrentScenario().catch(console.error); 