/**
 * Simple Redis Connection Test
 * This script tests the Redis connection before starting the workers
 */

require('dotenv').config();
const unifiedRedis = require('./config/unifiedRedisManager');

async function testRedisConnection() {
  console.log('🧪 Testing Redis Connection...');
  console.log('================================');
  
  try {
    // Initialize Redis manager
    console.log('🔄 Initializing Redis manager...');
    await unifiedRedis.initialize();
    
    // Get connection
    console.log('🔌 Getting Redis connection...');
    const connection = await unifiedRedis.getConnection('main');
    
    if (!connection) {
      throw new Error('Failed to get Redis connection');
    }
    
    // Test ping
    console.log('🏓 Testing Redis ping...');
    const pingResult = await connection.ping();
    console.log(`✅ Redis ping successful: ${pingResult}`);
    
    // Test basic operations
    console.log('📝 Testing basic Redis operations...');
    await connection.set('test:connection', 'success', 'EX', 60);
    const testValue = await connection.get('test:connection');
    console.log(`✅ Redis set/get test successful: ${testValue}`);
    
    // Cleanup
    await connection.del('test:connection');
    console.log('🧹 Test cleanup completed');
    
    console.log('🎉 Redis connection test PASSED!');
    console.log('   Your Redis configuration is working correctly');
    
  } catch (error) {
    console.error('❌ Redis connection test FAILED!');
    console.error('   Error:', error.message);
    console.error('   Stack:', error.stack);
    
    // Show current configuration
    console.log('\n📋 Current Redis Configuration:');
    console.log('   REDIS_HOST:', process.env.REDIS_HOST || 'localhost (default)');
    console.log('   REDIS_PORT:', process.env.REDIS_PORT || '6379 (default)');
    console.log('   REDIS_PASSWORD:', process.env.REDIS_PASSWORD ? '***' : 'none');
    console.log('   REDIS_DB:', process.env.REDIS_DB || '0 (default)');
    
    process.exit(1);
  }
}

// Run the test
testRedisConnection();
