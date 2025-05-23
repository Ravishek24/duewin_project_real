const { RateLimitViolation } = require('../models');
const { Op } = require('sequelize');
const redis = require('redis');
const logger = require('../utils/logger');

async function clearBlockedIP(ipAddress) {
    try {
        // 1. Clear from database
        console.log('Clearing database records...');
        const dbResult = await RateLimitViolation.destroy({
            where: {
                ip_address: ipAddress
            }
        });
        console.log(`Deleted ${dbResult} records from database`);

        // 2. Clear from Redis
        console.log('Clearing Redis records...');
        const redisClient = redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });

        await redisClient.connect();
        
        // Clear both global and auth rate limiters
        const keys = [
            `rl:${ipAddress}`, // Global rate limiter
            `rl:auth:${ipAddress}`, // Auth rate limiter
            `rl:${ipAddress}:*`, // Any other rate limit keys
            `rl:auth:${ipAddress}:*` // Any other auth rate limit keys
        ];
        
        let deletedCount = 0;
        for (const key of keys) {
            const keys = await redisClient.keys(key);
            if (keys.length > 0) {
                await redisClient.del(keys);
                deletedCount += keys.length;
            }
        }
        
        console.log(`Deleted ${deletedCount} records from Redis`);
        await redisClient.quit();

        console.log(`Successfully cleared all records for IP: ${ipAddress}`);
    } catch (error) {
        console.error('Error clearing blocked IP:', error);
        throw error;
    }
}

// Get IP from command line argument
const ipAddress = process.argv[2];
if (!ipAddress) {
    console.error('Please provide an IP address as an argument');
    process.exit(1);
}

clearBlockedIP(ipAddress)
    .then(() => process.exit(0))
    .catch(() => process.exit(1)); 