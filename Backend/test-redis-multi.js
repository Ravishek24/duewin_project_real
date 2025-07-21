let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }


require('dotenv').config();
const os = require('os');
const dns = require('dns');


const REDIS_HOST = process.env.REDIS_HOST || 'strike-game-66utip.serverless.apse1.cache.amazonaws.com';
const REDIS_PORT = process.env.REDIS_PORT || 6379;

//console.log('--- Redis Connectivity Test ---');
console.log('Instance Hostname:', os.hostname());
console.log('Testing Redis endpoint:', REDIS_HOST + ':' + REDIS_PORT);

console.log('Performing Node.js DNS lookup...');
dns.lookup(REDIS_HOST, async (err, address, family) => {
  if (err) {
    console.error('Node.js DNS lookup failed:', err.message);
  } else {
    console.log('Node.js DNS lookup result:', address, 'Family:', family);
  }

  const redis = 

  redis.on('error', (e) => {
    console.error('Redis client error:', e.message);
  });

  try {
    await redis.set('scheduler-test-key', 'hello');
    const val = await redis.get('scheduler-test-key');
    console.log('Scheduler Redis test value:', val);
  } catch (e) {
    console.error('Redis write/read test failed:', e.message);
  }

  try {
    const pingRes = await redis.ping();
    console.log('SUCCESS: Connected to Redis! PING response:', pingRes);
  } catch (err) {
    console.error('FAILURE: Could not connect to Redis.');
    console.error('Error:', err.message);
  }
  process.exit(0);
});
module.exports = { setRedisHelper };
