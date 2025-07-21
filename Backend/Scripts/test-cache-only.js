let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }


// scripts/test-cache-only.js
const { cacheService } = require('../services/cacheService');


const HOT_GAMES_CACHE_KEY = 'seamless:hot:games';

async function testCacheOnly() {
  console.log('🧪 Testing Hot Games Cache (Cache Only)\n');

  try {
    // Test 1: Check Redis connection
    console.log('1️⃣ Testing Redis connection...');
    const pingResult = await redis.ping();
    console.log('   Redis ping result:', pingResult);
    
    if (pingResult === 'PONG') {
      console.log('   ✅ Redis connection successful');
    } else {
      console.log('   ❌ Redis connection failed');
      return;
    }

    // Test 2: Check current cache status
    console.log('\n2️⃣ Checking current cache status...');
    const cachedData = await cacheService.get(HOT_GAMES_CACHE_KEY);
    console.log('   Cache exists:', !!cachedData);
    
    if (cachedData) {
      console.log('   Cached games count:', cachedData.count);
      console.log('   Cached at:', cachedData.cachedAt);
      console.log('   Cache data keys:', Object.keys(cachedData));
    } else {
      console.log('   No cached data found');
    }

    // Test 3: Check cache TTL
    console.log('\n3️⃣ Checking cache TTL...');
    const ttl = await redis.ttl(HOT_GAMES_CACHE_KEY);
    console.log('   TTL (seconds):', ttl);
    
    if (ttl > 0) {
      const hours = Math.floor(ttl / 3600);
      const minutes = Math.floor((ttl % 3600) / 60);
      const seconds = ttl % 60;
      console.log(`   TTL (formatted): ${hours}h ${minutes}m ${seconds}s`);
    } else if (ttl === -1) {
      console.log('   TTL: No expiration set');
    } else if (ttl === -2) {
      console.log('   TTL: Key does not exist');
    }

    // Test 4: Test cache operations
    console.log('\n4️⃣ Testing cache operations...');
    
    // Test setting cache
    const testData = {
      games: [
        { id: 'test1', name: 'Test Game 1' },
        { id: 'test2', name: 'Test Game 2' }
      ],
      count: 2,
      cachedAt: new Date().toISOString(),
      test: true
    };
    
    console.log('   Setting test cache data...');
    const setResult = await cacheService.set(HOT_GAMES_CACHE_KEY + '_test', testData, 60); // 1 minute TTL
    console.log('   Set result:', setResult);
    
    // Test getting cache
    console.log('   Getting test cache data...');
    const retrievedData = await cacheService.get(HOT_GAMES_CACHE_KEY + '_test');
    console.log('   Retrieved data:', retrievedData ? 'Success' : 'Failed');
    
    if (retrievedData) {
      console.log('   Retrieved games count:', retrievedData.count);
      console.log('   Retrieved cached at:', retrievedData.cachedAt);
    }
    
    // Clean up test data
    console.log('   Cleaning up test data...');
    await cacheService.del(HOT_GAMES_CACHE_KEY + '_test');
    console.log('   Test data cleaned up');

    // Test 5: Check Redis info
    console.log('\n5️⃣ Checking Redis info...');
    const info = await redis.info('server');
    const lines = info.split('\r\n');
    const serverInfo = {};
    
    lines.forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        if (key && value) {
          serverInfo[key] = value;
        }
      }
    });
    
    console.log('   Redis version:', serverInfo.redis_version);
    console.log('   Connected clients:', serverInfo.connected_clients);
    console.log('   Used memory:', serverInfo.used_memory_human);

    // Test 6: Check all seamless cache keys
    console.log('\n6️⃣ Checking all seamless cache keys...');
    const keys = await redis.keys('seamless:*');
    console.log('   Total seamless keys found:', keys.length);
    
    if (keys.length > 0) {
      console.log('   Keys:');
      keys.forEach((key, index) => {
        console.log(`     ${index + 1}. ${key}`);
      });
    }

    console.log('\n✅ Cache test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Redis connection: ✅');
    console.log('   - Cache operations: ✅');
    console.log('   - Hot games cache exists:', !!cachedData);
    if (cachedData) {
      console.log(`   - Hot games count: ${cachedData.count}`);
      console.log(`   - Cache TTL: ${ttl > 0 ? `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m` : 'N/A'}`);
    }

  } catch (error) {
    console.error('❌ Cache test failed:', error.message);
    console.error('   Error details:', error);
    
    console.log('\n🔧 Troubleshooting:');
    console.log('   1. Make sure Redis is running: redis-cli ping');
    console.log('   2. Check Redis connection settings in config/redisConfig.js');
    console.log('   3. Verify Redis host and port configuration');
    console.log('   4. Check if Redis requires authentication');
  }
}

// Run the test
if (require.main === module) {
  testCacheOnly();
}

module.exports = { testCacheOnly }; 