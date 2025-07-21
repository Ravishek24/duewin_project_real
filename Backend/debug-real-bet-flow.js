let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }



const gameLogicService = require('./services/gameLogicService');

// Redis client setup
const redisClient = 

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis client connected'));
redisClient.on('ready', () => console.log('Redis client ready'));

/**
 * Debug script to track real bet flow from placement to result generation
 */
async function debugRealBetFlow() {
    try {
        console.log('🔍 [REAL_BET_DEBUG] ==========================================');
        console.log('🔍 [REAL_BET_DEBUG] Starting real bet flow debugging');
        console.log('🔍 [REAL_BET_DEBUG] ==========================================');

        // Test parameters
        const testGameType = 'wingo';
        const testDuration = 30;
        const testTimeline = 'default';
        const testUserId = 13;
        const testBetAmount = 10;
        const testBetType = 'COLOR';
        const testBetValue = 'red';

        console.log('\n📝 [REAL_BET_DEBUG] Test Parameters:');
        console.log('📝 [REAL_BET_DEBUG] Game Type:', testGameType);
        console.log('📝 [REAL_BET_DEBUG] Duration:', testDuration);
        console.log('📝 [REAL_BET_DEBUG] Timeline:', testTimeline);
        console.log('📝 [REAL_BET_DEBUG] User ID:', testUserId);
        console.log('📝 [REAL_BET_DEBUG] Bet Amount:', testBetAmount);
        console.log('📝 [REAL_BET_DEBUG] Bet Type:', testBetType);
        console.log('📝 [REAL_BET_DEBUG] Bet Value:', testBetValue);

        // Step 1: Get current active period
        console.log('\n🎯 [REAL_BET_DEBUG] Step 1: Getting current active period...');
        
        const now = new Date();
        const currentPeriodId = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}000000000`;
        
        console.log('🎯 [REAL_BET_DEBUG] Current period ID:', currentPeriodId);

        // Step 2: Check if bets exist in Redis before placing bet
        console.log('\n🎯 [REAL_BET_DEBUG] Step 2: Checking existing bets in Redis...');
        
        const betHashKey = `bets:${testGameType}:${testDuration}:${testTimeline}:${currentPeriodId}`;
        const exposureKey = `exposure:${testGameType}:${testDuration}:${currentPeriodId}`;
        
        console.log('🎯 [REAL_BET_DEBUG] Bet hash key:', betHashKey);
        console.log('🎯 [REAL_BET_DEBUG] Exposure key:', exposureKey);
        
        let existingBets = await redisClient.hgetall(betHashKey);
        let existingExposure = await redisClient.hgetall(exposureKey);
        
        console.log('🎯 [REAL_BET_DEBUG] Existing bets count:', Object.keys(existingBets).length);
        console.log('🎯 [REAL_BET_DEBUG] Existing exposure count:', Object.keys(existingExposure).length);
        
        if (Object.keys(existingBets).length > 0) {
            console.log('🎯 [REAL_BET_DEBUG] Existing bets found:');
            for (const [betId, betJson] of Object.entries(existingBets)) {
                try {
                    const bet = JSON.parse(betJson);
                    console.log('🎯 [REAL_BET_DEBUG]   - User:', bet.userId, 'Bet:', bet.betType, bet.betValue, 'Amount:', bet.netBetAmount);
                } catch (e) {
                    console.log('🎯 [REAL_BET_DEBUG]   - Invalid bet data:', betJson);
                }
            }
        }

        // Step 3: Place a test bet
        console.log('\n🎯 [REAL_BET_DEBUG] Step 3: Placing test bet...');
        
        const betData = {
            userId: testUserId,
            gameType: testGameType,
            duration: testDuration,
            timeline: testTimeline,
            periodId: currentPeriodId,
            betType: testBetType,
            betValue: testBetValue,
            betAmount: testBetAmount
        };
        
        console.log('🎯 [REAL_BET_DEBUG] Bet data:', JSON.stringify(betData, null, 2));
        
        const betResult = await gameLogicService.processBet(betData);
        console.log('🎯 [REAL_BET_DEBUG] Bet result:', JSON.stringify(betResult, null, 2));

        // Step 4: Check Redis after bet placement
        console.log('\n🎯 [REAL_BET_DEBUG] Step 4: Checking Redis after bet placement...');
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        
        existingBets = await redisClient.hgetall(betHashKey);
        existingExposure = await redisClient.hgetall(exposureKey);
        
        console.log('🎯 [REAL_BET_DEBUG] Bets after placement:', Object.keys(existingBets).length);
        console.log('🎯 [REAL_BET_DEBUG] Exposure after placement:', Object.keys(existingExposure).length);
        
        if (Object.keys(existingBets).length > 0) {
            console.log('🎯 [REAL_BET_DEBUG] Bets in Redis:');
            for (const [betId, betJson] of Object.entries(existingBets)) {
                try {
                    const bet = JSON.parse(betJson);
                    console.log('🎯 [REAL_BET_DEBUG]   - User:', bet.userId, 'Bet:', bet.betType, bet.betValue, 'Amount:', bet.netBetAmount);
                } catch (e) {
                    console.log('🎯 [REAL_BET_DEBUG]   - Invalid bet data:', betJson);
                }
            }
        }

        // Step 5: Test user count function directly
        console.log('\n🎯 [REAL_BET_DEBUG] Step 5: Testing user count function...');
        
        const userCount = await gameLogicService.getUniqueUserCount(testGameType, testDuration, currentPeriodId, testTimeline);
        console.log('🎯 [REAL_BET_DEBUG] User count result:', userCount);
        
        const shouldUseProtectedResult = userCount < 100;
        console.log('🎯 [REAL_BET_DEBUG] Should use protected result:', shouldUseProtectedResult);
        console.log('🎯 [REAL_BET_DEBUG] Threshold:', 100);

        // Step 6: Test protection logic directly
        console.log('\n🎯 [REAL_BET_DEBUG] Step 6: Testing protection logic directly...');
        
        const protectedResult = await gameLogicService.selectProtectedResultWithExposure(testGameType, testDuration, currentPeriodId, testTimeline);
        console.log('🎯 [REAL_BET_DEBUG] Protected result:', protectedResult);

        // Step 7: Test result calculation directly
        console.log('\n🎯 [REAL_BET_DEBUG] Step 7: Testing result calculation directly...');
        
        const resultWithVerification = await gameLogicService.calculateResultWithVerification(testGameType, testDuration, currentPeriodId, testTimeline);
        console.log('🎯 [REAL_BET_DEBUG] Result with verification:', {
            result: resultWithVerification.result,
            protectionMode: resultWithVerification.protectionMode,
            protectionReason: resultWithVerification.protectionReason,
            success: resultWithVerification.success
        });

        // Step 8: Test full result processing
        console.log('\n🎯 [REAL_BET_DEBUG] Step 8: Testing full result processing...');
        
        const processResult = await gameLogicService.processGameResults(testGameType, testDuration, currentPeriodId, testTimeline);
        console.log('🎯 [REAL_BET_DEBUG] Process result:', {
            success: processResult.success,
            source: processResult.source,
            protectionMode: processResult.protectionMode,
            protectionReason: processResult.protectionReason,
            gameResult: processResult.gameResult,
            winnerCount: processResult.winners ? processResult.winners.length : 0
        });

        // Step 9: Check if user won
        console.log('\n🎯 [REAL_BET_DEBUG] Step 9: Checking if user won...');
        
        if (processResult.success && processResult.winners) {
            const userWon = processResult.winners.some(winner => winner.userId === testUserId);
            console.log('🎯 [REAL_BET_DEBUG] User won:', userWon);
            
            if (userWon) {
                const userWinner = processResult.winners.find(winner => winner.userId === testUserId);
                console.log('🎯 [REAL_BET_DEBUG] User winnings:', userWinner.winnings);
                console.log('🎯 [REAL_BET_DEBUG] User bet details:', userWinner);
            }
            
            console.log('🎯 [REAL_BET_DEBUG] All winners:', processResult.winners.map(w => ({ userId: w.userId, winnings: w.winnings })));
        }

        // Step 10: Final verification
        console.log('\n🎯 [REAL_BET_DEBUG] Step 10: Final verification...');
        
        console.log('🎯 [REAL_BET_DEBUG] Protection should be active:', shouldUseProtectedResult);
        console.log('🎯 [REAL_BET_DEBUG] Protection was active:', resultWithVerification.protectionMode);
        console.log('🎯 [REAL_BET_DEBUG] User should lose:', shouldUseProtectedResult);
        
        if (processResult.success && processResult.winners) {
            const userWon = processResult.winners.some(winner => winner.userId === testUserId);
            console.log('🎯 [REAL_BET_DEBUG] User actually won:', userWon);
            
            if (shouldUseProtectedResult && userWon) {
                console.log('❌ [REAL_BET_DEBUG] ISSUE FOUND: User won despite protection being active!');
            } else if (shouldUseProtectedResult && !userWon) {
                console.log('✅ [REAL_BET_DEBUG] SUCCESS: User lost as expected with protection active');
            } else if (!shouldUseProtectedResult) {
                console.log('ℹ️ [REAL_BET_DEBUG] INFO: Protection not needed (multiple users)');
            }
        }

        console.log('\n🔍 [REAL_BET_DEBUG] ==========================================');
        console.log('🔍 [REAL_BET_DEBUG] Real bet flow debugging completed');
        console.log('🔍 [REAL_BET_DEBUG] ==========================================');

    } catch (error) {
        console.error('❌ [REAL_BET_DEBUG] Error in real bet flow debugging:', error);
    } finally {
        await redisClient.quit();
        console.log('🔌 Redis connection closed');
    }
}

// Run the debug
debugRealBetFlow(); 
module.exports = { setRedisHelper };
