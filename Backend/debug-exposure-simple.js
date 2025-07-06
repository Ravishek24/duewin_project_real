const redis = require('redis');
const gameLogicService = require('./services/gameLogicService');

async function simpleExposureTest() {
    console.log('🔧 SIMPLE EXPOSURE DIAGNOSTIC');
    console.log('=============================\n');

    let redisClient;

    try {
        // Step 1: Initialize Redis properly
        console.log('🔌 Step 1: Initializing Redis...');
        redisClient = redis.createClient({
            host: 'localhost',
            port: 6379,
            retryDelayOnFailover: 100,
            enableReadyCheck: true,
            maxRetriesPerRequest: 3,
        });

        await redisClient.connect();
        console.log('✅ Redis connected successfully');

        // Step 2: Test data
        console.log('\n📊 Step 2: Preparing test data...');
        const testData = {
            gameType: 'wingo',
            duration: 30,
            timeline: 'default', 
            periodId: '20250706SIMPLE001',
            bet: {
                userId: 13,
                betType: 'COLOR',
                betValue: 'red',
                netBetAmount: 98,
                platformFee: 2,
                grossBetAmount: 100
            }
        };
        console.log('✅ Test data prepared');

        // Step 3: Initialize game combinations
        console.log('\n🎲 Step 3: Initialize combinations...');
        await gameLogicService.initializeGameCombinations();
        console.log('✅ Combinations initialized');
        console.log('📊 Wing combos exist:', !!global.wingoCombinations);

        // Step 4: Clear existing data
        console.log('\n🧹 Step 4: Clear existing test data...');
        const exposureKey = `exposure:${testData.gameType}:${testData.duration}:${testData.timeline}:${testData.periodId}`;
        await redisClient.del(exposureKey);
        console.log('✅ Test data cleared');

        // Step 5: Test manual calculation
        console.log('\n🧮 Step 5: Manual calculation test...');
        const odds = gameLogicService.calculateOdds(testData.gameType, testData.bet.betType, testData.bet.betValue);
        const exposure = Math.round(testData.bet.netBetAmount * odds * 100);
        console.log(`📊 Odds: ${odds}, Exposure: ${exposure} cents (₹${exposure/100})`);

        // Step 6: Test the function directly
        console.log('\n🔧 Step 6: Testing updateBetExposure...');
        
        // Capture any errors
        try {
            const result = await gameLogicService.updateBetExposure(
                testData.gameType,
                testData.duration,
                testData.periodId,
                testData.bet,
                testData.timeline
            );
            console.log('✅ updateBetExposure returned:', result);
        } catch (funcError) {
            console.error('❌ updateBetExposure error:', funcError.message);
            console.error('   Stack:', funcError.stack);
        }

        // Step 7: Check Redis result
        console.log('\n📊 Step 7: Checking Redis result...');
        try {
            // Use correct Redis v4+ syntax
            const exposureData = await redisClient.hGetAll(exposureKey);
            console.log('📊 Exposure data:', exposureData);
            console.log('📊 Data count:', Object.keys(exposureData).length);

            if (Object.keys(exposureData).length === 0) {
                console.log('\n❌ FUNCTION FAILED - NO DATA WRITTEN TO REDIS');
                
                // Test manual Redis write to verify Redis works
                console.log('\n🧪 Testing manual Redis write...');
                await redisClient.hSet(exposureKey, 'test:key', '100');
                const testRead = await redisClient.hGet(exposureKey, 'test:key');
                console.log('🧪 Manual write test:', testRead === '100' ? '✅ PASS' : '❌ FAIL');
                
            } else {
                console.log('\n✅ FUNCTION SUCCESS - DATA WRITTEN CORRECTLY');
                for (const [key, value] of Object.entries(exposureData)) {
                    console.log(`   ${key}: ${value} (₹${parseFloat(value) / 100})`);
                }
            }
        } catch (redisError) {
            console.error('❌ Redis check error:', redisError.message);
            console.log('🔧 Trying alternative Redis methods...');
            
            // Try alternative method
            try {
                const keys = await redisClient.hKeys(exposureKey);
                console.log('🔑 Keys found:', keys);
                if (keys.length > 0) {
                    console.log('✅ DATA EXISTS - Function worked but method name issue');
                    for (const key of keys) {
                        const value = await redisClient.hGet(exposureKey, key);
                        console.log(`   ${key}: ${value}`);
                    }
                }
            } catch (altError) {
                console.error('❌ Alternative method failed:', altError.message);
            }
        }

        // Step 8: Test with production format
        console.log('\n🏭 Step 8: Test with production format...');
        const prodBet = {
            user_id: 13,
            bet_type: 'COLOR:red',
            amount_after_tax: 98,
            betAmount: 100
        };
        
        const prodKey = `exposure:wingo:30:default:20250706PROD001`;
        await redisClient.del(prodKey);
        
        try {
            await gameLogicService.updateBetExposure('wingo', 30, '20250706PROD001', prodBet, 'default');
            
            // Check production result with correct method
            try {
                const prodResult = await redisClient.hGetAll(prodKey);
                console.log('🏭 Production format result:', prodResult);
                console.log('🏭 Production count:', Object.keys(prodResult).length);
            } catch (prodRedisError) {
                // Try alternative for production too
                const prodKeys = await redisClient.hKeys(prodKey);
                console.log('🏭 Production keys:', prodKeys);
                if (prodKeys.length > 0) {
                    console.log('✅ PRODUCTION FORMAT WORKS!');
                    for (const key of prodKeys) {
                        const value = await redisClient.hGet(prodKey, key);
                        console.log(`   ${key}: ${value}`);
                    }
                }
            }
        } catch (prodError) {
            console.error('❌ Production format error:', prodError.message);
        }

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
simpleExposureTest().catch(console.error); 