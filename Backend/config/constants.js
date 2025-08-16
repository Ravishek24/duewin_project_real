// Authentication Constants
const AUTH = {
    JWT_SECRET: process.env.JWT_SECRET || 'your-secret-key',
    JWT_EXPIRES_IN: '5h',
    REFRESH_TOKEN_EXPIRES_IN: '7d',
    PASSWORD_SALT_ROUNDS: 10
};

// User Roles and Permissions
const ROLES = {
    ADMIN: 'admin',
    USER: 'user',
    SYSTEM_CONFIG: 'system_config'
};

// Payment Gateway Constants
const PAYMENT_GATEWAYS = {
    WEPAY: 'WEPAY',
    MXPAY: 'MXPAY',
    OKPAY: 'OKPAY'
};

// Transaction Types
const TRANSACTION_TYPES = {
    DEPOSIT: 'deposit',
    WITHDRAWAL: 'withdrawal',
    BET: 'bet',
    WIN: 'win',
    REFUND: 'refund',
    BONUS: 'bonus'
};

// Transaction Status
const TRANSACTION_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

// Game Types
const GAME_TYPES = {
    CRASH: 'crash',
    DICE: 'dice',
    SLOTS: 'slots'
};

// Error Messages
const ERROR_MESSAGES = {
    UNAUTHORIZED: 'Unauthorized access',
    INVALID_TOKEN: 'Invalid or expired token',
    INVALID_CREDENTIALS: 'Invalid credentials',
    USER_NOT_FOUND: 'User not found',
    INSUFFICIENT_BALANCE: 'Insufficient balance',
    INVALID_AMOUNT: 'Invalid amount',
    INVALID_PAYMENT_METHOD: 'Invalid payment method',
    PAYMENT_FAILED: 'Payment failed',
    WITHDRAWAL_FAILED: 'Withdrawal failed',
    GAME_NOT_FOUND: 'Game not found',
    INVALID_BET: 'Invalid bet',
    SERVER_ERROR: 'Internal server error'
};

// Success Messages
const SUCCESS_MESSAGES = {
    LOGIN_SUCCESS: 'Login successful',
    REGISTRATION_SUCCESS: 'Registration successful',
    PAYMENT_SUCCESS: 'Payment successful',
    WITHDRAWAL_SUCCESS: 'Withdrawal successful',
    BET_PLACED: 'Bet placed successfully',
    WIN_PROCESSED: 'Win processed successfully'
};

// API Response Codes
const API_CODES = {
    SUCCESS: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    SERVER_ERROR: 500
};

// Rate Limiting Constants
const RATE_LIMIT = {
    WINDOW_MS: 15 * 60 * 1000, // 15 minutes
    MAX_REQUESTS: 100 // limit each IP to 100 requests per windowMs
};

// Cache Constants
const CACHE = {
    TTL: 60 * 60, // 1 hour in seconds
    PREFIX: ''
};

// Export all constants
module.exports = {
    AUTH,
    ROLES,
    PAYMENT_GATEWAYS,
    TRANSACTION_TYPES,
    TRANSACTION_STATUS,
    GAME_TYPES,
    ERROR_MESSAGES,
    SUCCESS_MESSAGES,
    API_CODES,
    RATE_LIMIT,
    CACHE
}; 