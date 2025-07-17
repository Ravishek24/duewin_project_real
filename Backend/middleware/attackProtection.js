const securityConfig = require('../config/securityConfig');
// const Redis = require('ioredis');
const redisHelper = require('../config/redis');

// Use the singleton Redis client from redisHelper
const redis = redisHelper.getClient();

/**
 * Advanced Attack Protection Middleware
 * Detects and blocks various types of attacks
 */
const attackProtection = (req, res, next) => {
    try {
        if (!securityConfig.attackDetection.enabled) {
            return next();
        }

        const clientIP = req.headers['x-forwarded-for'] || 
                        req.headers['x-real-ip'] || 
                        req.connection.remoteAddress;
        
        const ipAddress = clientIP ? clientIP.split(',')[0].trim().split(':').pop() : '';

        // Check if IP is blacklisted
        if (securityConfig.firewall.blacklist.includes(ipAddress)) {
            console.log(`🚫 BLOCKED: Blacklisted IP ${ipAddress} attempted access`);
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Check for suspicious patterns
        const requestPath = (req.path || '').toLowerCase();
        const requestBody = JSON.stringify(req.body || {}).toLowerCase();
        const requestQuery = JSON.stringify(req.query || {}).toLowerCase();
        const userAgent = req.headers['user-agent'] || '';

        let suspiciousActivity = false;
        let attackType = '';

        // Check path-based attacks
        for (const pattern of securityConfig.attackDetection.suspiciousPatterns) {
            if (pattern.test(requestPath) || pattern.test(requestBody) || pattern.test(requestQuery)) {
                suspiciousActivity = true;
                attackType = 'suspicious_pattern';
                break;
            }
        }

        // Check for suspicious user agents
        const suspiciousUserAgents = [
            /bot/i, /crawler/i, /spider/i, /scanner/i, /probe/i,
            /curl/i, /wget/i, /python/i, /perl/i, /ruby/i,
            /sqlmap/i, /nikto/i, /nmap/i, /dirb/i, /gobuster/i
        ];

        for (const uaPattern of suspiciousUserAgents) {
            if (uaPattern.test(userAgent)) {
                suspiciousActivity = true;
                attackType = 'suspicious_user_agent';
                break;
            }
        }

        // Check for rapid requests (DDoS attempt)
        if (!redis) {
            console.warn('⚠️  Redis not available, skipping rate limiting');
            next();
            return;
        }
        
        const requestKey = `attack_protection:${ipAddress}`;
        
        redis.incr(requestKey).then((attempts) => {
            // Set expiry for the key
            redis.expire(requestKey, 60); // 1 minute window

            if (attempts > securityConfig.attackDetection.maxAttemptsPerIP) {
                console.log(`🚫 BLOCKED: Too many requests from ${ipAddress} (${attempts} attempts)`);
                
                // Auto-block if enabled
                if (securityConfig.attackDetection.autoBlock) {
                    const blockKey = `ip_block:${ipAddress}`;
                    redis.setex(blockKey, securityConfig.attackDetection.blockDuration, 'blocked');
                }

                return res.status(429).json({
                    success: false,
                    message: 'Too many requests'
                });
            }

            // Log suspicious activity
            if (suspiciousActivity) {
                console.log(`🚨 SUSPICIOUS: ${req.method || 'UNKNOWN'} ${req.path || 'UNKNOWN_PATH'} from ${ipAddress} - Type: ${attackType} - User-Agent: ${userAgent}`);
                
                // Increment suspicious activity counter
                const suspiciousKey = `suspicious:${ipAddress}`;
                redis.incr(suspiciousKey);
                redis.expire(suspiciousKey, 300); // 5 minutes

                // Check if IP should be auto-blocked
                redis.get(suspiciousKey).then((suspiciousCount) => {
                    if (parseInt(suspiciousCount) >= 3) {
                        console.log(`🚫 AUTO-BLOCKED: IP ${ipAddress} for suspicious activity`);
                        const blockKey = `ip_block:${ipAddress}`;
                        redis.setex(blockKey, securityConfig.attackDetection.blockDuration, 'suspicious');
                    }
                });
            }

            next();
        }).catch((error) => {
            console.error('Attack protection Redis error:', error);
            next(); // Continue if Redis fails
        });
    } catch (error) {
        console.error('Attack protection middleware error:', error);
        next(); // Continue if middleware fails
    }
};

/**
 * Check if IP is currently blocked
 */
const isIPBlocked = async (ipAddress) => {
    try {
        if (!redis) {
            console.warn('⚠️  Redis not available, cannot check IP block status');
            return false;
        }
        
        const blockKey = `ip_block:${ipAddress}`;
        const blocked = await redis.get(blockKey);
        return !!blocked;
    } catch (error) {
        console.error('Error checking IP block status:', error);
        return false;
    }
};

/**
 * Manually block an IP
 */
const blockIP = async (ipAddress, duration = 3600, reason = 'manual') => {
    try {
        if (!redis) {
            console.warn('⚠️  Redis not available, cannot block IP');
            return false;
        }
        
        const blockKey = `ip_block:${ipAddress}`;
        await redis.setex(blockKey, duration, reason);
        console.log(`🚫 MANUALLY BLOCKED: IP ${ipAddress} for ${duration} seconds - Reason: ${reason}`);
        return true;
    } catch (error) {
        console.error('Error blocking IP:', error);
        return false;
    }
};

/**
 * Unblock an IP
 */
const unblockIP = async (ipAddress) => {
    try {
        if (!redis) {
            console.warn('⚠️  Redis not available, cannot unblock IP');
            return false;
        }
        
        const blockKey = `ip_block:${ipAddress}`;
        await redis.del(blockKey);
        console.log(`✅ UNBLOCKED: IP ${ipAddress}`);
        return true;
    } catch (error) {
        console.error('Error unblocking IP:', error);
        return false;
    }
};

module.exports = {
    attackProtection,
    isIPBlocked,
    blockIP,
    unblockIP
}; 