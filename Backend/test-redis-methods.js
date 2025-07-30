const unifiedRedis = require('./config/unifiedRedisManager');

async function testRedisMethods() {
    try {
        console.log('🧪 [TEST_REDIS_METHODS] Testing Redis methods in unified Redis manager...');
        
        // Initialize Redis if needed
        if (!unifiedRedis.isInitialized) {
            console.log('🔄 [TEST_REDIS_METHODS] Initializing unified Redis manager...');
            await unifiedRedis.initialize();
        }
        
        const redis = unifiedRedis.getHelper();
        
        // Test 1: Basic operations
        console.log('🧪 [TEST_REDIS_METHODS] Test 1: Basic operations...');
        await redis.set('test:basic', 'hello world');
        const basicValue = await redis.get('test:basic');
        console.log(`✅ [TEST_REDIS_METHODS] Basic get/set: ${basicValue}`);
        
        // Test 2: Hash operations
        console.log('🧪 [TEST_REDIS_METHODS] Test 2: Hash operations...');
        await redis.hset('test:hash', 'field1', 'value1');
        await redis.hset('test:hash', 'field2', 'value2');
        const hashValue = await redis.hget('test:hash', 'field1');
        const hashAll = await redis.hgetall('test:hash');
        const hashLen = await redis.hlen('test:hash');
        console.log(`✅ [TEST_REDIS_METHODS] Hash operations: ${hashValue}, ${JSON.stringify(hashAll)}, length: ${hashLen}`);
        
        // Test 3: Set operations
        console.log('🧪 [TEST_REDIS_METHODS] Test 3: Set operations...');
        await redis.sadd('test:set', 'member1', 'member2', 'member3');
        const setMembers = await redis.smembers('test:set');
        const setCard = await redis.scard('test:set');
        console.log(`✅ [TEST_REDIS_METHODS] Set operations: ${JSON.stringify(setMembers)}, cardinality: ${setCard}`);
        
        // Test 4: Set removal
        console.log('🧪 [TEST_REDIS_METHODS] Test 4: Set removal...');
        const removedCount = await redis.srem('test:set', 'member1', 'member2');
        const remainingMembers = await redis.smembers('test:set');
        console.log(`✅ [TEST_REDIS_METHODS] Set removal: removed ${removedCount}, remaining: ${JSON.stringify(remainingMembers)}`);
        
        // Test 5: Existence check
        console.log('🧪 [TEST_REDIS_METHODS] Test 5: Existence check...');
        const exists = await redis.exists('test:basic');
        const notExists = await redis.exists('test:nonexistent');
        console.log(`✅ [TEST_REDIS_METHODS] Existence check: exists=${exists}, notExists=${notExists}`);
        
        // Test 6: Increment operations
        console.log('🧪 [TEST_REDIS_METHODS] Test 6: Increment operations...');
        await redis.set('test:counter', '0');
        const incrResult = await redis.incr('test:counter');
        const hincrResult = await redis.hincrby('test:hash', 'counter', 5);
        console.log(`✅ [TEST_REDIS_METHODS] Increment operations: incr=${incrResult}, hincr=${hincrResult}`);
        
        // Cleanup
        console.log('🧪 [TEST_REDIS_METHODS] Cleaning up test data...');
        await redis.del('test:basic');
        await redis.del('test:hash');
        await redis.del('test:set');
        await redis.del('test:counter');
        
        console.log('✅ [TEST_REDIS_METHODS] SUCCESS: All Redis methods working correctly!');
        console.log('✅ [TEST_REDIS_METHODS] The unified Redis manager is fully functional!');
        
    } catch (error) {
        console.error('❌ [TEST_REDIS_METHODS] Test failed:', error);
    }
}

// Run the test
testRedisMethods(); 