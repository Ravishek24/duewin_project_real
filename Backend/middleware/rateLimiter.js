let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }
function getRedisClient() {
  if (!redisHelper) throw new Error('redisHelper not set!');
  return redisHelper.getClient();
}

const rateLimit = require('express-rate-limit');
//const { RedisStore } = require('rate-limit-redis');
const { isWhitelisted } = require('../config/whitelist');

// No top-level redis usage!

// Create a bypass middleware that does nothing
const bypassMiddleware = (req, res, next) => {
    console.log('Rate limiting bypassed');
    next();
};

// Different rate limiters for different endpoints - all bypassed for testing
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

    // OTP Rate Limiter: 5 requests per hour per IP
    otp: bypassMiddleware,

    // Bank Account: 10 requests per hour per user
    bankAccount: bypassMiddleware,

    // Seamless Wallet: 20 requests per hour per user
    seamlessWallet: bypassMiddleware,

    // MxPay: 10 requests per hour per user
    mxPay: bypassMiddleware,

    // VIP: 5 requests per hour per user
    vip: bypassMiddleware,

    // Referral: 10 requests per hour per user
    referral: bypassMiddleware,

    // Game Balance Check: 30 requests per minute per user
    gameBalance: bypassMiddleware,

    // Game Exit: 10 requests per minute per user
    gameExit: bypassMiddleware,

    // Game Transfer: 5 requests per minute per user
    gameTransfer: bypassMiddleware,

    // Internal Crash Game: 20 requests per minute per user
    internalCrashGame: bypassMiddleware,

    // Internal Dice Game: 20 requests per minute per user
    internalDiceGame: bypassMiddleware,

    // External Game: 20 requests per minute per user
    externalGame: bypassMiddleware,

    // Internal Game History: 30 requests per minute per user
    internalGameHistory: bypassMiddleware,

    // External Game History: 30 requests per minute per user
    externalGameHistory: bypassMiddleware,

    // Internal Game Stats: 30 requests per minute per user
    internalGameStats: bypassMiddleware,

    // External Game Stats: 30 requests per minute per user
    externalGameStats: bypassMiddleware,

    // Payment: 10 requests per minute per user
    payment: bypassMiddleware,

    // Withdrawal: 5 requests per minute per user
    withdrawal: bypassMiddleware,

    // Game Launch: 20 requests per minute per user
    gameLaunch: bypassMiddleware,

    // ===== NEW RATE LIMITERS FOR UNPROTECTED ROUTES =====

    // User Registration: 10 requests per 15 minutes per IP
    userRegistration: bypassMiddleware,

    // User Login: 10 requests per 15 minutes per IP
    userLogin: bypassMiddleware,

    // Profile Management: 10 requests per hour per user AND per IP
    profileManagement: bypassMiddleware,

    // Enhanced Wallet Operations: 50 requests per hour per user
    enhancedWallet: bypassMiddleware,

    // Spribe Game Operations: 100 requests per minute per user
    spribeGame: bypassMiddleware,

    // Announcements: 20 requests per hour per IP
    announcements: bypassMiddleware,

    // PPayPro Operations: 30 requests per hour per user
    ppaypro: bypassMiddleware,

    // Referral System: 20 requests per hour per user
    referralSystem: bypassMiddleware,

    // Transaction Reports: 30 requests per hour per user
    transactionReports: bypassMiddleware,

    // Gift Codes: 10 requests per hour per user
    giftCodes: bypassMiddleware,

    // Game Move Transactions: 50 requests per minute per user
    gameMoveTransactions: bypassMiddleware,

    // Activity Rewards: 20 requests per hour per user
    activityRewards: bypassMiddleware,

    // VIP System: 15 requests per hour per user
    vipSystem: bypassMiddleware,

    // USDT Operations: 30 requests per hour per user
    usdtOperations: bypassMiddleware,

    // User Feedback: 10 requests per hour per user
    userFeedback: bypassMiddleware,

    // WebSocket Connections: 20 connections per hour per user, 10 operations per minute per user
    websocketConnections: bypassMiddleware,

    // Vault Operations: 20 requests per hour per user
    vaultOperations: bypassMiddleware,

    // Third Party Wallet: 30 requests per hour per user
    thirdPartyWallet: bypassMiddleware,

    // Payment Gateway Operations: 20 requests per hour per user
    paymentGateway: bypassMiddleware,

    // MxPay Integration: 25 requests per hour per user
    mxPayIntegration: bypassMiddleware,

    // Rebate System: 15 requests per hour per user
    rebateSystem: bypassMiddleware
};

// Rate limiter for game history API - bypassed for testing
const gameHistory = bypassMiddleware;

// Create global rate limiter - bypassed for testing
const globalLimiter = bypassMiddleware;

module.exports = {
    setRedisHelper,
    ...rateLimiters,
    gameHistory,
    globalLimiter
}; 