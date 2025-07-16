const { redisClient } = require('./config/redis');
const gameLogicService = require('./services/gameLogicService');

async function testLowestExposureFix() {
    console.log('🛡️ [LOWEST_EXPOSURE_TEST] Testing lowest exposure selection fix');
    console.log('==========================================\n');

    const testConfig = {
        gameType: 'wingo',
        duration: 30,
        periodId: `test_lowest_exposure_${Date.now()}`,
        timeline: 'default',
        userId: 26
    };

    try {
        // Step 1: Initialize game combinations
        console.log('1️⃣ Initializing game combinations...');
        await gameLogicService.initializeGameCombinations();
        console.log('✅ Game combinations initialized\n');

        // Step 2: Create exposure data with no zero-exposure numbers
        console.log('2️⃣ Creating exposure data with no zero-exposure numbers...');
        const exposureKey = `exposure:${testConfig.gameType}:${testConfig.duration}:${testConfig.timeline}:${testConfig.periodId}`;
        
        // Set different exposure levels for each number
        await redisClient.hset(exposureKey, 'number:0', '5000');  // 50.00₹
        await redisClient.hset(exposureKey, 'number:1', '3000');  // 30.00₹ (lowest)
        await redisClient.hset(exposureKey, 'number:2', '8000');  // 80.00₹
        await redisClient.hset(exposureKey, 'number:3', '4000');  // 40.00₹
        await redisClient.hset(exposureKey, 'number:4', '6000');  // 60.00₹
        await redisClient.hset(exposureKey, 'number:5', '7000');  // 70.00₹
        await redisClient.hset(exposureKey, 'number:6', '9000');  // 90.00₹
        await redisClient.hset(exposureKey, 'number:7', '10000'); // 100.00₹
        await redisClient.hset(exposureKey, 'number:8', '12000'); // 120.00₹
        await redisClient.hset(exposureKey, 'number:9', '15000'); // 150.00₹
        
        console.log('✅ Exposure data created with no zero-exposure numbers\n');

        // Step 3: Set single user (trigger protection)
        console.log('3️⃣ Setting single user to trigger protection...');
        const userCountKey = `unique_users:${testConfig.gameType}:${testConfig.duration}:${testConfig.timeline}:${testConfig.periodId}`;
        await redisClient.sadd(userCountKey, testConfig.userId);
        console.log('✅ Single user set (protection should activate)\n');

        // Step 4: Test the protection function
        console.log('4️⃣ Testing selectProtectedResultWithExposure function...');
        const protectedResult = await gameLogicService.selectProtectedResultWithExposure(
            testConfig.gameType,
            testConfig.duration,
            testConfig.periodId,
            testConfig.timeline
        );
        console.log('🎯 Protected result:', protectedResult);

        // Step 5: Verify the result
        const resultNumber = protectedResult.number;
        const expectedLowestExposure = 1; // number:1 has 3000 exposure (lowest)
        
        console.log('\n🎯 [ANALYSIS]');
        console.log(`   Result number: ${resultNumber}`);
        console.log(`   Expected lowest exposure number: ${expectedLowestExposure}`);
        console.log(`   Test passed: ${resultNumber === expectedLowestExposure}`);

        if (resultNumber === expectedLowestExposure) {
            console.log('✅ [SUCCESS] Protection correctly selected the lowest exposure number!');
        } else {
            console.log('❌ [FAILURE] Protection did not select the lowest exposure number!');
        }

        // Step 6: Test multiple times to ensure consistency
        console.log('\n5️⃣ Testing multiple times for consistency...');
        const results = [];
        for (let i = 0; i < 5; i++) {
            const result = await gameLogicService.selectProtectedResultWithExposure(
                testConfig.gameType,
                testConfig.duration,
                testConfig.periodId,
                testConfig.timeline
            );
            results.push(result.number);
        }
        
        console.log('📊 Results from 5 tests:', results);
        
        // All results should be from the lowest exposure numbers
        const lowestExposureNumbers = [1]; // Only number:1 has the lowest exposure (3000)
        const allFromLowest = results.every(num => lowestExposureNumbers.includes(num));
        
        console.log(`🎯 [CONSISTENCY_CHECK]`);
        console.log(`   Expected numbers: [${lowestExposureNumbers.join(', ')}]`);
        console.log(`   All results from lowest exposure: ${allFromLowest}`);
        
        if (allFromLowest) {
            console.log('✅ [SUCCESS] Protection consistently selects from lowest exposure numbers!');
        } else {
            console.log('❌ [FAILURE] Protection is not consistent!');
        }

        // Step 7: Test with multiple lowest exposure numbers
        console.log('\n6️⃣ Testing with multiple numbers having same lowest exposure...');
        
        // Set multiple numbers to have the same lowest exposure
        await redisClient.hset(exposureKey, 'number:0', '3000'); // Same as number:1
        await redisClient.hset(exposureKey, 'number:2', '3000'); // Same as number:1
        
        console.log('✅ Set numbers 0, 1, 2 to have same lowest exposure (3000)');
        
        const multiResults = [];
        for (let i = 0; i < 10; i++) {
            const result = await gameLogicService.selectProtectedResultWithExposure(
                testConfig.gameType,
                testConfig.duration,
                testConfig.periodId,
                testConfig.timeline
            );
            multiResults.push(result.number);
        }
        
        console.log('📊 Results from 10 tests with multiple lowest:', multiResults);
        
        const expectedMultiLowest = [0, 1, 2];
        const allFromMultiLowest = multiResults.every(num => expectedMultiLowest.includes(num));
        const hasVariety = new Set(multiResults).size > 1;
        
        console.log(`🎯 [MULTI_LOWEST_CHECK]`);
        console.log(`   Expected numbers: [${expectedMultiLowest.join(', ')}]`);
        console.log(`   All results from lowest exposure: ${allFromMultiLowest}`);
        console.log(`   Has variety (not always same number): ${hasVariety}`);
        
        if (allFromMultiLowest && hasVariety) {
            console.log('✅ [SUCCESS] Protection correctly randomizes among multiple lowest exposure numbers!');
        } else {
            console.log('❌ [FAILURE] Protection not working correctly with multiple lowest exposure numbers!');
        }

    } catch (error) {
        console.error('❌ [LOWEST_EXPOSURE_TEST] Error:', error);
    } finally {
        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        const exposureKey = `exposure:${testConfig.gameType}:${testConfig.duration}:${testConfig.timeline}:${testConfig.periodId}`;
        const userCountKey = `unique_users:${testConfig.gameType}:${testConfig.duration}:${testConfig.timeline}:${testConfig.periodId}`;
        
        await redisClient.del(exposureKey);
        await redisClient.del(userCountKey);
        console.log('✅ Test data cleaned up');
        
        await redisClient.quit();
    }
}

// Run the test
testLowestExposureFix().catch(console.error); 