const Redis = require('ioredis');
require('dotenv').config();

const redis = new Redis({
  host: process.env.REDIS_HOST || 'YOUR_ELASTICACHE_ENDPOINT',
  port: 6379,
  tls: {}
});

redis.on('connect', () => console.log('Publisher connected'));
redis.on('error', err => console.error('Publisher error:', err));

setInterval(() => {
  const msg = `Test message at ${new Date().toISOString()}`;
  redis.publish('test_channel', msg).then(count => {
    console.log(`Published: "${msg}" to ${count} subscribers`);
  });
}, 2000); 