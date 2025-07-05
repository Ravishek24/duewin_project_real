// Logging middleware for DueWin Backend
const logger = require('../config/logging');

// Track request counts for rate limiting
const requestCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_MINUTE = 100;

// Clean up old request counts
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of requestCounts.entries()) {
        const recentRequests = timestamps.filter(time => now - time < RATE_LIMIT_WINDOW);
        if (recentRequests.length === 0) {
            requestCounts.delete(key);
        } else {
            requestCounts.set(key, recentRequests);
        }
    }
}, 60000); // Clean up every minute

// Logging middleware
const loggingMiddleware = (req, res, next) => {
    const startTime = Date.now();
    const requestId = generateRequestId();
    
    // Add request ID to response headers
    res.setHeader('X-Request-ID', requestId);
    
    // Track request for rate limiting
    const clientIP = req.ip || req.connection.remoteAddress;
    const requestKey = `${clientIP}:${req.method}:${req.path}`;
    
    if (!requestCounts.has(requestKey)) {
        requestCounts.set(requestKey, []);
    }
    
    const timestamps = requestCounts.get(requestKey);
    timestamps.push(startTime);
    
    // Check if we should log this request (rate limiting)
    const recentRequests = timestamps.filter(time => startTime - time < RATE_LIMIT_WINDOW);
    const shouldLog = recentRequests.length <= MAX_REQUESTS_PER_MINUTE;
    
    // Log request start (only if not rate limited)
    if (shouldLog) {
        logger.debug(`Request started: ${req.method} ${req.path}`, {
            requestId,
            method: req.method,
            path: req.path,
            ip: clientIP,
            userAgent: req.get('User-Agent')?.substring(0, 100),
            query: Object.keys(req.query).length > 0 ? 'present' : 'none',
            body: req.body && Object.keys(req.body).length > 0 ? 'present' : 'none'
        });
    }
    
    // Override res.end to log response
    const originalEnd = res.end;
    res.end = function(chunk, encoding) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Log response (with rate limiting)
        if (shouldLog) {
            const logLevel = res.statusCode >= 400 ? 'warn' : 'debug';
            logger[logLevel](`Request completed: ${req.method} ${req.path}`, {
                requestId,
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                responseTime,
                ip: clientIP,
                contentLength: res.get('Content-Length') || 'unknown'
            });
        }
        
        // Log slow requests
        if (responseTime > 5000) {
            logger.warn(`Slow request detected: ${req.method} ${req.path}`, {
                requestId,
                responseTime,
                ip: clientIP
            });
        }
        
        // Log errors
        if (res.statusCode >= 500) {
            logger.error(`Server error: ${req.method} ${req.path}`, {
                requestId,
                statusCode: res.statusCode,
                responseTime,
                ip: clientIP,
                userAgent: req.get('User-Agent')
            });
        }
        
        // Call original end method
        originalEnd.call(this, chunk, encoding);
    };
    
    next();
};

// Generate unique request ID
function generateRequestId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Error logging middleware
const errorLoggingMiddleware = (err, req, res, next) => {
    const requestId = res.getHeader('X-Request-ID') || 'unknown';
    
    logger.error('Unhandled error occurred', {
        requestId,
        method: req.method,
        path: req.path,
        ip: req.ip || req.connection.remoteAddress,
        error: {
            message: err.message,
            stack: err.stack,
            name: err.name
        },
        userAgent: req.get('User-Agent')
    });
    
    next(err);
};

// Performance monitoring middleware
const performanceMiddleware = (req, res, next) => {
    const startTime = process.hrtime.bigint();
    
    res.on('finish', () => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        // Log performance metrics
        logger.performance(`${req.method} ${req.path}`, duration, {
            statusCode: res.statusCode,
            ip: req.ip || req.connection.remoteAddress
        });
    });
    
    next();
};

// Security logging middleware
const securityLoggingMiddleware = (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    // Log suspicious requests
    const suspiciousPatterns = [
        /\.\.\//, // Directory traversal
        /<script/i, // XSS attempts
        /union.*select/i, // SQL injection
        /eval\(/i, // Code injection
        /document\.cookie/i // Cookie theft attempts
    ];
    
    const requestString = `${req.method} ${req.path} ${JSON.stringify(req.body)} ${JSON.stringify(req.query)}`;
    
    for (const pattern of suspiciousPatterns) {
        if (pattern.test(requestString)) {
            logger.security('Suspicious request detected', clientIP, userAgent, {
                pattern: pattern.source,
                request: requestString.substring(0, 200)
            });
            break;
        }
    }
    
    // Log authentication attempts
    if (req.path.includes('/login') || req.path.includes('/register')) {
        logger.security('Authentication attempt', clientIP, userAgent, {
            path: req.path,
            method: req.method
        });
    }
    
    next();
};

module.exports = {
    loggingMiddleware,
    errorLoggingMiddleware,
    performanceMiddleware,
    securityLoggingMiddleware
}; 