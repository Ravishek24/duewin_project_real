let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }


// scripts/test-hot-games-cache.js
const axios = require('axios');
const { cacheService } = require('../services/cacheService');
require('dotenv').config();

// Get server configuration from environment
const SERVER_PORT = process.env.SERVER_PORT || 8000;
const SERVER_HOST = process.env.SERVER_HOST || 'localhost';
const BASE_URL = `http://${SERVER_HOST}:${SERVER_PORT}/api/seamless`;
const HOT_GAMES_CACHE_KEY = 'seamless:hot:games';

async function testHotGamesCache() {
  console.log('🧪 Testing Hot Games Cache Functionality\n');
  console.log(`🌐 Server URL: ${BASE_URL}`);
  console.log(`🔧 Server Port: ${SERVER_PORT}`);
  console.log(`🏠 Server Host: ${SERVER_HOST}\n`);

  try {
    // Test 1: Check initial cache status
    console.log('1️⃣ Checking initial cache status...');
    const initialCache = await cacheService.get(HOT_GAMES_CACHE_KEY);
    console.log('   Initial cache exists:', !!initialCache);
    if (initialCache) {
      console.log('   Cached games count:', initialCache.count);
      console.log('   Cached at:', initialCache.cachedAt);
    }

    // Test 2: First request (should fetch from provider and cache)
    console.log('\n2️⃣ Making first request to /hot-games...');
    
    // Check if we have a test token
    const testToken = process.env.TEST_TOKEN || 'YOUR_TEST_TOKEN_HERE';
    if (testToken === 'YOUR_TEST_TOKEN_HERE') {
      console.log('   ⚠️  No test token provided. Set TEST_TOKEN environment variable or update the script.');
      console.log('   Skipping HTTP request tests...');
    } else {
      const response1 = await axios.get(`${BASE_URL}/hot-games`, {
        headers: {
          'Authorization': `Bearer ${testToken}`
        },
        timeout: 10000 // 10 second timeout
      });

      console.log('   Response status:', response1.status);
      console.log('   From cache:', response1.data.fromCache);
      console.log('   Games count:', response1.data.count);
      console.log('   Cached at:', response1.data.cachedAt);

      // Test 3: Second request (should serve from cache)
      console.log('\n3️⃣ Making second request to /hot-games...');
      const response2 = await axios.get(`${BASE_URL}/hot-games`, {
        headers: {
          'Authorization': `Bearer ${testToken}`
        },
        timeout: 10000
      });

      console.log('   Response status:', response2.status);
      console.log('   From cache:', response2.data.fromCache);
      console.log('   Games count:', response2.data.count);
      console.log('   Cached at:', response2.data.cachedAt);

      // Test 4: Cache status endpoint (if admin token available)
      console.log('\n4️⃣ Testing cache status endpoint...');
      const adminToken = process.env.ADMIN_TOKEN || 'YOUR_ADMIN_TOKEN_HERE';
      if (adminToken !== 'YOUR_ADMIN_TOKEN_HERE') {
        try {
          const statusResponse = await axios.get(`${BASE_URL}/hot-games/cache-status`, {
            headers: {
              'Authorization': `Bearer ${adminToken}`
            },
            timeout: 10000
          });
          console.log('   Cache status:', statusResponse.data.cacheStatus);
        } catch (error) {
          console.log('   Cache status endpoint error:', error.response?.data?.message || error.message);
        }
      } else {
        console.log('   ⚠️  No admin token provided. Set ADMIN_TOKEN environment variable to test cache status.');
      }
    }

    // Test 5: Check cache TTL
    console.log('\n5️⃣ Checking cache TTL...');
    
    const ttl = await redis.ttl(HOT_GAMES_CACHE_KEY);
    console.log('   TTL (seconds):', ttl);
    console.log('   TTL (formatted):', ttl > 0 ? `${Math.floor(ttl / 3600)}h ${Math.floor((ttl % 3600) / 60)}m ${ttl % 60}s` : 'N/A');

    // Test 6: Test server health
    console.log('\n6️⃣ Testing server health...');
    try {
      const healthResponse = await axios.get(`http://${SERVER_HOST}:${SERVER_PORT}/health`, {
        timeout: 5000
      });
      console.log('   Server health:', healthResponse.data);
    } catch (error) {
      console.log('   Server health check failed:', error.message);
    }

    console.log('\n✅ Hot games cache test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }
    
    // Provide helpful debugging information
    console.log('\n🔧 Debugging Tips:');
    console.log('   1. Make sure the server is running on port', SERVER_PORT);
    console.log('   2. Check if Redis is running and accessible');
    console.log('   3. Set TEST_TOKEN environment variable for HTTP tests');
    console.log('   4. Set ADMIN_TOKEN environment variable for admin tests');
    console.log('   5. Check server logs for any errors');
  }
}

// Run the test
if (require.main === module) {
  testHotGamesCache();
}

module.exports = { testHotGamesCache }; 