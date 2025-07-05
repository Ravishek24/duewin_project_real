const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for production logs
const productionFormat = winston.format.combine(
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Custom format for development logs
const developmentFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let msg = `${timestamp} [${level}]: ${message}`;
        if (Object.keys(meta).length > 0) {
            msg += ` ${JSON.stringify(meta)}`;
        }
        return msg;
    })
);

// Create logger instance
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.NODE_ENV === 'production' ? productionFormat : developmentFormat,
    defaultMeta: { service: 'duewin-backend' },
    transports: [
        // Error logs
        new winston.transports.File({
            filename: path.join(logsDir, 'error.log'),
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true
        }),
        
        // Combined logs
        new winston.transports.File({
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
            tailable: true
        }),
        
        // Game-specific logs with rotation
        new winston.transports.File({
            filename: path.join(logsDir, 'game-scheduler.log'),
            level: 'info',
            maxsize: 5 * 1024 * 1024, // 5MB
            maxFiles: 3,
            tailable: true,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
                })
            )
        })
    ]
});

// Add console transport for development
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: developmentFormat
    }));
}

// Rate limiting for excessive logging
const logCounts = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 100; // Max logs per minute per key

function rateLimitedLog(level, key, message, meta = {}) {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW;
    
    if (!logCounts.has(key)) {
        logCounts.set(key, []);
    }
    
    const counts = logCounts.get(key);
    
    // Remove old entries
    const recentCounts = counts.filter(timestamp => timestamp > windowStart);
    logCounts.set(key, recentCounts);
    
    // Check if we're over the limit
    if (recentCounts.length >= RATE_LIMIT_MAX) {
        // Only log once per minute when over limit
        const lastLog = recentCounts[recentCounts.length - 1];
        if (now - lastLog < RATE_LIMIT_WINDOW) {
            return; // Skip this log
        }
    }
    
    // Add current timestamp
    recentCounts.push(now);
    
    // Log the message
    logger[level](message, meta);
}

// Enhanced logger with rate limiting
const enhancedLogger = {
    error: (message, meta) => logger.error(message, meta),
    warn: (message, meta) => logger.warn(message, meta),
    info: (message, meta) => logger.info(message, meta),
    debug: (message, meta) => logger.debug(message, meta),
    
    // Rate-limited logging for frequently called functions
    gamePeriod: (message, meta = {}) => {
        rateLimitedLog('info', 'game-period', message, meta);
    },
    
    gameTick: (message, meta = {}) => {
        rateLimitedLog('debug', 'game-tick', message, meta);
    },
    
    periodTransition: (message, meta = {}) => {
        logger.info(message, meta); // Always log period transitions
    },
    
    // Clean up old log counts periodically
    cleanup: () => {
        const now = Date.now();
        const windowStart = now - RATE_LIMIT_WINDOW;
        
        for (const [key, counts] of logCounts.entries()) {
            const recentCounts = counts.filter(timestamp => timestamp > windowStart);
            logCounts.set(key, recentCounts);
        }
    }
};

// Clean up log counts every 5 minutes
setInterval(() => {
    enhancedLogger.cleanup();
}, 5 * 60 * 1000);

module.exports = enhancedLogger; 