const Redis = require('ioredis');
require('dotenv').config();

const redis = new Redis({
  host: process.env.REDIS_HOST || 'strike-game-66utip.serverless.apse1.cache.amazonaws.com',
  port: 6379,
  tls: {}
});

redis.on('connect', () => console.log('Subscriber connected'));
redis.on('error', err => console.error('Subscriber error:', err));

redis.subscribe('test_channel', (err, count) => {
  if (err) {
    console.error('Subscribe error:', err);
    return;
  }
  console.log('Subscribed to test_channel');
});

redis.on('message', (channel, message) => {
  console.log(`Received on ${channel}: ${message}`);
}); 