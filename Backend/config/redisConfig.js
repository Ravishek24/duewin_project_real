// Backend/config/redisConfig.js
const { createClient } = require('redis');
const dotenv = require('dotenv');

dotenv.config();

// Redis client configuration
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  password: process.env.REDIS_PASSWORD || undefined,
  socket: {
    reconnectStrategy: (retries) => {
      // Exponential backoff with maximum delay
      const delay = Math.min(Math.pow(2, retries) * 100, 3000);
      return delay;
    }
  }
});

// Connect to Redis when this module is imported
(async () => {
  try {
    await redis.connect();
    console.log('✅ Redis connected successfully');
    
    // Set up Redis error handling
    redis.on('error', (err) => {
      console.error('❌ Redis error:', err);
    });
    
    redis.on('reconnecting', () => {
      console.log('⚠️ Redis reconnecting...');
    });
    
  } catch (error) {
    console.error('❌ Redis connection error:', error.message);
    // Don't exit process, allow for graceful fallback
  }
})();

module.exports = {
  redis,
  redisClient
};