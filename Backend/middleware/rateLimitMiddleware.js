const RateLimitService = require('../services/rateLimitService');
const { isWhitelisted, whitelistedIPs } = require('../config/whitelist');

const rateLimitMiddleware = (limit = 3, timeWindow = 30 * 60 * 1000) => {
    return async (req, res, next) => {
        try {
            const ipAddress = req.ip || req.connection.remoteAddress;
            console.log('Rate Limit Check:', {
                ipAddress,
                whitelistedIPs,
                isWhitelisted: isWhitelisted(ipAddress)
            });

            // Skip rate limiting for whitelisted IPs
            if (isWhitelisted(ipAddress)) {
                console.log(`Skipping rate limit for whitelisted IP: ${ipAddress}`);
                return next();
            }

            // Temporarily bypass all rate limiting
            console.log('Rate limiting temporarily disabled for IP:', ipAddress);
            return next();
        } catch (error) {
            console.error('Rate limit middleware error:', error);
            next(error);
        }
    };
};

module.exports = rateLimitMiddleware; 