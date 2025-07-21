let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }


// Debug Exposure Tracking Issue
// Tests specifically why exposure data is not being created


const gameLogicService = require('./services/gameLogicService');

// Redis client
const redisClient = 

async function debugExposureTracking() {
    try {
        console.log('🔍 DEBUGGING EXPOSURE TRACKING ISSUE');
        console.log('=====================================\n');

        // Test data
        const testData = {
            gameType: 'wingo',
            duration: 30,
            timeline: 'default',
            periodId: '20250706058393676',
            bet: {
                userId: 13,
                betType: 'COLOR',
                betValue: 'red',
                netBetAmount: 98,
                platformFee: 2,
                grossBetAmount: 100,
                timestamp: Date.now()
            }
        };

        console.log('🎯 Test Data:', JSON.stringify(testData, null, 2));

        // Step 1: Initialize game combinations
        console.log('\n📋 STEP 1: Initialize Game Combinations');
        await gameLogicService.initializeGameCombinations();
        
        if (global.wingoCombinations) {
            console.log('✅ Wingo combinations initialized');
            console.log('📊 Number 0 combination:', global.wingoCombinations[0]);
            console.log('📊 Number 2 combination:', global.wingoCombinations[2]);
            console.log('📊 Number 1 combination:', global.wingoCombinations[1]);
        } else {
            console.log('❌ Wingo combinations NOT initialized');
        }

        // Step 2: Test updateBetExposure directly
        console.log('\n🎯 STEP 2: Test updateBetExposure Function');
        
        try {
            const exposureResult = await gameLogicService.updateBetExposure(
                testData.gameType,
                testData.duration,
                testData.periodId,
                testData.bet,
                testData.timeline
            );
            
            console.log('✅ updateBetExposure result:', exposureResult);
        } catch (error) {
            console.log('❌ updateBetExposure failed:', error.message);
            console.log('Stack:', error.stack);
        }

        // Step 3: Check Redis exposure data
        console.log('\n📊 STEP 3: Check Redis Exposure Data');
        
        const exposureKey = `exposure:${testData.gameType}:${testData.duration}:${testData.timeline}:${testData.periodId}`;
        const exposureData = await redisClient.hgetall(exposureKey);
        
        console.log('🔑 Exposure Key:', exposureKey);
        console.log('📊 Exposure Data:', exposureData);
        console.log('📊 Exposure Count:', Object.keys(exposureData).length);

        // Step 4: Manual exposure calculation
        console.log('\n🧮 STEP 4: Manual Exposure Calculation');
        
        const netBetAmount = testData.bet.netBetAmount;
        const betType = testData.bet.betType;
        const betValue = testData.bet.betValue;
        
        console.log(`💰 Net Bet Amount: ${netBetAmount}`);
        console.log(`🎯 Bet Type: ${betType}`);
        console.log(`🎨 Bet Value: ${betValue}`);
        
        // Calculate odds
        const odds = gameLogicService.calculateOdds(testData.gameType, betType, betValue);
        const exposure = netBetAmount * odds;
        
        console.log(`🎲 Odds: ${odds}`);
        console.log(`💸 Expected Exposure: ${exposure}`);

        // Step 5: Manual Redis write test
        console.log('\n✍️ STEP 5: Manual Redis Write Test');
        
        const testKey = `test_exposure:${Date.now()}`;
        await redisClient.hincrby(testKey, 'number:0', exposure);
        await redisClient.hincrby(testKey, 'number:2', exposure);
        
        const testData_redis = await redisClient.hgetall(testKey);
        console.log('🧪 Test Redis Data:', testData_redis);
        
        // Cleanup test data
        await redisClient.del(testKey);

        // Step 6: Check which numbers should have exposure
        console.log('\n🎨 STEP 6: Color Mapping Analysis');
        
        if (global.wingoCombinations) {
            console.log('Red numbers (should have exposure):');
            for (let num = 0; num <= 9; num++) {
                const combo = global.wingoCombinations[num];
                if (combo && (combo.color === 'red' || combo.color === 'red_violet')) {
                    console.log(`  - Number ${num}: ${combo.color}`);
                }
            }
            
            console.log('\nGreen numbers (should NOT have exposure):');
            for (let num = 0; num <= 9; num++) {
                const combo = global.wingoCombinations[num];
                if (combo && (combo.color === 'green' || combo.color === 'green_violet')) {
                    console.log(`  - Number ${num}: ${combo.color}`);
                }
            }
        }

        // Step 7: Test checkWinCondition function
        console.log('\n🎯 STEP 7: Test checkWinCondition Function');
        
        if (global.wingoCombinations) {
            for (let num = 0; num <= 9; num++) {
                const combo = global.wingoCombinations[num];
                if (combo) {
                    const shouldWin = gameLogicService.checkWinCondition(combo, betType, betValue);
                    console.log(`Number ${num} (${combo.color}): ${shouldWin ? 'WINS' : 'loses'}`);
                }
            }
        }

        // Step 8: Test storeBetInRedisWithTimeline
        console.log('\n📦 STEP 8: Test storeBetInRedisWithTimeline');
        
        const betData = {
            userId: testData.bet.userId,
            gameType: testData.gameType,
            duration: testData.duration,
            timeline: testData.timeline,
            betType: testData.bet.betType,
            betValue: testData.bet.betValue,
            betAmount: testData.bet.netBetAmount,
            periodId: testData.periodId,
            grossBetAmount: testData.bet.grossBetAmount,
            platformFee: testData.bet.platformFee,
            netBetAmount: testData.bet.netBetAmount
        };
        
        try {
            const storeResult = await gameLogicService.storeBetInRedisWithTimeline(betData);
            console.log('✅ storeBetInRedisWithTimeline result:', storeResult);
            
            // Check exposure again after this call
            const exposureDataAfter = await redisClient.hgetall(exposureKey);
            console.log('📊 Exposure Data After storeBetInRedisWithTimeline:', exposureDataAfter);
            
        } catch (error) {
            console.log('❌ storeBetInRedisWithTimeline failed:', error.message);
            console.log('Stack:', error.stack);
        }

        console.log('\n🏁 DEBUGGING COMPLETE');
        console.log('=====================================');

    } catch (error) {
        console.error('❌ DEBUG FAILED:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        await redisClient.disconnect();
    }
}

// Run the debug
if (require.main === module) {
    debugExposureTracking()
        .then(() => {
            console.log('\n✅ Debug completed');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Debug failed:', error);
            process.exit(1);
        });
}

module.exports = { debugExposureTracking }; 