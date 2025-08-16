/**
 * IP Address Utility Functions
 * Centralized IP address extraction and handling
 */

/**
 * Extract client IP address from request
 * Handles various proxy scenarios and headers
 * @param {Object} req - Express request object
 * @returns {string} Client IP address
 */
const getClientIp = (req) => {
    // Check for X-Forwarded-For header (most common proxy header)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
        // X-Forwarded-For can contain multiple IPs, take the first one
        return forwardedFor.split(',')[0].trim();
    }
    
    // Check for X-Real-IP header (nginx proxy)
    if (req.headers['x-real-ip']) {
        return req.headers['x-real-ip'];
    }
    
    // Check for CF-Connecting-IP header (Cloudflare)
    if (req.headers['cf-connecting-ip']) {
        return req.headers['cf-connecting-ip'];
    }
    
    // Fallback to Express.js built-in IP
    if (req.ip) {
        return req.ip;
    }
    
    // Last resort: direct connection
    if (req.connection && req.connection.remoteAddress) {
        return req.connection.remoteAddress;
    }
    
    // If socket exists
    if (req.socket && req.socket.remoteAddress) {
        return req.socket.remoteAddress;
    }
    
    // Default fallback
    return 'unknown';
};

/**
 * Get IP address with additional context for logging
 * @param {Object} req - Express request object
 * @returns {Object} IP information object
 */
const getIpInfo = (req) => {
    const clientIp = getClientIp(req);
    
    return {
        ip: clientIp,
        forwardedFor: req.headers['x-forwarded-for'],
        realIp: req.headers['x-real-ip'],
        cfConnectingIp: req.headers['cf-connecting-ip'],
        userAgent: req.headers['user-agent'],
        method: req.method,
        path: req.path,
        timestamp: new Date().toISOString()
    };
};

/**
 * Validate if IP address is valid
 * @param {string} ip - IP address to validate
 * @returns {boolean} True if valid IP
 */
const isValidIp = (ip) => {
    if (!ip || ip === 'unknown') return false;
    
    // Basic IP validation regex
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

/**
 * Sanitize IP address for database storage
 * @param {string} ip - Raw IP address
 * @returns {string} Sanitized IP address
 */
const sanitizeIp = (ip) => {
    if (!ip || ip === 'unknown') return null;
    
    // Remove any port numbers
    const cleanIp = ip.split(':')[0];
    
    // Validate the cleaned IP
    return isValidIp(cleanIp) ? cleanIp : null;
};

module.exports = {
    getClientIp,
    getIpInfo,
    isValidIp,
    sanitizeIp
};
