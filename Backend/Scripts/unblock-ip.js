const { RateLimitViolation } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const redis = require('redis');
const { promisify } = require('util');

async function unblockIP(ipAddress) {
    let redisClient = null;
    
    try {
        // 1. Clear database-based rate limits
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
        
        const result = await RateLimitViolation.update(
            {
                is_blocked: false,
                unblocked_at: new Date(),
                unblocked_by: 1 // System admin ID
            },
            {
                where: {
                    ip_address: ipAddress,
                    [Op.or]: [
                        { is_blocked: true },
                        { last_violation_at: { [Op.gte]: thirtyMinutesAgo } }
                    ]
                }
            }
        );

        console.log(`Successfully unblocked IP in database: ${ipAddress}`);
        console.log(`Updated ${result[0]} records`);

        // Delete recent violations
        const deleteResult = await RateLimitViolation.destroy({
            where: {
                ip_address: ipAddress,
                last_violation_at: { [Op.gte]: thirtyMinutesAgo }
            }
        });

        console.log(`Deleted ${deleteResult} recent violation records`);

        // 2. Clear express-rate-limit records
        try {
            redisClient = redis.createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379'
            });

            await redisClient.connect();
            
            // Clear both global and auth rate limiters
            const keys = [
                `rl:${ipAddress}`, // Global rate limiter
                `rl:auth:${ipAddress}` // Auth rate limiter
            ];
            
            for (const key of keys) {
                await redisClient.del(key);
            }
            
            console.log(`Successfully cleared express-rate-limit records for IP: ${ipAddress}`);
        } catch (redisError) {
            console.log('Note: Redis not available, skipping express-rate-limit cleanup');
            console.error('Redis error:', redisError.message);
        } finally {
            if (redisClient) {
                await redisClient.quit();
            }
        }
    } catch (error) {
        console.error('Error unblocking IP:', error);
        throw error;
    }
}

// Get IP from command line argument
const ipAddress = process.argv[2];
if (!ipAddress) {
    console.error('Please provide an IP address as an argument');
    process.exit(1);
}

unblockIP(ipAddress)
    .then(() => process.exit(0))
    .catch(() => process.exit(1)); 