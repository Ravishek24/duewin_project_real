/**
 * ElastiCache Connectivity Test
 * This script tests network connectivity to AWS ElastiCache
 */

require('dotenv').config();
const dns = require('dns').promises;
const net = require('net');

async function testElastiCacheConnectivity() {
  console.log('🔍 Testing ElastiCache Connectivity...');
  console.log('=====================================');
  
  const redisHost = process.env.REDIS_HOST || 'master.strike-game-redis.66utip.apse1.cache.amazonaws.com';
  const redisPort = process.env.REDIS_PORT || 6379;
  
  console.log(`📍 Target: ${redisHost}:${redisPort}`);
  console.log('');
  
  try {
    // Test 1: DNS Resolution
    console.log('1️⃣ Testing DNS Resolution...');
    try {
      const addresses = await dns.resolve4(redisHost);
      console.log(`✅ DNS Resolution: ${addresses.join(', ')}`);
    } catch (error) {
      console.error(`❌ DNS Resolution Failed: ${error.message}`);
      return;
    }
    
    // Test 2: Port Connectivity
    console.log('\n2️⃣ Testing Port Connectivity...');
    await testPortConnectivity(redisHost, redisPort);
    
    // Test 3: TLS Handshake (simulated)
    console.log('\n3️⃣ Testing TLS Configuration...');
    console.log('   TLS will be tested when Redis connection is attempted');
    
    // Test 4: Network Latency
    console.log('\n4️⃣ Testing Network Latency...');
    await testNetworkLatency(redisHost);
    
    console.log('\n🎯 Next Steps:');
    console.log('   If all tests pass, the issue might be with:');
    console.log('   - Redis authentication (password)');
    console.log('   - TLS handshake configuration');
    console.log('   - ElastiCache cluster status');
    
  } catch (error) {
    console.error('❌ Connectivity test failed:', error.message);
  }
}

async function testPortConnectivity(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 10000; // 10 seconds
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      console.log(`✅ Port ${port} is reachable`);
      socket.destroy();
      resolve();
    });
    
    socket.on('timeout', () => {
      console.error(`⏰ Port ${port} connection timeout`);
      socket.destroy();
      resolve();
    });
    
    socket.on('error', (error) => {
      console.error(`❌ Port ${port} connection error: ${error.message}`);
      resolve();
    });
    
    socket.connect(port, host);
  });
}

async function testNetworkLatency(host) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    const timeout = 10000;
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      const latency = Date.now() - start;
      console.log(`✅ Network latency: ${latency}ms`);
      socket.destroy();
      resolve();
    });
    
    socket.on('timeout', () => {
      console.error(`⏰ Network test timeout`);
      socket.destroy();
      resolve();
    });
    
    socket.on('error', (error) => {
      console.error(`❌ Network test error: ${error.message}`);
      resolve();
    });
    
    socket.connect(6379, host);
  });
}

// Run the test
testElastiCacheConnectivity();
