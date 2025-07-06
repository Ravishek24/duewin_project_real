const Redis = require('ioredis');
const gameLogicService = require('./services/gameLogicService');

// Redis client setup
const redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || null,
    db: process.env.REDIS_DB || 0
});

redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis client connected'));
redisClient.on('ready', () => console.log('Redis client ready'));

/**
 * Test script to verify the typo fix and protection logic
 */
async function testTypoFix() {
    try {
        console.log('🧪 [TYPO_FIX_TEST] ==========================================');
        console.log('🧪 [TYPO_FIX_TEST] Testing typo fix and protection logic');
        console.log('🧪 [TYPO_FIX_TEST] ==========================================');

        // Test parameters
        const testGameType = 'wingo';
        const testDuration = 30;
        const testTimeline = 'default';
        const testUserId = 13;
        const testBetAmount = 10;
        const testBetType = 'COLOR';
        const testBetValue = 'red';

        console.log('\n📝 [TYPO_FIX_TEST] Test Parameters:');
        console.log('📝 [TYPO_FIX_TEST] Game Type:', testGameType);
        console.log('📝 [TYPO_FIX_TEST] Duration:', testDuration);
        console.log('📝 [TYPO_FIX_TEST] Timeline:', testTimeline);
        console.log('📝 [TYPO_FIX_TEST] User ID:', testUserId);
        console.log('📝 [TYPO_FIX_TEST] Bet Amount:', testBetAmount);
        console.log('📝 [TYPO_FIX_TEST] Bet Type:', testBetType);
        console.log('📝 [TYPO_FIX_TEST] Bet Value:', testBetValue);

        // Step 1: Test combinations initialization
        console.log('\n🎯 [TYPO_FIX_TEST] Step 1: Testing combinations initialization...');
        
        // Force re-initialization to test the fix
        delete global.wingoCombinations;
        delete global.wingoCombinatons; // Remove old typo version if it exists
        
        await gameLogicService.initializeGameCombinations();
        
        console.log('🎯 [TYPO_FIX_TEST] Global combinations after initialization:');
        console.log('🎯 [TYPO_FIX_TEST] global.wingoCombinations exists:', !!global.wingoCombinations);
        console.log('🎯 [TYPO_FIX_TEST] global.wingoCombinatons exists (old typo):', !!global.wingoCombinatons);
        
        if (global.wingoCombinations) {
            console.log('🎯 [TYPO_FIX_TEST] Wingo combinations count:', Object.keys(global.wingoCombinations).length);
            console.log('🎯 [TYPO_FIX_TEST] Sample combination (number 0):', global.wingoCombinations[0]);
        }

        // Step 2: Create a test period
        console.log('\n🎯 [TYPO_FIX_TEST] Step 2: Creating test period...');
        
        const now = new Date();
        const testPeriodId = `test_period_${Date.now()}`;
        
        console.log('🎯 [TYPO_FIX_TEST] Test period ID:', testPeriodId);

        // Step 3: Place a test bet
        console.log('\n🎯 [TYPO_FIX_TEST] Step 3: Placing test bet...');
        
        const betData = {
            userId: testUserId,
            gameType: testGameType,
            duration: testDuration,
            timeline: testTimeline,
            periodId: testPeriodId,
            betType: testBetType,
            betValue: testBetValue,
            betAmount: testBetAmount
        };
        
        const betResult = await gameLogicService.processBet(betData);
        console.log('🎯 [TYPO_FIX_TEST] Bet result:', JSON.stringify(betResult, null, 2));

        // Step 4: Test user count
        console.log('\n🎯 [TYPO_FIX_TEST] Step 4: Testing user count...');
        
        const userCount = await gameLogicService.getUniqueUserCount(testGameType, testDuration, testPeriodId, testTimeline);
        console.log('🎯 [TYPO_FIX_TEST] User count result:', userCount);
        
        const shouldUseProtectedResult = userCount < 100;
        console.log('🎯 [TYPO_FIX_TEST] Should use protected result:', shouldUseProtectedResult);
        console.log('🎯 [TYPO_FIX_TEST] Threshold:', 100);

        // Step 5: Test protection logic directly
        console.log('\n🎯 [TYPO_FIX_TEST] Step 5: Testing protection logic directly...');
        
        const protectedResult = await gameLogicService.selectProtectedResultWithExposure(testGameType, testDuration, testPeriodId, testTimeline);
        console.log('🎯 [TYPO_FIX_TEST] Protected result:', protectedResult);
        
        // Verify the result structure
        if (protectedResult) {
            console.log('🎯 [TYPO_FIX_TEST] Protected result structure:');
            console.log('🎯 [TYPO_FIX_TEST]   - Number:', protectedResult.number);
            console.log('🎯 [TYPO_FIX_TEST]   - Color:', protectedResult.color);
            console.log('🎯 [TYPO_FIX_TEST]   - Size:', protectedResult.size);
            console.log('🎯 [TYPO_FIX_TEST]   - Parity:', protectedResult.parity);
            console.log('🎯 [TYPO_FIX_TEST]   - Winning conditions:', protectedResult.winning_conditions);
            
            // Check if this is a losing result for the user
            const userBetOnRed = testBetValue === 'red';
            const resultIsRed = ['red', 'red_violet'].includes(protectedResult.color);
            const userWins = userBetOnRed === resultIsRed;
            
            console.log('🎯 [TYPO_FIX_TEST] User bet on red:', userBetOnRed);
            console.log('🎯 [TYPO_FIX_TEST] Result is red:', resultIsRed);
            console.log('🎯 [TYPO_FIX_TEST] User would win:', userWins);
            
            if (!userWins) {
                console.log('✅ [TYPO_FIX_TEST] SUCCESS: Protection selected a losing result');
            } else {
                console.log('❌ [TYPO_FIX_TEST] FAILURE: Protection selected a winning result');
            }
        } else {
            console.log('❌ [TYPO_FIX_TEST] FAILURE: No protected result returned');
        }

        // Step 6: Test result calculation
        console.log('\n🎯 [TYPO_FIX_TEST] Step 6: Testing result calculation...');
        
        const resultWithVerification = await gameLogicService.calculateResultWithVerification(testGameType, testDuration, testPeriodId, testTimeline);
        console.log('🎯 [TYPO_FIX_TEST] Result with verification:', {
            result: resultWithVerification.result,
            protectionMode: resultWithVerification.protectionMode,
            protectionReason: resultWithVerification.protectionReason,
            success: resultWithVerification.success
        });

        // Step 7: Test full result processing
        console.log('\n🎯 [TYPO_FIX_TEST] Step 7: Testing full result processing...');
        
        const processResult = await gameLogicService.processGameResults(testGameType, testDuration, testPeriodId, testTimeline);
        console.log('🎯 [TYPO_FIX_TEST] Process result:', {
            success: processResult.success,
            source: processResult.source,
            protectionMode: processResult.protectionMode,
            protectionReason: processResult.protectionReason,
            gameResult: processResult.gameResult,
            winnerCount: processResult.winners ? processResult.winners.length : 0
        });

        // Step 8: Final verification
        console.log('\n🎯 [TYPO_FIX_TEST] Step 8: Final verification...');
        
        console.log('🎯 [TYPO_FIX_TEST] Protection should be active:', shouldUseProtectedResult);
        console.log('🎯 [TYPO_FIX_TEST] Protection was active:', resultWithVerification.protectionMode);
        
        if (processResult.success && processResult.winners) {
            const userWon = processResult.winners.some(winner => winner.userId === testUserId);
            console.log('🎯 [TYPO_FIX_TEST] User actually won:', userWon);
            
            if (shouldUseProtectedResult && !userWon) {
                console.log('✅ [TYPO_FIX_TEST] SUCCESS: User lost as expected with protection active');
            } else if (shouldUseProtectedResult && userWon) {
                console.log('❌ [TYPO_FIX_TEST] FAILURE: User won despite protection being active');
            } else if (!shouldUseProtectedResult) {
                console.log('ℹ️ [TYPO_FIX_TEST] INFO: Protection not needed (multiple users)');
            }
        } else {
            console.log('ℹ️ [TYPO_FIX_TEST] INFO: No winners processed');
        }

        // Step 9: Test combinations access
        console.log('\n🎯 [TYPO_FIX_TEST] Step 9: Testing combinations access...');
        
        console.log('🎯 [TYPO_FIX_TEST] Global combinations after all tests:');
        console.log('🎯 [TYPO_FIX_TEST] global.wingoCombinations exists:', !!global.wingoCombinations);
        console.log('🎯 [TYPO_FIX_TEST] global.wingoCombinatons exists (old typo):', !!global.wingoCombinatons);
        
        if (global.wingoCombinations) {
            console.log('🎯 [TYPO_FIX_TEST] All wingo combinations available:', Object.keys(global.wingoCombinations).map(n => parseInt(n)).sort((a, b) => a - b));
        }

        console.log('\n✅ [TYPO_FIX_TEST] ==========================================');
        console.log('✅ [TYPO_FIX_TEST] Typo fix test completed successfully');
        console.log('✅ [TYPO_FIX_TEST] ==========================================');

    } catch (error) {
        console.error('❌ [TYPO_FIX_TEST] Error in typo fix test:', error);
    } finally {
        await redisClient.quit();
        console.log('🔌 Redis connection closed');
    }
}

// Run the test
testTypoFix(); 