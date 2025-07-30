const unifiedRedis = require('./config/unifiedRedisManager');

async function debug5DRedisStorage() {
    console.log('🔍 [5D_REDIS_DEBUG] Starting Redis storage debug...');
    
    try {
        // Initialize Redis manager
        console.log('🔄 [5D_REDIS_DEBUG] Initializing Redis manager...');
        await unifiedRedis.initialize();
        console.log('✅ [5D_REDIS_DEBUG] Redis manager initialized');
        
        const redis = unifiedRedis.getHelper();
        
        // Test Redis connection
        console.log('🔄 [5D_REDIS_DEBUG] Testing Redis connection...');
        await redis.ping();
        console.log('✅ [5D_REDIS_DEBUG] Redis connection successful');
        
        const cacheKey = '5d_combinations_cache';
        
        // Test 1: Clear any existing cache
        console.log('\n📊 Test 1: Clear existing cache');
        await redis.del(cacheKey);
        console.log('✅ Cache cleared');
        
        // Test 2: Check if cache is empty
        console.log('\n📊 Test 2: Verify cache is empty');
        const emptyCount = await redis.hlen(cacheKey);
        console.log('Cache count after clear:', emptyCount);
        
        // Test 3: Try to store a single test combination
        console.log('\n📊 Test 3: Store single test combination');
        const testCombo = {
            dice_value: '11111',
            dice_a: 1,
            dice_b: 1,
            dice_c: 1,
            dice_d: 1,
            dice_e: 1,
            sum_value: 5,
            sum_size: 'small',
            sum_parity: 'odd',
            winning_conditions: 'test'
        };
        
        try {
            const jsonData = JSON.stringify(testCombo);
            console.log('JSON data to store:', jsonData);
            
            const hsetResult = await redis.hset(cacheKey, 'combo:11111', jsonData);
            console.log('hset result:', hsetResult);
            console.log('✅ Single combination stored');
            
            // Verify it was stored
            const storedCombo = await redis.hget(cacheKey, 'combo:11111');
            console.log('Retrieved data type:', typeof storedCombo);
            console.log('Retrieved data:', storedCombo);
            
            if (storedCombo) {
                console.log('✅ Single combination retrieved, length:', storedCombo.length);
                console.log('Raw data (first 100 chars):', storedCombo.substring(0, 100));
                try {
                    const parsed = JSON.parse(storedCombo);
                    console.log('✅ JSON parsed successfully, sum_value:', parsed.sum_value);
                } catch (parseError) {
                    console.log('❌ JSON parse error:', parseError.message);
                    console.log('Raw data:', storedCombo);
                }
            } else {
                console.log('❌ Single combination not found after storage');
            }
        } catch (error) {
            console.log('❌ Error storing single combination:', error.message);
        }
        
        // Test 4: Check cache count after single storage
        console.log('\n📊 Test 4: Check cache count after single storage');
        const singleCount = await redis.hlen(cacheKey);
        console.log('Cache count after single storage:', singleCount);
        
        // Test 5: Try to store multiple combinations
        console.log('\n📊 Test 5: Store multiple test combinations');
        const testCombos = [
            { dice: '22222', data: { dice_value: '22222', dice_a: 2, dice_b: 2, dice_c: 2, dice_d: 2, dice_e: 2, sum_value: 10, sum_size: 'small', sum_parity: 'even' } },
            { dice: '33333', data: { dice_value: '33333', dice_a: 3, dice_b: 3, dice_c: 3, dice_d: 3, dice_e: 3, sum_value: 15, sum_size: 'small', sum_parity: 'odd' } },
            { dice: '44444', data: { dice_value: '44444', dice_a: 4, dice_b: 4, dice_c: 4, dice_d: 4, dice_e: 4, sum_value: 20, sum_size: 'big', sum_parity: 'even' } },
            { dice: '55555', data: { dice_value: '55555', dice_a: 5, dice_b: 5, dice_c: 5, dice_d: 5, dice_e: 5, sum_value: 25, sum_size: 'big', sum_parity: 'odd' } }
        ];
        
        for (const combo of testCombos) {
            try {
                const jsonData = JSON.stringify(combo.data);
                await redis.hset(cacheKey, `combo:${combo.dice}`, jsonData);
                console.log(`✅ Stored combo:${combo.dice}`);
            } catch (error) {
                console.log(`❌ Error storing combo:${combo.dice}:`, error.message);
            }
        }
        
        // Test 6: Check cache count after multiple storage
        console.log('\n📊 Test 6: Check cache count after multiple storage');
        const multipleCount = await redis.hlen(cacheKey);
        console.log('Cache count after multiple storage:', multipleCount);
        
        // Test 7: Retrieve all stored combinations
        console.log('\n📊 Test 7: Retrieve all stored combinations');
        for (const combo of testCombos) {
            const retrieved = await redis.hget(cacheKey, `combo:${combo.dice}`);
            console.log(`Retrieved combo:${combo.dice}, type: ${typeof retrieved}, value:`, retrieved);
            
            if (retrieved && typeof retrieved === 'string') {
                console.log(`✅ Retrieved combo:${combo.dice}, length: ${retrieved.length}`);
                try {
                    const parsed = JSON.parse(retrieved);
                    console.log(`  └─ Sum: ${parsed.sum_value}, Size: ${parsed.sum_size}, Parity: ${parsed.sum_parity}`);
                } catch (parseError) {
                    console.log(`  └─ JSON parse error: ${parseError.message}`);
                    console.log(`  └─ Raw data: ${retrieved.substring(0, 100)}...`);
                }
            } else {
                console.log(`❌ Failed to retrieve combo:${combo.dice} or invalid data type`);
            }
        }
        
        // Test 8: Check what keys exist in the cache
        console.log('\n📊 Test 8: Check all keys in cache');
        try {
            const allKeys = await redis.hkeys(cacheKey);
            console.log('All keys in cache:', allKeys);
            console.log('Total keys found:', allKeys.length);
            
            // Try to get values for each key
            for (const key of allKeys) {
                const value = await redis.hget(cacheKey, key);
                console.log(`Key: ${key}, Type: ${typeof value}, Value: ${value}`);
            }
        } catch (error) {
            console.log('❌ Could not get keys:', error.message);
        }
        
        // Test 9: Check Redis memory usage
        console.log('\n📊 Test 9: Redis memory usage');
        try {
            const info = await redis.info('memory');
            const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
            if (memoryMatch) {
                console.log('Redis memory usage:', memoryMatch[1].trim());
            }
        } catch (error) {
            console.log('❌ Could not get Redis memory info:', error.message);
        }
        
        // Test 10: Check if Redis supports the operations we need
        console.log('\n📊 Test 10: Redis operation support');
        console.log('hset support:', typeof redis.hset === 'function' ? '✅ YES' : '❌ NO');
        console.log('hget support:', typeof redis.hget === 'function' ? '✅ YES' : '❌ NO');
        console.log('hlen support:', typeof redis.hlen === 'function' ? '✅ YES' : '❌ NO');
        console.log('hkeys support:', typeof redis.hkeys === 'function' ? '✅ YES' : '❌ NO');
        console.log('del support:', typeof redis.del === 'function' ? '✅ YES' : '❌ NO');
        
        // Summary
        console.log('\n📋 5D REDIS STORAGE DEBUG SUMMARY:');
        console.log('├─ Redis connection: ✅ OK');
        console.log('├─ Single storage: ' + (singleCount > 0 ? '✅ WORKING' : '❌ FAILED'));
        console.log('├─ Multiple storage: ' + (multipleCount >= 4 ? '✅ WORKING' : '❌ FAILED'));
        console.log('├─ Retrieval: Tested');
        console.log('└─ Memory usage: Checked');
        
        if (singleCount > 0 && multipleCount >= 4) {
            console.log('\n✅ 5D REDIS STORAGE: BASIC OPERATIONS WORKING!');
            console.log('🔧 The issue is likely in the preload function logic, not Redis itself.');
        } else {
            console.log('\n❌ 5D REDIS STORAGE: BASIC OPERATIONS FAILING!');
            console.log('🔧 There is a fundamental Redis storage issue.');
        }
        
    } catch (error) {
        console.error('❌ [5D_REDIS_DEBUG] Debug failed:', error.message);
        console.error(error.stack);
    }
}

// Run the debug
debug5DRedisStorage().then(() => {
    console.log('\n🏁 [5D_REDIS_DEBUG] Debug completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ [5D_REDIS_DEBUG] Debug failed:', error);
    process.exit(1);
}); 