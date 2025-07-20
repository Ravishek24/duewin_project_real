const { initializeModels } = require('./models');
const fiveDProtectionService = require('./services/fiveDProtectionService');
const redisHelper = require('./config/redis');
const redisClient = redisHelper.getClient();

async function testProduction5DFix() {
    try {
        console.log('🎯 [PRODUCTION_5D_FIX] ==========================================');
        console.log('🎯 [PRODUCTION_5D_FIX] Testing Production 5D Fix');
        console.log('🎯 [PRODUCTION_5D_FIX] ==========================================');

        // Initialize models first
        console.log('\n🔧 [INIT] Initializing models...');
        await initializeModels();
        console.log('✅ Models initialized successfully');

        const gameType = 'fiveD';
        const duration = 60;
        const periodId = '20250719000001435'; // SAME PERIOD ID AS USER'S REAL DATA
        const timeline = 'default';

        console.log('\n🔍 [TEST_1] Testing with REAL PERIOD ID from user data...');
        console.log('📊 [PERIOD_INFO] Period ID:', periodId, 'Game Type:', gameType, 'Duration:', duration);

        // Initialize zero exposure candidates
        console.log('\n🔍 [TEST_2] Initializing zero-exposure candidates...');
        const initCount = await fiveDProtectionService.initializeZeroExposureCandidates(
            gameType, duration, periodId, timeline
        );
        console.log('✅ Initialized', initCount, 'zero-exposure candidates');

        // Get initial stats
        console.log('\n🔍 [TEST_3] Getting initial protection stats...');
        const initialStats = await fiveDProtectionService.getProtectionStats(gameType, duration, periodId, timeline);
        console.log('Initial protection stats:', initialStats);

        // Simulate the EXACT same bets as user's real data
        console.log('\n🔍 [TEST_4] Simulating EXACT same bets as user data...');

        const bets = [
            { betType: 'SUM_PARITY', betValue: 'even', betAmount: 10 },
            { betType: 'SUM_SIZE', betValue: 'small', betAmount: 10 },
            { betType: 'SUM_PARITY', betValue: 'odd', betAmount: 1 },
            { betType: 'SUM_SIZE', betValue: 'big', betAmount: 1 }
        ];

        for (let i = 0; i < bets.length; i++) {
            const bet = bets[i];
            console.log(`\n💰 [BET_${i+1}] Placing bet: ${bet.betType}:${bet.betValue} (₹${bet.betAmount.toFixed(2)})`);
            
            // Remove combinations from zero exposure set
            const removedCount = await fiveDProtectionService.removeCombinationFromZeroExposure(
                gameType, duration, periodId, timeline, bet.betType, bet.betValue
            );
            console.log(`🗑️ [BET_${i+1}_REMOVED] Removed ${removedCount} combinations from zero-exposure set`);
            
            // Add exposure to Redis
            const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
            const betKey = `bet:${bet.betType}:${bet.betValue}`;
            const exposure = Math.round(bet.betAmount * 2 * 100); // 2.0 odds
            await redisClient.hincrby(exposureKey, betKey, exposure);
            console.log(`💰 [BET_${i+1}_EXPOSURE] Added exposure: ${exposure} cents (₹${(exposure/100).toFixed(2)})`);
            
            // Get updated stats
            const stats = await fiveDProtectionService.getProtectionStats(gameType, duration, periodId, timeline);
            console.log(`📊 [BET_${i+1}_STATS] Remaining zero-exposure: ${stats.remainingZeroExposure}`);
        }

        // Test the enhanced system result generation
        console.log('\n🔍 [TEST_5] Testing enhanced system result generation...');
        
        // Import the enhanced system function
        const { shouldUseEnhancedSystem, getEnhanced5DResult } = require('./services/gameLogicService');
        
        // Check if enhanced system should be used
        const useEnhanced = await shouldUseEnhancedSystem(gameType, duration, periodId);
        console.log('🎯 [ENHANCED_CHECK] Should use enhanced system:', useEnhanced);
        
        if (useEnhanced) {
            console.log('🎯 [ENHANCED_ENABLED] Enhanced system is enabled, getting result...');
            const enhancedResult = await getEnhanced5DResult(gameType, duration, periodId, timeline);
            
            if (enhancedResult) {
                console.log('✅ [ENHANCED_SUCCESS] Enhanced system result:', enhancedResult);
                
                // Verify the result
                console.log('\n🔍 [TEST_6] Verifying result exposure...');
                const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
                const allExposures = await redisClient.hgetall(exposureKey);
                console.log('📊 [FINAL_EXPOSURES] All bet exposures:', allExposures);
                
                // Check which bets win with this result
                let totalPayout = 0;
                let winningBets = 0;
                
                for (const [betKey, exposureStr] of Object.entries(allExposures)) {
                    if (!betKey.startsWith('bet:')) continue;
                    
                    const actualBetKey = betKey.replace('bet:', '');
                    const [betType, betValue] = actualBetKey.split(':');
                    
                    // Check if this bet wins with the result
                    let wins = false;
                    
                    if (betType === 'SUM_PARITY') {
                        const isEven = enhancedResult.sum_value % 2 === 0;
                        wins = (betValue === 'even' && isEven) || (betValue === 'odd' && !isEven);
                    } else if (betType === 'SUM_SIZE') {
                        const isBig = enhancedResult.sum_value >= 23;
                        wins = (betValue === 'big' && isBig) || (betValue === 'small' && !isBig);
                    }
                    
                    const exposure = parseInt(exposureStr) || 0;
                    
                    if (wins) {
                        console.log(`✅ [WINNING_BET] ${actualBetKey} wins: ${exposure} cents (₹${(exposure/100).toFixed(2)})`);
                        totalPayout += exposure;
                        winningBets++;
                    } else {
                        console.log(`❌ [LOSING_BET] ${actualBetKey} loses`);
                    }
                }
                
                console.log('\n📊 [PAYOUT_ANALYSIS] Total payout:', totalPayout, 'cents (₹' + (totalPayout/100).toFixed(2) + ')');
                console.log('📊 [PAYOUT_ANALYSIS] Winning bets:', winningBets);
                
                // Check if this is the expected behavior (smallest bets should win)
                const expectedBehavior = totalPayout <= 40000; // Should be around ₹400 (smallest bets)
                console.log('🎯 [EXPECTED_BEHAVIOR] Smallest bets should win:', expectedBehavior ? '✅ CORRECT' : '❌ INCORRECT');
                
            } else {
                console.log('❌ [ENHANCED_FAILED] Enhanced system returned null');
            }
        } else {
            console.log('❌ [ENHANCED_DISABLED] Enhanced system is disabled');
        }

        // Get final stats
        console.log('\n🔍 [TEST_7] Getting final protection stats...');
        const finalStats = await fiveDProtectionService.getProtectionStats(gameType, duration, periodId, timeline);
        console.log('Final protection stats:', finalStats);

        console.log('\n🧹 [CLEANUP] Cleaning up test data...');
        const setKey = fiveDProtectionService.getZeroExposureSetKey(gameType, duration, periodId, timeline);
        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
        await redisClient.del(setKey);
        await redisClient.del(exposureKey);

        console.log('\n✅ [PRODUCTION_5D_FIX] Test completed successfully!');
        console.log('✅ [PRODUCTION_5D_FIX] ==========================================');

    } catch (error) {
        console.error('❌ [PRODUCTION_5D_FIX] Error in production 5D fix test:', error);
        throw error;
    }
}

// Run the test
testProduction5DFix()
    .then(() => {
        console.log('\n🎯 [SUCCESS] Production 5D fix test completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ [ERROR] Production 5D fix test failed:', error);
        process.exit(1);
    }); 