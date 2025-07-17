const Redis = require('ioredis');

// TODO: Replace with your actual Redis endpoint
const redis = new Redis({
  host: 'strike-game-6c6utip.serverless.apse1.cache.amazonaws.com',
  port: 6379,
  // Uncomment the next line if your Redis requires TLS (encryption in transit)
  // tls: {}
});

redis.ping()
  .then(res => {
    console.log('Redis PING response:', res);
    process.exit(0);
  })
  .catch(err => {
    console.error('Redis connection error:', err);
    process.exit(1);
  }); 