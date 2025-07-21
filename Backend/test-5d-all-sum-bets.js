function getRedisClient() {
  if (!redisHelper) throw new Error('redisHelper not set!');
  return getRedisClient();
}
const { initializeModels } = require('./models');
const fiveDProtectionService = require('./services/fiveDProtectionService');
const redisHelper = require('./config/redis');


async function test5DAllSumBets() {
    try {
        console.log('🎯 [5D_ALL_SUM_TEST] ==========================================');
        console.log('🎯 [5D_ALL_SUM_TEST] Testing 5D Protection with ALL SUM BETS');
        console.log('🎯 [5D_ALL_SUM_TEST] ==========================================');

        // Initialize models first
        console.log('\n🔧 [INIT] Initializing models...');
        await initializeModels();
        console.log('✅ Models initialized successfully');

        const gameType = '5d';
        const duration = 60;
        const periodId = 'TEST5D_ALLSUM' + Date.now();
        const timeline = 'default';

        // Test 1: Initialize zero-exposure candidates
        console.log('\n🔍 [TEST_1] Initializing zero-exposure candidates...');
        
        const initCount = await fiveDProtectionService.initializeZeroExposureCandidates(
            gameType, duration, periodId, timeline
        );
        
        console.log(`✅ Initialized ${initCount} zero-exposure candidates`);

        // Test 2: Get initial protection stats
        console.log('\n🔍 [TEST_2] Getting initial protection stats...');
        
        const initialStats = await fiveDProtectionService.getProtectionStats(
            gameType, duration, periodId, timeline
        );
        
        console.log('Initial protection stats:', initialStats);

        // Test 3: Simulate ALL SUM BETS (your scenario)
        console.log('\n🔍 [TEST_3] Simulating ALL SUM BETS scenario...');
        
        const allSumBets = [
            { betType: 'SUM_PARITY', betValue: 'even', betAmount: 1000, odds: 2.0 },  // ₹10
            { betType: 'SUM_SIZE', betValue: 'small', betAmount: 1000, odds: 2.0 },   // ₹10
            { betType: 'SUM_PARITY', betValue: 'odd', betAmount: 100, odds: 2.0 },    // ₹1
            { betType: 'SUM_SIZE', betValue: 'big', betAmount: 100, odds: 2.0 }       // ₹1
        ];
        
        const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
        
        for (let i = 0; i < allSumBets.length; i++) {
            const bet = allSumBets[i];
            console.log(`\n💰 [BET_${i + 1}] Placing bet: ${bet.betType}:${bet.betValue} (₹${(bet.betAmount / 100).toFixed(2)})`);
            
            // Add exposure to Redis
            const exposure = Math.round(bet.betAmount * bet.odds * 100);
            const betKey = `${bet.betType}:${bet.betValue}`;
            await redisClient.hset(exposureKey, `bet:${betKey}`, exposure);
            
            // Remove winning combinations from zero-exposure set
            const removedCount = await fiveDProtectionService.removeCombinationFromZeroExposure(
                gameType, duration, periodId, timeline,
                bet.betType, bet.betValue
            );
            
            console.log(`💰 [BET_${i + 1}_EXPOSURE] Added exposure: ${exposure} cents (₹${(exposure / 100).toFixed(2)})`);
            console.log(`🗑️ [BET_${i + 1}_REMOVED] Removed ${removedCount} combinations from zero-exposure set`);
            
            // Get updated stats
            const updatedStats = await fiveDProtectionService.getProtectionStats(
                gameType, duration, periodId, timeline
            );
            console.log(`📊 [BET_${i + 1}_STATS] Remaining zero-exposure: ${updatedStats.remainingZeroExposure}`);
        }

        // Test 4: Test protection logic (should find lowest exposure since zero exposure impossible)
        console.log('\n🔍 [TEST_4] Testing protection logic with ALL SUM BETS...');
        
        const result = await fiveDProtectionService.getProtectedResult(
            gameType, duration, periodId, timeline
        );
        
        console.log('🎯 [PROTECTION_RESULT] Final result:', result);
        
        // Test 5: Verify the result doesn't win all bets
        console.log('\n🔍 [TEST_5] Verifying result exposure...');
        
        const finalExposures = await redisClient.hgetall(exposureKey);
        console.log('📊 [FINAL_EXPOSURES] All bet exposures:', finalExposures);
        
        // Calculate what this result would win
        let totalPayout = 0;
        const winningBets = [];
        
        for (const [betKey, exposureStr] of Object.entries(finalExposures)) {
            if (!betKey.startsWith('bet:')) continue;
            
            const actualBetKey = betKey.replace('bet:', '');
            const [betType, betValue] = actualBetKey.split(':');
            
            let wins = false;
            
            if (betType === 'SUM_PARITY') {
                const isEven = result.sum_value % 2 === 0;
                wins = (betValue === 'even' && isEven) || (betValue === 'odd' && !isEven);
            } else if (betType === 'SUM_SIZE') {
                const isBig = result.sum_value >= 23;
                wins = (betValue === 'big' && isBig) || (betValue === 'small' && !isBig);
            }
            
            if (wins) {
                const exposure = parseInt(exposureStr);
                totalPayout += exposure;
                winningBets.push({ bet: actualBetKey, exposure });
                console.log(`✅ [WINNING_BET] ${actualBetKey} wins: ${exposure} cents (₹${(exposure / 100).toFixed(2)})`);
            } else {
                console.log(`❌ [LOSING_BET] ${actualBetKey} loses`);
            }
        }
        
        console.log(`\n📊 [PAYOUT_ANALYSIS] Total payout: ${totalPayout} cents (₹${(totalPayout / 100).toFixed(2)})`);
        console.log(`📊 [PAYOUT_ANALYSIS] Winning bets: ${winningBets.length}`);
        
        // Test 6: Verify zero exposure is impossible
        console.log('\n🔍 [TEST_6] Verifying zero exposure impossibility...');
        
        const finalStats = await fiveDProtectionService.getProtectionStats(
            gameType, duration, periodId, timeline
        );
        
        console.log('📊 [FINAL_STATS] Final protection stats:', finalStats);
        
        if (finalStats.remainingZeroExposure === 0) {
            console.log('✅ [ZERO_EXPOSURE_CHECK] Zero exposure impossible (as expected)');
        } else {
            console.log(`⚠️ [ZERO_EXPOSURE_CHECK] ${finalStats.remainingZeroExposure} zero-exposure combinations still available`);
        }

        // Cleanup
        console.log('\n🧹 [CLEANUP] Cleaning up test data...');
        const setKey = fiveDProtectionService.getZeroExposureSetKey(gameType, duration, periodId, timeline);
        await redisClient.del(setKey);
        await redisClient.del(exposureKey);
        
        console.log('\n✅ [5D_ALL_SUM_TEST] Test completed successfully!');
        console.log('✅ [5D_ALL_SUM_TEST] ==========================================');

    } catch (error) {
        console.error('❌ [5D_ALL_SUM_TEST] Error in test:', error);
        throw error;
    }
}

// Run the test
test5DAllSumBets().catch(console.error); 