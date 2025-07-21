let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }



const gameLogicService = require('./services/gameLogicService');

async function testRealScenario() {
    const client = 
    
    try {
        await client.connect();
        console.log('Connected to Redis');
        
        const periodId = 'TEST_REAL_' + Date.now();
        const gameType = '5d';
        const duration = 60;
        const timeline = 'default';
        
        const betHashKey = `bets:${gameType}:${duration}:${timeline}:${periodId}`;
        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
        
        console.log('Testing real scenario for period:', periodId);
        
        // Simulate the exact real scenario: bets on ALL A positions
        const realBets = [
            { userId: 1, betType: 'POSITION', betValue: 'A_0', netBetAmount: 100, odds: 2 },
            { userId: 1, betType: 'POSITION', betValue: 'A_1', netBetAmount: 100, odds: 2 },
            { userId: 1, betType: 'POSITION', betValue: 'A_2', netBetAmount: 100, odds: 2 },
            { userId: 1, betType: 'POSITION', betValue: 'A_3', netBetAmount: 100, odds: 2 },
            { userId: 1, betType: 'POSITION', betValue: 'A_4', netBetAmount: 100, odds: 2 },
            { userId: 1, betType: 'POSITION', betValue: 'A_5', netBetAmount: 100, odds: 2 },
            { userId: 1, betType: 'POSITION', betValue: 'A_6', netBetAmount: 100, odds: 2 },
            { userId: 1, betType: 'POSITION', betValue: 'A_7', netBetAmount: 100, odds: 2 },
            { userId: 1, betType: 'POSITION', betValue: 'A_8', netBetAmount: 100, odds: 2 },
            { userId: 1, betType: 'POSITION', betValue: 'A_9', netBetAmount: 100, odds: 2 }
        ];
        
        // Store bets and exposures
        for (let i = 0; i < realBets.length; i++) {
            await client.hset(betHashKey, `real_bet_${i}`, JSON.stringify(realBets[i]));
            
            // Add exposure for the bet
            const exposure = Math.round(realBets[i].netBetAmount * realBets[i].odds * 100);
            await client.hset(exposureKey, `bet:${realBets[i].betType}:${realBets[i].betValue}`, exposure);
        }
        
        await client.expire(betHashKey, 3600);
        await client.expire(exposureKey, 3600);
        
        console.log('Added bets on ALL A positions (A_0 through A_9)');
        
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

testRealScenario().catch(console.error); 
module.exports = { setRedisHelper };
