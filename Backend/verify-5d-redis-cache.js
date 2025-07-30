const unifiedRedis = require('./config/unifiedRedisManager');

async function getRedisHelper() {
    // Initialize the Redis manager first
    await unifiedRedis.initialize();
    return unifiedRedis.getHelper();
}

async function verify5DRedisCache() {
    console.log('🔍 [5D_REDIS_VERIFICATION] Starting comprehensive 5D Redis cache verification...');
    
    try {
        const redis = await getRedisHelper();
        
        // Test 1: Check if Redis is connected
        console.log('\n📊 Test 1: Redis Connection');
        try {
            await redis.ping();
            console.log('✅ Redis connection: SUCCESS');
        } catch (error) {
            console.log('❌ Redis connection: FAILED');
            console.log('Error:', error.message);
            return;
        }
        
        // Test 2: Check if 5D cache key exists
        console.log('\n📊 Test 2: 5D Cache Key Existence');
        const cacheKey = '5d_combinations_cache';
        const cacheExists = await redis.exists(cacheKey);
        console.log('Cache key exists:', cacheExists ? 'YES' : 'NO');
        
        if (!cacheExists) {
            console.log('❌ 5D combinations cache not found in Redis');
            console.log('💡 Run the initialization script first: node init-5d-redis-cache.js');
            return;
        }
        
        // Test 3: Check total number of combinations
        console.log('\n📊 Test 3: Total Combinations Count');
        const totalCombinations = await redis.hlen(cacheKey);
        console.log('Total combinations in Redis:', totalCombinations);
        
        if (totalCombinations === 0) {
            console.log('❌ No combinations found in Redis cache');
            return;
        }
        
        if (totalCombinations < 100000) {
            console.log('⚠️ WARNING: Expected 100,000 combinations, found:', totalCombinations);
        } else {
            console.log('✅ Expected 100,000 combinations found:', totalCombinations);
        }
        
        // Test 4: Sample some combinations
        console.log('\n📊 Test 4: Sample Combinations Test');
        const sampleDiceValues = ['11111', '12345', '66666', '99999', '00000'];
        
        for (const diceValue of sampleDiceValues) {
            try {
                const combination = await redis.hget(cacheKey, `combo:${diceValue}`);
                if (combination) {
                    const parsed = JSON.parse(combination);
                    console.log(`✅ Dice ${diceValue}: Found - A:${parsed.dice_a}, B:${parsed.dice_b}, C:${parsed.dice_c}, D:${parsed.dice_d}, E:${parsed.dice_e}, Sum:${parsed.sum_value}`);
                } else {
                    console.log(`❌ Dice ${diceValue}: NOT FOUND`);
                }
            } catch (error) {
                console.log(`❌ Dice ${diceValue}: Error - ${error.message}`);
            }
        }
        
        // Test 5: Check random combinations
        console.log('\n📊 Test 5: Random Combinations Test');
        const randomTests = 10;
        let foundCount = 0;
        
        for (let i = 0; i < randomTests; i++) {
            const randomDice = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
            try {
                const combination = await redis.hget(cacheKey, `combo:${randomDice}`);
                if (combination) {
                    foundCount++;
                    const parsed = JSON.parse(combination);
                    console.log(`✅ Random ${randomDice}: Found - Sum:${parsed.sum_value}, Size:${parsed.sum_size}, Parity:${parsed.sum_parity}`);
                } else {
                    console.log(`❌ Random ${randomDice}: NOT FOUND`);
                }
            } catch (error) {
                console.log(`❌ Random ${randomDice}: Error - ${error.message}`);
            }
        }
        
        console.log(`Random test results: ${foundCount}/${randomTests} combinations found`);
        
        // Test 6: Performance test
        console.log('\n📊 Test 6: Performance Test');
        const startTime = Date.now();
        const performanceTests = 100;
        
        for (let i = 0; i < performanceTests; i++) {
            const testDice = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
            await redis.hget(cacheKey, testDice);
        }
        
        const endTime = Date.now();
        const avgTime = (endTime - startTime) / performanceTests;
        
        console.log(`Performance: ${performanceTests} lookups in ${endTime - startTime}ms`);
        console.log(`Average time per lookup: ${avgTime.toFixed(2)}ms`);
        
        if (avgTime < 1) {
            console.log('✅ Performance: EXCELLENT (< 1ms per lookup)');
        } else if (avgTime < 5) {
            console.log('✅ Performance: GOOD (< 5ms per lookup)');
        } else {
            console.log('⚠️ Performance: SLOW (> 5ms per lookup)');
        }
        
        // Test 7: Check specific combination properties
        console.log('\n📊 Test 7: Combination Properties Test');
        const testCombinations = [
            { dice: '11111', expected: { sum: 5, size: 'small', parity: 'odd' } },
            { dice: '66666', expected: { sum: 30, size: 'big', parity: 'even' } },
            { dice: '12345', expected: { sum: 15, size: 'small', parity: 'odd' } },
            { dice: '99999', expected: { sum: 45, size: 'big', parity: 'odd' } }
        ];
        
        for (const test of testCombinations) {
            try {
                const combination = await redis.hget(cacheKey, test.dice);
                if (combination) {
                    const parsed = JSON.parse(combination);
                    const correct = parsed.sum_value === test.expected.sum && 
                                  parsed.sum_size === test.expected.size && 
                                  parsed.sum_parity === test.expected.parity;
                    
                    console.log(`✅ ${test.dice}: ${correct ? 'CORRECT' : 'INCORRECT'} - Expected: ${JSON.stringify(test.expected)}, Got: ${JSON.stringify({sum: parsed.sum_value, size: parsed.sum_size, parity: parsed.sum_parity})}`);
                } else {
                    console.log(`❌ ${test.dice}: NOT FOUND`);
                }
            } catch (error) {
                console.log(`❌ ${test.dice}: Error - ${error.message}`);
            }
        }
        
        // Test 8: Check Redis memory usage
        console.log('\n📊 Test 8: Redis Memory Usage');
        try {
            const info = await redis.info('memory');
            const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
            if (memoryMatch) {
                console.log('Redis memory usage:', memoryMatch[1].trim());
            }
        } catch (error) {
            console.log('❌ Could not get Redis memory info:', error.message);
        }
        
        // Summary
        console.log('\n📋 5D REDIS CACHE VERIFICATION SUMMARY:');
        console.log('├─ Redis connection: ' + (await redis.ping() ? '✅ OK' : '❌ FAILED'));
        console.log('├─ Cache key exists: ' + (cacheExists ? '✅ YES' : '❌ NO'));
        console.log('├─ Total combinations: ' + totalCombinations + (totalCombinations >= 100000 ? ' ✅' : ' ⚠️'));
        console.log('├─ Sample combinations: ' + (sampleDiceValues.length + ' tested'));
        console.log('├─ Random combinations: ' + foundCount + '/' + randomTests + ' found');
        console.log('├─ Performance: ' + avgTime.toFixed(2) + 'ms average');
        console.log('└─ Memory usage: Checked');
        
        if (cacheExists && totalCombinations >= 100000 && foundCount >= randomTests * 0.8) {
            console.log('\n✅ 5D REDIS CACHE: VERIFICATION PASSED!');
            console.log('🎯 The 5D combinations are properly loaded and accessible.');
        } else {
            console.log('\n❌ 5D REDIS CACHE: VERIFICATION FAILED!');
            console.log('🔧 Please run: node init-5d-redis-cache.js');
        }
        
    } catch (error) {
        console.error('❌ [5D_REDIS_VERIFICATION] Verification failed:', error.message);
        console.error(error.stack);
    }
}

// Run the verification
verify5DRedisCache().then(() => {
    console.log('\n🏁 [5D_REDIS_VERIFICATION] Verification completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [5D_REDIS_VERIFICATION] Verification failed:', error);
    process.exit(1);
}); 