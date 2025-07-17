// Backend/config/redisConfig.js
const { createClient } = require('redis');
const dotenv = require('dotenv');

dotenv.config();

// Build Redis URL from individual env vars if REDIS_URL is not set
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;
const redisDb = process.env.REDIS_DB || 0;
const redisPassword = process.env.REDIS_PASSWORD || undefined;

const redisUrl = process.env.REDIS_URL || `redis://${redisPassword ? ':' + redisPassword + '@' : ''}${redisHost}:${redisPort}/${redisDb}`;

// Redis client configuration
const redis = createClient({
  url: redisUrl,
  password: redisPassword,
  socket: {
    tls: true, // Enable TLS for ElastiCache
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

// Export both the client and a helper function to check connection
module.exports = {
  redis,
  isConnected: () => redis.isOpen
};