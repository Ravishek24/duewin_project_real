let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }



const gameLogicService = require('./services/gameLogicService');

async function testProductionIntegration() {
    console.log('🚀 TESTING PRODUCTION INTEGRATION FIX');
    console.log('=====================================\n');

    let redisClient;

    try {
        // Step 1: Initialize Redis
        console.log('🔌 Step 1: Initializing Redis...');
        redisClient = 
        await redisClient.connect();
        console.log('✅ Redis connected successfully');

        // Step 2: Initialize combinations
        console.log('\n🎲 Step 2: Initialize combinations...');
        await gameLogicService.initializeGameCombinations();
        console.log('✅ Combinations initialized');

        // Step 3: Test production bet data format
        console.log('\n🏭 Step 3: Test production bet data...');
        const prodBetData = {
            userId: 13,
            gameType: 'wingo',
            duration: 30,
            timeline: 'default',
            periodId: '20250706PROD002',
            betType: 'COLOR',
            betValue: 'red',
            betAmount: 100,
            grossBetAmount: 100,
            platformFee: 2,
            netBetAmount: 98
        };

        // Clear any existing data
        const exposureKey = `exposure:wingo:30:default:20250706PROD002`;
        await redisClient.del(exposureKey);
        console.log('✅ Test data cleared');

        // Step 4: Test storeBetInRedisWithTimeline (production function)
        console.log('\n📦 Step 4: Test storeBetInRedisWithTimeline...');
        try {
            const storeResult = await gameLogicService.storeBetInRedisWithTimeline(prodBetData);
            console.log('✅ storeBetInRedisWithTimeline result:', storeResult);

            // Check exposure data
            const exposureData = await redisClient.hGetAll(exposureKey);
            console.log('📊 Exposure data from production function:', exposureData);
            console.log('📊 Exposure count:', Object.keys(exposureData).length);

            if (Object.keys(exposureData).length === 0) {
                console.log('❌ PRODUCTION INTEGRATION STILL BROKEN');
            } else {
                console.log('✅ PRODUCTION INTEGRATION FIXED!');
                
                // Verify RED numbers have exposure
                const redNumbers = [0, 2, 4, 6, 8];
                const redExposures = redNumbers.map(num => exposureData[`number:${num}`]).filter(Boolean);
                console.log(`🔴 RED numbers with exposure: ${redExposures.length}/5`);
                
                // Verify GREEN numbers have no exposure  
                const greenNumbers = [1, 3, 5, 7, 9];
                const greenExposures = greenNumbers.map(num => exposureData[`number:${num}`]).filter(Boolean);
                console.log(`🟢 GREEN numbers with exposure: ${greenExposures.length}/5 (should be 0)`);
                
                if (redExposures.length === 5 && greenExposures.length === 0) {
                    console.log('🎯 PERFECT! Protection logic will work correctly!');
                } else {
                    console.log('⚠️ Exposure distribution incorrect');
                }
            }
        } catch (storeError) {
            console.error('❌ storeBetInRedisWithTimeline error:', storeError.message);
        }

        // Step 5: Test protection function with real data
        console.log('\n🛡️ Step 5: Test protection with real data...');
        try {
            const protectedResult = await gameLogicService.selectProtectedResultWithExposure(
                'wingo', 30, '20250706PROD002', 'default'
            );
            console.log('🛡️ Protected result:', protectedResult);
            
            if (protectedResult && protectedResult.color === 'green') {
                console.log('✅ PROTECTION WORKS! Selected GREEN number (user loses) ✅');
            } else if (protectedResult && protectedResult.color.includes('green')) {
                console.log('✅ PROTECTION WORKS! Selected GREEN_VIOLET number (user loses) ✅');
            } else {
                console.log('❌ Protection failed - selected RED number (user would win)');
            }
        } catch (protError) {
            console.error('❌ Protection test error:', protError.message);
        }

        // Step 6: Test complete flow simulation
        console.log('\n🔄 Step 6: Complete flow simulation...');
        const user13Bet = {
            user_id: 13,
            bet_type: 'COLOR:red',
            amount_after_tax: 98,
            betAmount: 100
        };

        const winResult = await gameLogicService.checkBetWin(
            user13Bet, 
            { number: 3, color: 'green' }, 
            'wingo'
        );
        
        console.log(`🎯 Win check: User bets RED, result is GREEN → User wins: ${winResult}`);
        console.log(winResult ? '❌ BUG STILL EXISTS' : '✅ WIN LOGIC CORRECT');

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        if (redisClient) {
            await redisClient.quit();
            console.log('\n🔌 Redis connection closed');
        }
        console.log('✅ Test completed');
    }
}

// Run the test
testProductionIntegration().catch(console.error); 
module.exports = { setRedisHelper };
