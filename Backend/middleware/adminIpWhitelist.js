const config = require('../config/config');

// List of whitelisted IPs for admin access
const whitelistedIPs = process.env.ADMIN_IP_WHITELIST ? 
    process.env.ADMIN_IP_WHITELIST.split(',') : 
    ['127.0.0.1']; // Default to localhost if no whitelist provided

// Flag to enable/disable IP whitelist checks
const enableIpCheck = process.env.ENABLE_ADMIN_IP_CHECK === 'true';

const adminIpWhitelist = (req, res, next) => {
    // Skip IP checks by default (set ENABLE_ADMIN_IP_CHECK=true to enable restrictions)
    if (!enableIpCheck) {
        console.log('Admin IP whitelist check is disabled - allowing all IPs');
        return next();
    }

    // Get the real IP address (considering proxy headers)
    const clientIP = req.headers['x-forwarded-for'] || 
                    req.headers['x-real-ip'] || 
                    req.connection.remoteAddress;
    
    // Extract just the IP address if it's in the form "IP:port" or has multiple IPs
    const ipAddress = clientIP ? clientIP.split(',')[0].trim().split(':').pop() : '';

    // Log the incoming IP for debugging
    console.log(`Admin access attempt from IP: ${ipAddress}`);

    // Check if the IP is whitelisted
    if (!whitelistedIPs.includes(ipAddress)) {
        console.warn(`Unauthorized admin access attempt from IP: ${ipAddress}`);
        return res.status(403).json({
            success: false,
            message: 'Access denied. Your IP is not authorized for admin access.'
        });
    }

    next();
};

module.exports = adminIpWhitelist; 