const winston = require('winston');
const { createLogger, format, transports } = winston;
const { combine, timestamp, json, printf } = format;
require('winston-daily-rotate-file');
const path = require('path');

// Sensitive data patterns to mask
const sensitivePatterns = [
    { pattern: /password=([^&]*)/g, replacement: 'password=***' },
    { pattern: /token=([^&]*)/g, replacement: 'token=***' },
    { pattern: /cardNumber=(\d{4})\d+(\d{4})/g, replacement: 'cardNumber=$1****$2' },
    { pattern: /cvv=(\d+)/g, replacement: 'cvv=***' },
    { pattern: /"password":"([^"]*)"/g, replacement: '"password":"***"' },
    { pattern: /"token":"([^"]*)"/g, replacement: '"token":"***"' }
];

// Custom format to mask sensitive data
const maskSensitiveData = format((info) => {
    let message = JSON.stringify(info);
    sensitivePatterns.forEach(({ pattern, replacement }) => {
        message = message.replace(pattern, replacement);
    });
    return JSON.parse(message);
});

// Create rotating file transport
const fileRotateTransport = new transports.DailyRotateFile({
    filename: path.join('logs', 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '14d',
    zippedArchive: true,
    format: combine(
        timestamp(),
        maskSensitiveData(),
        json()
    )
});

// Create logger instance
const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: combine(
        timestamp(),
        maskSensitiveData(),
        json()
    ),
    transports: [
        fileRotateTransport,
        new transports.Console({
            format: combine(
                format.colorize(),
                format.simple()
            )
        })
    ],
    exitOnError: false
});

// Add error event handler
logger.on('error', (error) => {
    console.error('Logger error:', error);
});

// Export logger instance
module.exports = logger; 