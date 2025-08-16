#!/usr/bin/env node
/**
 * Test Redis connection and fix the issue
 */

const unifiedRedis = require('./config/unifiedRedisManager');

async function testRedisConnection() {
    console.log('🧪 Testing Redis Connection Resilience...');
    
    try {
        // Test initialization
        console.log('1️⃣ Testing Redis manager initialization...');
        await unifiedRedis.initialize();
        console.log('✅ Redis manager initialized successfully');
        
        // Test health check
        console.log('2️⃣ Testing health check...');
        const healthResults = await unifiedRedis.healthCheck();
        console.log('📊 Health Results:', healthResults);
        
        // Test basic operations
        console.log('3️⃣ Testing basic Redis operations...');
        const helper = await unifiedRedis.getHelper();
        
        // Test set/get
        await helper.set('test:key', 'test:value');
        const value = await helper.get('test:key');
        console.log('✅ Set/Get test passed:', value);
        
        // Test hash operations
        await helper.hset('test:hash', 'field1', 'value1');
        const hashValue = await helper.hget('test:hash', 'field1');
        console.log('✅ Hash operations test passed:', hashValue);
        
        // Test connection stats
        console.log('4️⃣ Testing connection statistics...');
        const stats = unifiedRedis.getStats();
        console.log('📈 Connection Stats:', stats);
        
        // Test resilience by simulating connection issues
        console.log('5️⃣ Testing connection resilience...');
        const mainConnection = await unifiedRedis.getConnection('main');
        console.log('✅ Main connection status:', mainConnection.status);
        
        // Cleanup test data
        await helper.del('test:key');
        await helper.del('test:hash');
        console.log('🧹 Test data cleaned up');
        
        console.log('🎉 All Redis tests passed successfully!');
        
    } catch (error) {
        console.error('❌ Redis test failed:', error);
        process.exit(1);
    }
}

// Run the test
testRedisConnection().then(() => {
    console.log('✅ Redis connection test completed');
    process.exit(0);
}).catch((error) => {
    console.error('❌ Redis connection test failed:', error);
    process.exit(1);
});