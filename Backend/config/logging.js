// Centralized logging configuration for DueWin Backend
const logger = require('../utils/logger');

// Log levels for different environments
const LOG_LEVELS = {
    development: 'debug',
    production: 'info',
    test: 'error'
};

// Rate limiting configuration
const RATE_LIMITS = {
    'game-period': { maxPerMinute: 10, windowMs: 60000 },
    'game-tick': { maxPerMinute: 5, windowMs: 60000 },
    'period-transition': { maxPerMinute: 60, windowMs: 60000 },
    'api-request': { maxPerMinute: 100, windowMs: 60000 },
    'database-query': { maxPerMinute: 50, windowMs: 60000 }
};

// Sensitive data patterns to mask
const SENSITIVE_PATTERNS = [
    { pattern: /password=([^&]*)/g, replacement: 'password=***' },
    { pattern: /token=([^&]*)/g, replacement: 'token=***' },
    { pattern: /cardNumber=(\d{4})\d+(\d{4})/g, replacement: 'cardNumber=$1****$2' },
    { pattern: /cvv=(\d+)/g, replacement: 'cvv=***' },
    { pattern: /"password":"([^"]*)"/g, replacement: '"password":"***"' },
    { pattern: /"token":"([^"]*)"/g, replacement: '"token":"***"' },
    { pattern: /"apiKey":"([^"]*)"/g, replacement: '"apiKey":"***"' }
];

// Enhanced logger with environment-specific settings
const enhancedLogger = {
    // Standard logging methods
    error: (message, meta = {}) => {
        logger.error(message, sanitizeData(meta));
    },
    
    warn: (message, meta = {}) => {
        logger.warn(message, sanitizeData(meta));
    },
    
    info: (message, meta = {}) => {
        logger.info(message, sanitizeData(meta));
    },
    
    debug: (message, meta = {}) => {
        if (process.env.NODE_ENV !== 'production') {
            logger.debug(message, sanitizeData(meta));
        }
    },
    
    // Specialized logging methods with rate limiting
    gamePeriod: (message, meta = {}) => {
        logger.gamePeriod(message, sanitizeData(meta));
    },
    
    gameTick: (message, meta = {}) => {
        logger.gameTick(message, sanitizeData(meta));
    },
    
    periodTransition: (message, meta = {}) => {
        logger.periodTransition(message, sanitizeData(meta));
    },
    
    // API request logging
    apiRequest: (method, path, statusCode, responseTime, meta = {}) => {
        const level = statusCode >= 400 ? 'warn' : 'info';
        logger[level](`API ${method} ${path} - ${statusCode} (${responseTime}ms)`, {
            method,
            path,
            statusCode,
            responseTime,
            ...sanitizeData(meta)
        });
    },
    
    // Database query logging
    dbQuery: (operation, table, duration, meta = {}) => {
        const level = duration > 1000 ? 'warn' : 'debug';
        logger[level](`DB ${operation} on ${table} (${duration}ms)`, {
            operation,
            table,
            duration,
            ...sanitizeData(meta)
        });
    },
    
    // Payment logging (with extra security)
    payment: (action, amount, currency, status, meta = {}) => {
        logger.info(`Payment ${action} - ${amount} ${currency} (${status})`, {
            action,
            amount,
            currency,
            status,
            ...sanitizeData(meta)
        });
    },
    
    // Security event logging
    security: (event, ip, userAgent, meta = {}) => {
        logger.warn(`Security: ${event}`, {
            event,
            ip,
            userAgent: userAgent ? userAgent.substring(0, 100) : 'unknown',
            ...sanitizeData(meta)
        });
    },
    
    // Performance monitoring
    performance: (operation, duration, meta = {}) => {
        const level = duration > 5000 ? 'warn' : 'debug';
        logger[level](`Performance: ${operation} took ${duration}ms`, {
            operation,
            duration,
            ...sanitizeData(meta)
        });
    }
};

// Sanitize sensitive data
function sanitizeData(data) {
    if (!data || typeof data !== 'object') {
        return data;
    }
    
    const sanitized = JSON.parse(JSON.stringify(data));
    
    SENSITIVE_PATTERNS.forEach(({ pattern, replacement }) => {
        if (typeof sanitized === 'string') {
            sanitized = sanitized.replace(pattern, replacement);
        }
    });
    
    return sanitized;
}

// Log startup configuration
enhancedLogger.info('Logging system initialized', {
    environment: process.env.NODE_ENV || 'development',
    logLevel: LOG_LEVELS[process.env.NODE_ENV] || 'info',
    rateLimits: Object.keys(RATE_LIMITS),
    features: ['rate-limiting', 'data-sanitization', 'performance-monitoring']
});

module.exports = enhancedLogger; 