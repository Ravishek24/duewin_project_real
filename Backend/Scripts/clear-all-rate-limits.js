let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }


const { RateLimitViolation } = require('../models');
const { Op } = require('sequelize');

const logger = require('../utils/logger');

async function clearAllRateLimits(ipAddress) {
    let redisClient = null;
    
    try {
        // 1. Clear database records
        console.log('Clearing database records...');
        const dbResult = await RateLimitViolation.destroy({
            where: {
                ip_address: ipAddress
            }
        });
        console.log(`Deleted ${dbResult} records from database`);

        // 2. Clear Redis records
        console.log('Clearing Redis records...');
        redisClient = 

        await redisClient.connect();
        
        // Clear all possible rate limit keys
        const keyPatterns = [
            `rl:${ipAddress}`, // Global rate limiter
            `rl:auth:${ipAddress}`, // Auth rate limiter
            `rl:signup:${ipAddress}`, // Signup rate limiter
            `rl:login:${ipAddress}`, // Login rate limiter
            `rl:profile:${ipAddress}`, // Profile rate limiter
            `rl:wallet:${ipAddress}`, // Wallet rate limiter
            `rl:game:${ipAddress}`, // Game rate limiter
            `rl:otp:${ipAddress}`, // OTP rate limiter
            `rl:*:${ipAddress}`, // Any other rate limit keys
            `rl:auth:*:${ipAddress}`, // Any other auth rate limit keys
            `rl:signup:*:${ipAddress}`, // Any other signup rate limit keys
            `rl:login:*:${ipAddress}`, // Any other login rate limit keys
            `rl:profile:*:${ipAddress}`, // Any other profile rate limit keys
            `rl:wallet:*:${ipAddress}`, // Any other wallet rate limit keys
            `rl:game:*:${ipAddress}`, // Any other game rate limit keys
            `rl:otp:*:${ipAddress}` // Any other OTP rate limit keys
        ];
        
        let deletedCount = 0;
        for (const pattern of keyPatterns) {
            const keys = await redisClient.keys(pattern);
            if (keys.length > 0) {
                await redisClient.del(keys);
                deletedCount += keys.length;
            }
        }
        
        console.log(`Deleted ${deletedCount} records from Redis`);

        // 3. Verify whitelist
        console.log('\nVerifying whitelist status...');
        const { isWhitelisted } = require('../config/whitelist');
        const isWhitelistedIP = isWhitelisted(ipAddress);
        console.log(`IP ${ipAddress} is ${isWhitelistedIP ? 'whitelisted' : 'not whitelisted'}`);

        console.log('\nSuccessfully cleared all rate limit records for IP:', ipAddress);
    } catch (error) {
        console.error('Error clearing rate limits:', error);
        throw error;
    } finally {
        if (redisClient) {
            await redisClient.quit();
        }
    }
}

// Get IP from command line argument
const ipAddress = process.argv[2];
if (!ipAddress) {
    console.error('Please provide an IP address as an argument');
    process.exit(1);
}

clearAllRateLimits(ipAddress)
    .then(() => process.exit(0))
    .catch(() => process.exit(1)); 
module.exports = { setRedisHelper };
