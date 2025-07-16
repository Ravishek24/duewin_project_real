const { redisClient } = require('./config/redis');
const gameLogicService = require('./services/gameLogicService');

async function testK3ProtectionFix() {
    console.log('🛡️ [K3_PROTECTION_TEST] Testing K3 protection fix');
    console.log('==========================================\n');

    const testConfig = {
        gameType: 'k3',
        duration: 30,
        periodId: `test_k3_protection_${Date.now()}`,
        timeline: 'default',
        userId: 26
    };

    try {
        // Step 1: Initialize game combinations
        console.log('1️⃣ Initializing game combinations...');
        await gameLogicService.initializeGameCombinations();
        console.log('✅ Game combinations initialized\n');

        // Step 2: Create exposure data with no zero-exposure combinations
        console.log('2️⃣ Creating exposure data with no zero-exposure combinations...');
        const exposureKey = `exposure:${testConfig.gameType}:${testConfig.duration}:${testConfig.timeline}:${testConfig.periodId}`;
        
        // Set different exposure levels for some K3 combinations
        await redisClient.hset(exposureKey, 'dice:1,1,1', '5000');  // 50.00₹
        await redisClient.hset(exposureKey, 'dice:1,1,2', '3000');  // 30.00₹ (lowest)
        await redisClient.hset(exposureKey, 'dice:1,2,1', '8000');  // 80.00₹
        await redisClient.hset(exposureKey, 'dice:2,1,1', '4000');  // 40.00₹
        await redisClient.hset(exposureKey, 'dice:2,2,2', '6000');  // 60.00₹
        await redisClient.hset(exposureKey, 'dice:3,3,3', '7000');  // 70.00₹
        
        console.log('✅ Exposure data created with no zero-exposure combinations\n');

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
        const resultKey = `${protectedResult.dice_1},${protectedResult.dice_2},${protectedResult.dice_3}`;
        const expectedLowestExposure = '1,1,2'; // dice:1,1,2 has 3000 exposure (lowest)
        
        console.log('\n🎯 [ANALYSIS]');
        console.log(`   Result combination: ${resultKey}`);
        console.log(`   Expected lowest exposure combination: ${expectedLowestExposure}`);
        console.log(`   Test passed: ${resultKey === expectedLowestExposure}`);

        if (resultKey === expectedLowestExposure) {
            console.log('✅ [SUCCESS] K3 Protection correctly selected the lowest exposure combination!');
        } else {
            console.log('❌ [FAILURE] K3 Protection did not select the lowest exposure combination!');
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
            const key = `${result.dice_1},${result.dice_2},${result.dice_3}`;
            results.push(key);
        }
        
        console.log('📊 Results from 5 tests:', results);
        
        // All results should be from the lowest exposure combinations
        const lowestExposureCombinations = ['1,1,2']; // Only dice:1,1,2 has the lowest exposure (3000)
        const allFromLowest = results.every(key => lowestExposureCombinations.includes(key));
        
        console.log(`🎯 [CONSISTENCY_CHECK]`);
        console.log(`   Expected combinations: [${lowestExposureCombinations.join(', ')}]`);
        console.log(`   All results from lowest exposure: ${allFromLowest}`);
        
        if (allFromLowest) {
            console.log('✅ [SUCCESS] K3 Protection consistently selects from lowest exposure combinations!');
        } else {
            console.log('❌ [FAILURE] K3 Protection is not consistent!');
        }

        // Step 7: Test with multiple lowest exposure combinations
        console.log('\n6️⃣ Testing with multiple combinations having same lowest exposure...');
        
        // Set multiple combinations to have the same lowest exposure
        await redisClient.hset(exposureKey, 'dice:1,1,1', '3000'); // Same as dice:1,1,2
        await redisClient.hset(exposureKey, 'dice:1,2,1', '3000'); // Same as dice:1,1,2
        
        console.log('✅ Set combinations 1,1,1, 1,1,2, 1,2,1 to have same lowest exposure (3000)');
        
        const multiResults = [];
        for (let i = 0; i < 10; i++) {
            const result = await gameLogicService.selectProtectedResultWithExposure(
                testConfig.gameType,
                testConfig.duration,
                testConfig.periodId,
                testConfig.timeline
            );
            const key = `${result.dice_1},${result.dice_2},${result.dice_3}`;
            multiResults.push(key);
        }
        
        console.log('📊 Results from 10 tests with multiple lowest:', multiResults);
        
        const expectedMultiLowest = ['1,1,1', '1,1,2', '1,2,1'];
        const allFromMultiLowest = multiResults.every(key => expectedMultiLowest.includes(key));
        const hasVariety = new Set(multiResults).size > 1;
        
        console.log(`🎯 [MULTI_LOWEST_CHECK]`);
        console.log(`   Expected combinations: [${expectedMultiLowest.join(', ')}]`);
        console.log(`   All results from lowest exposure: ${allFromMultiLowest}`);
        console.log(`   Has variety (not always same combination): ${hasVariety}`);
        
        if (allFromMultiLowest && hasVariety) {
            console.log('✅ [SUCCESS] K3 Protection correctly randomizes among multiple lowest exposure combinations!');
        } else {
            console.log('❌ [FAILURE] K3 Protection not working correctly with multiple lowest exposure combinations!');
        }

        // Step 8: Test with zero-exposure combinations
        console.log('\n7️⃣ Testing with zero-exposure combinations...');
        
        // Set some combinations to have zero exposure
        await redisClient.hset(exposureKey, 'dice:6,6,6', '0'); // Zero exposure
        await redisClient.hset(exposureKey, 'dice:5,5,5', '0'); // Zero exposure
        
        console.log('✅ Set combinations 6,6,6 and 5,5,5 to have zero exposure');
        
        const zeroResults = [];
        for (let i = 0; i < 10; i++) {
            const result = await gameLogicService.selectProtectedResultWithExposure(
                testConfig.gameType,
                testConfig.duration,
                testConfig.periodId,
                testConfig.timeline
            );
            const key = `${result.dice_1},${result.dice_2},${result.dice_3}`;
            zeroResults.push(key);
        }
        
        console.log('📊 Results from 10 tests with zero-exposure:', zeroResults);
        
        const expectedZeroExposure = ['5,5,5', '6,6,6'];
        const allFromZeroExposure = zeroResults.every(key => expectedZeroExposure.includes(key));
        const hasZeroVariety = new Set(zeroResults).size > 1;
        
        console.log(`🎯 [ZERO_EXPOSURE_CHECK]`);
        console.log(`   Expected combinations: [${expectedZeroExposure.join(', ')}]`);
        console.log(`   All results from zero exposure: ${allFromZeroExposure}`);
        console.log(`   Has variety (not always same combination): ${hasZeroVariety}`);
        
        if (allFromZeroExposure && hasZeroVariety) {
            console.log('✅ [SUCCESS] K3 Protection correctly prioritizes zero-exposure combinations!');
        } else {
            console.log('❌ [FAILURE] K3 Protection not working correctly with zero-exposure combinations!');
        }

    } catch (error) {
        console.error('❌ [K3_PROTECTION_TEST] Error:', error);
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
testK3ProtectionFix().catch(console.error); 