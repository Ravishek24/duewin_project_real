/**
 * Simple ElastiCache Redis Connection Test
 * This script tests Redis connection with minimal configuration
 */

require('dotenv').config();
const Redis = require('ioredis');

async function testElastiCacheRedis() {
  console.log('🧪 Testing ElastiCache Redis Connection...');
  console.log('==========================================');
  
  const config = {
    host: process.env.REDIS_HOST || 'master.strike-game-redis.66utip.apse1.cache.amazonaws.com',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: process.env.REDIS_DB || 0,
    
    // Minimal TLS configuration
    tls: {
      rejectUnauthorized: false,
      requestCert: false,
      agent: false
    },
    
    // Connection settings
    connectTimeout: 30000,
    commandTimeout: 30000,
    lazyConnect: false,
    enableOfflineQueue: true,
    maxRetriesPerRequest: null,
    
    // Retry strategy
    retryStrategy: (times) => {
      const delay = Math.min(times * 1000, 5000);
      console.log(`🔄 Retry attempt ${times}, waiting ${delay}ms...`);
      return delay;
    }
  };
  
  console.log('📋 Configuration:', {
    host: config.host,
    port: config.port,
    hasPassword: !!config.password,
    db: config.db,
    tls: 'enabled'
  });
  
  try {
    console.log('\n🔄 Creating Redis connection...');
    const redis = new Redis(config);
    
    // Wait for connection
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout after 30 seconds'));
      }, 30000);
      
      redis.once('connect', () => {
        console.log('✅ Redis connected');
        clearTimeout(timeout);
        resolve();
      });
      
      redis.once('ready', () => {
        console.log('🚀 Redis ready');
      });
      
      redis.once('error', (error) => {
        console.error('❌ Redis error:', error.message);
        clearTimeout(timeout);
        reject(error);
      });
    });
    
    // Test ping
    console.log('\n🏓 Testing Redis ping...');
    const pingResult = await redis.ping();
    console.log(`✅ Ping successful: ${pingResult}`);
    
    // Test basic operations
    console.log('\n📝 Testing basic operations...');
    await redis.set('test:elasticache', 'success', 'EX', 60);
    const testValue = await redis.get('test:elasticache');
    console.log(`✅ Set/Get test: ${testValue}`);
    
    // Cleanup
    await redis.del('test:elasticache');
    console.log('🧹 Test cleanup completed');
    
    // Close connection
    await redis.quit();
    console.log('🔌 Connection closed');
    
    console.log('\n🎉 ElastiCache Redis test PASSED!');
    
  } catch (error) {
    console.error('\n❌ ElastiCache Redis test FAILED!');
    console.error('Error:', error.message);
    
    console.log('\n🔍 Troubleshooting Tips:');
    console.log('1. Check ElastiCache security group allows your IP');
    console.log('2. Verify ElastiCache endpoint is correct');
    console.log('3. Ensure ElastiCache cluster is running');
    console.log('4. Check if password is required');
    console.log('5. Verify VPC routing configuration');
    
    process.exit(1);
  }
}

// Run the test
testElastiCacheRedis();
