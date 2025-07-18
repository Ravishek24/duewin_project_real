// Backend/config/redis.js - Fix startup timing issue

const Redis = require('ioredis');
require('dotenv').config();
const { CACHE } = require('./constants');

console.log('REDIS_HOST from process.env:', process.env.REDIS_HOST);

// Redis configuration for ElastiCache with TLS - FIXED VERSION
const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: process.env.REDIS_DB || 0,
    keyPrefix: CACHE.PREFIX,
    
    // TLS configuration for ElastiCache
    tls: {
        rejectUnauthorized: false,
        requestCert: true,
        agent: false
    },
    
    retryStrategy: function(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    
    // FIX: Allow offline queue temporarily during startup
    enableOfflineQueue: true,  // Changed from false to true
    maxRetriesPerRequest: 3,
    
    // ElastiCache optimizations
    connectTimeout: 15000,
    commandTimeout: 5000,
    lazyConnect: false,  // Changed from true to false for immediate connection
    family: 4
};

console.log('Redis config for Strike Game ElastiCache:', {
    host: redisConfig.host,
    port: redisConfig.port,
    db: redisConfig.db,
    tls: 'enabled',
    keyPrefix: redisConfig.keyPrefix
});

// Create Redis client
const redisClient = new Redis(redisConfig);

// Enhanced connection event handlers
redisClient.on('connect', () => {
    console.log('✅ Strike Game Redis client connected to ElastiCache with TLS');
});

redisClient.on('error', (err) => {
    console.error('❌ Strike Game Redis client error:', err.message);
});

redisClient.on('ready', () => {
    console.log('✅ Strike Game Redis client ready');
    
    // DISABLE offline queue after connection is ready
    redisClient.options.enableOfflineQueue = false;
});

redisClient.on('end', () => {
    console.log('🔌 Strike Game Redis client connection closed');
});

// Wait for connection before testing
const waitForConnection = async () => {
    return new Promise((resolve, reject) => {
        if (redisClient.status === 'ready') {
            resolve();
            return;
        }
        
        redisClient.once('ready', resolve);
        redisClient.once('error', reject);
        
        // Timeout after 30 seconds
        setTimeout(() => reject(new Error('Connection timeout')), 30000);
    });
};

// Test ElastiCache connection after it's ready
(async () => {
    try {
        await waitForConnection();
        
        await redisClient.ping();
        console.log('✅ Strike Game ElastiCache connection test: SUCCESS');
        
        // Test set/get
        await redisClient.set('strike_test_key', 'ElastiCache Working!', 'EX', 60);
        const value = await redisClient.get('strike_test_key');
        console.log('✅ Strike Game ElastiCache set/get test:', value);
        
        // Clean up test key
        await redisClient.del('strike_test_key');
        
    } catch (err) {
        console.error('❌ Strike Game ElastiCache connection test: FAILED', err.message);
    }
})();

// Keep all your existing helper functions unchanged
const redisHelper = {
    async set(key, value, option = null, ttl = null, nx = null) {
        try {
            const stringValue = typeof value === 'object' ? JSON.stringify(value) : value;
            
            if (option === 'EX' && nx === 'NX') {
                const ttlSeconds = Math.floor(Number(ttl));
                if (isNaN(ttlSeconds) || ttlSeconds <= 0) {
                    throw new Error('Invalid TTL value. Must be a positive number.');
                }
                const result = await redisClient.set(key, stringValue, 'EX', ttlSeconds, 'NX');
                return result === 'OK';
            } else if (ttl) {
                const ttlSeconds = Math.floor(Number(ttl));
                if (isNaN(ttlSeconds) || ttlSeconds <= 0) {
                    throw new Error('Invalid TTL value. Must be a positive number.');
                }
                await redisClient.setex(key, ttlSeconds, stringValue);
                return true;
            } else {
                await redisClient.set(key, stringValue);
                return true;
            }
        } catch (error) {
            console.error('Redis set error:', error);
            throw error;
        }
    },

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

    async del(key) {
        try {
            await redisClient.del(key);
        } catch (error) {
            console.error('Redis del error:', error);
            throw error;
        }
    },

    async exists(key) {
        try {
            const result = await redisClient.exists(key);
            return result === 1;
        } catch (error) {
            console.error('Redis exists error:', error);
            throw error;
        }
    },

    async expire(key, ttl) {
        try {
            await redisClient.expire(key, ttl);
        } catch (error) {
            console.error('Redis expire error:', error);
            throw error;
        }
    },

    async incr(key, increment = 1) {
        try {
            return await redisClient.incrby(key, increment);
        } catch (error) {
            console.error('Redis incr error:', error);
            throw error;
        }
    },

    async decr(key, decrement = 1) {
        try {
            return await redisClient.decrby(key, decrement);
        } catch (error) {
            console.error('Redis decr error:', error);
            throw error;
        }
    },

    getClient() {
        return redisClient;
    }
};

module.exports = redisHelper;