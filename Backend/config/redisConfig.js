const { createClient } = require('redis');
const dotenv = require('dotenv');

dotenv.config();

// Build connection parameters for ElastiCache with TLS
const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;
const redisDb = process.env.REDIS_DB || 0;
const redisPassword = process.env.REDIS_PASSWORD || undefined;

console.log('Strike Game Redis Config:', {
    host: redisHost,
    port: redisPort,
    db: redisDb,
    tls: 'enabled'
});

// TLS-enabled Redis client for ElastiCache
const redis = createClient({
    socket: {
        host: redisHost,
        port: redisPort,
        
        // TLS configuration for ElastiCache
        tls: true,
        rejectUnauthorized: false,
        checkServerIdentity: () => undefined,
        
        reconnectStrategy: (retries) => {
            const delay = Math.min(Math.pow(2, retries) * 100, 3000);
            console.log(`🔄 Strike Game Redis reconnecting in ${delay}ms (attempt ${retries})`);
            return delay;
        },
        
        connectTimeout: 15000,
        family: 4 // Force IPv4
    },
    password: redisPassword,
    database: redisDb
});

// Connect to ElastiCache
(async () => {
    try {
        await redis.connect();
        console.log('✅ Strike Game Redis connected to ElastiCache with TLS');
        
        // Test connection
        const pingResult = await redis.ping();
        console.log('✅ Strike Game Redis PING result:', pingResult);
        
        redis.on('error', (err) => {
            console.error('❌ Strike Game Redis error:', err.message);
        });
        
        redis.on('reconnecting', () => {
            console.log('⚠️ Strike Game Redis reconnecting to ElastiCache...');
        });
        
    } catch (error) {
        console.error('❌ Strike Game Redis connection error:', error.message);
        console.error('🔧 Check: Security groups, VPC settings, and TLS configuration');
    }
})();

module.exports = {
    redis,
    isConnected: () => redis.isOpen
};