const rateLimit = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redisHelper = require('../config/redis');
const { isWhitelisted } = require('../config/whitelist');

// Get Redis client from our helper
const redis = redisHelper.getClient();

// Create a bypass middleware that does nothing
const bypassMiddleware = (req, res, next) => {
    console.log('Rate limiting bypassed');
    next();
};

// Different rate limiters for different endpoints
const rateLimiters = {
    // Signup: 5 requests per hour per IP
    signup: bypassMiddleware,

    // Login: 10 requests per 15 minutes per IP
    login: bypassMiddleware,

    // Profile Update: 20 requests per hour per user
    profileUpdate: bypassMiddleware,

    // Wallet Operations: 30 requests per hour per user
    wallet: bypassMiddleware,

    // Gift Code: 5 requests per hour per user
    giftCode: bypassMiddleware,

    // General API: 100 requests per 15 minutes per IP
    general: bypassMiddleware,

    // New rate limiters for other routes
    payment: bypassMiddleware,

    withdrawal: bypassMiddleware,

    // Internal Game Rate Limiters
    internalCrashGame: bypassMiddleware,

    internalDiceGame: bypassMiddleware,

    // External Game Rate Limiters
    externalGame: bypassMiddleware,

    // Game History Rate Limiters
    internalGameHistory: bypassMiddleware,

    externalGameHistory: bypassMiddleware,

    // Game Stats Rate Limiters
    internalGameStats: bypassMiddleware,

    externalGameStats: bypassMiddleware,

    // Game Balance Check Rate Limiter
    gameBalance: bypassMiddleware,

    // Game Exit Rate Limiter
    gameExit: bypassMiddleware,

    // Game Transfer Rate Limiter
    gameTransfer: bypassMiddleware,

    // OTP Rate Limiter
    otp: bypassMiddleware,

    bankAccount: bypassMiddleware,

    seamlessWallet: bypassMiddleware,

    mxPay: bypassMiddleware,

    vip: bypassMiddleware,

    referral: bypassMiddleware
};

// Rate limiter for game history API
const gameHistory = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // 20 requests per minute
    message: 'Too many game history requests, please try again later',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise IP
        return req.user ? req.user.id : req.ip;
    }
});

// Create global rate limiter
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    skip: (req) => {
        const clientIP = req.ip || req.connection.remoteAddress;
        return isWhitelisted(clientIP);
    }
});

module.exports = {
    ...rateLimiters,
    gameHistory,
    globalLimiter
}; 