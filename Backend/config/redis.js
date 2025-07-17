const Redis = require('ioredis');
const { CACHE } = require('./constants');

// Redis configuration
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: process.env.REDIS_DB || 0,
    keyPrefix: CACHE.PREFIX,
    retryStrategy: function(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    }
};

// Create Redis client
const redisClient = new Redis(redisConfig);

// Handle Redis connection events
redisClient.on('connect', () => {
    console.log('Redis client connected');
});

redisClient.on('error', (err) => {
    console.error('Redis client error:', err);
});

redisClient.on('ready', () => {
    console.log('Redis client ready');
});

redisClient.on('end', () => {
    console.log('Redis client connection closed');
});

// Helper functions for Redis operations
const redisHelper = {
    /**
     * Set a key-value pair in Redis with optional expiration
     * @param {string} key - Redis key
     * @param {string|number|object} value - Value to store
     * @param {string} [option] - Redis option (e.g., 'EX', 'NX')
     * @param {number} [ttl] - Time to live in seconds
     * @param {string} [nx] - NX option for SET
     * @returns {Promise<boolean>} - Whether the operation was successful
     */
    async set(key, value, option = null, ttl = null, nx = null) {
        try {
            const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
            
            if (option === 'EX' && nx === 'NX') {
                // Ensure ttl is a valid integer
                const ttlSeconds = Math.floor(Number(ttl));
                if (isNaN(ttlSeconds) || ttlSeconds <= 0) {
                    throw new Error('Invalid TTL value. Must be a positive number.');
                }
                // Use SET with EX and NX options
                const result = await redisClient.set(key, stringValue, 'EX', ttlSeconds, 'NX');
                return result === 'OK';
            } else if (ttl) {
                // Simple SETEX
                const ttlSeconds = Math.floor(Number(ttl));
                if (isNaN(ttlSeconds) || ttlSeconds <= 0) {
                    throw new Error('Invalid TTL value. Must be a positive number.');
                }
                await redisClient.setex(key, ttlSeconds, stringValue);
                return true;
            } else {
                // Simple SET
                await redisClient.set(key, stringValue);
                return true;
            }
        } catch (error) {
            console.error('Redis set error:', error);
            throw error;
        }
    },

    /**
     * Get a value from Redis by key
     * @param {string} key - Redis key
     * @returns {Promise<string|object|null>}
     */
    async get(key) {
        try {
            const value = await redisClient.get(key);
            if (!value) return null;
            try {
                return JSON.parse(value);
            } catch {
                return value;
            }
        } catch (error) {
            console.error('Redis get error:', error);
            throw error;
        }
    },

    /**
     * Delete a key from Redis
     * @param {string} key - Redis key
     * @returns {Promise<void>}
     */
    async del(key) {
        try {
            await redisClient.del(key);
        } catch (error) {
            console.error('Redis del error:', error);
            throw error;
        }
    },

    /**
     * Check if a key exists in Redis
     * @param {string} key - Redis key
     * @returns {Promise<boolean>}
     */
    async exists(key) {
        try {
            const result = await redisClient.exists(key);
            return result === 1;
        } catch (error) {
            console.error('Redis exists error:', error);
            throw error;
        }
    },

    /**
     * Set key expiration time
     * @param {string} key - Redis key
     * @param {number} ttl - Time to live in seconds
     * @returns {Promise<void>}
     */
    async expire(key, ttl) {
        try {
            await redisClient.expire(key, ttl);
        } catch (error) {
            console.error('Redis expire error:', error);
            throw error;
        }
    },

    /**
     * Increment a counter
     * @param {string} key - Redis key
     * @param {number} [increment=1] - Increment value
     * @returns {Promise<number>}
     */
    async incr(key, increment = 1) {
        try {
            return await redisClient.incrby(key, increment);
        } catch (error) {
            console.error('Redis incr error:', error);
            throw error;
        }
    },

    /**
     * Decrement a counter
     * @param {string} key - Redis key
     * @param {number} [decrement=1] - Decrement value
     * @returns {Promise<number>}
     */
    async decr(key, decrement = 1) {
        try {
            return await redisClient.decrby(key, decrement);
        } catch (error) {
            console.error('Redis decr error:', error);
            throw error;
        }
    },

    /**
     * Get Redis client instance
     * @returns {Redis}
     */
    getClient() {
        return redisClient;
    }
};

// Elasticache connection test (safe to remove after verification)
(async () => {
  try {
    await redisClient.set('elasticache_test_key_12345', 'hello-from-elasticache', 'EX', 300);
    const value = await redisClient.get('elasticache_test_key_12345');
    console.log('Elasticache test value:', value);
  } catch (err) {
    console.error('Elasticache test error:', err);
  }
})();

module.exports = redisHelper; 