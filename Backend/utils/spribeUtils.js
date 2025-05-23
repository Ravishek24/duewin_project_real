// utils/spriteUtils.js
const crypto = require('crypto');
// utils/spribeUtils.js (renamed from spriteUtils.js)
const { spribeConfig } = require('../config/spribeConfig');

/**
 * Generate a unique one-time token for game launch
 * @returns {string} Generated token
 */
const generateOneTimeToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate a game launch URL for SPRIBE games
 * @param {string} gameId - Game identifier
 * @param {Object} user - User object
 * @param {Object} options - Additional options
 * @returns {string} Complete game launch URL
 */
const generateGameLaunchUrl = (gameId, user, options = {}) => {
  // Generate a one-time token for this launch
  const token = options.token || generateOneTimeToken();
  
  // Base URL parameters
  const params = {
    game: gameId,
    user: user.user_id,
    token: token,
    currency: options.currency || spribeConfig.defaultCurrency,
    operator: spribeConfig.operatorKey,
    lang: options.language || spribeConfig.defaultLanguage,
    callback_url: spribeConfig.callbackUrl // Use the unified callback URL
  };
  
  // Add optional parameters if provided
  if (options.returnUrl) params.return_url = options.returnUrl;
  if (options.accountHistoryUrl) params.account_history_url = options.accountHistoryUrl;
  if (options.ircDuration) params.irc_duration = options.ircDuration;
  if (options.ircElapsed) params.irc_elapsed = options.ircElapsed;
  
  // Build query string
  const queryString = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  
  // Return complete URL
  return `${spribeConfig.launchUrl}/${gameId}?${queryString}`;
};

/**
 * Generate the X-Spribe-Client-Signature header value
 * @param {number} timestamp - Current timestamp in seconds
 * @param {string} path - Request path including query params
 * @param {string|Object} body - Request body (can be JSON string or object)
 * @returns {string} The HMAC-SHA256 signature in hex format
 */
const generateSignature = (timestamp, path, body = '') => {
  const hmac = crypto.createHmac('sha256', spribeConfig.clientSecret);
  
  // Add timestamp and path
  hmac.update(`${timestamp}${path}`);
  
  // Add body if present
  if (body) {
    if (typeof body === 'object') {
      hmac.update(JSON.stringify(body));
    } else {
      hmac.update(body);
    }
  }
  
  // Return signature in hex format
  return hmac.digest('hex');
};

/**
 * Generate all required security headers for SPRIBE API requests
 * @param {string} path - Request path including query params
 * @param {string|Object} body - Request body
 * @returns {Object} Headers object with all required security headers
 */
const generateSecurityHeaders = (path, body = '') => {
  const timestamp = Math.floor(Date.now() / 1000); // Current time in seconds
  const signature = generateSignature(timestamp, path, body);
  
  return {
    'X-Spribe-Client-ID': spribeConfig.clientId,
    'X-Spribe-Client-TS': timestamp.toString(),
    'X-Spribe-Client-Signature': signature,
    'Content-Type': 'application/json; charset=utf-8'
  };
};

/**
 * Validate a SPRIBE API signature from incoming requests
 * @param {string} clientId - Client ID from request header
 * @param {number} timestamp - Timestamp from request header
 * @param {string} signature - Signature from request header
 * @param {string} path - Request path
 * @param {Object|string} body - Request body
 * @returns {boolean} True if signature is valid, false otherwise
 */
const validateSignature = (clientId, timestamp, signature, path, body = '') => {
  // Check if client ID matches our expected ID
  if (clientId !== spribeConfig.clientId) {
    return false;
  }
  
  // Check if timestamp is within valid range (prevent replay attacks)
  const currentTime = Math.floor(Date.now() / 1000);
  if (currentTime - timestamp > spribeConfig.signatureExpirationTime) {
    return false;
  }
  
  // Generate expected signature
  const expectedSignature = generateSignature(timestamp, path, body);
  
  // Compare signatures (case-insensitive)
  return signature.toLowerCase() === expectedSignature.toLowerCase();
};

/**
 * Convert amount to the format expected by SPRIBE
 * @param {number} amount - Amount in standard unit (e.g., 5.32 USD)
 * @param {string} currency - Currency code
 * @returns {number} Amount in SPRIBE format (integer)
 */
const formatAmount = (amount, currency) => {
  // Crypto currencies use 8 decimal places (10^8)
  const cryptoCurrencies = ['BTC', 'ETH', 'USDT', 'XRP', 'LTC'];
  
  // Fiat currencies use 3 decimal places (10^3)
  const multiplier = cryptoCurrencies.includes(currency) ? 100000000 : 1000;
  
  return Math.round(parseFloat(amount) * multiplier);
};

/**
 * Parse amount from SPRIBE format to standard format
 * @param {number} amount - Amount in SPRIBE format (integer)
 * @param {string} currency - Currency code
 * @returns {number} Amount in standard unit (e.g., 5.32 USD)
 */
const parseAmount = (amount, currency) => {
  // Crypto currencies use 8 decimal places (10^8)
  const cryptoCurrencies = ['BTC', 'ETH', 'USDT', 'XRP', 'LTC'];
  
  // Fiat currencies use 3 decimal places (10^3)
  const divisor = cryptoCurrencies.includes(currency) ? 100000000 : 1000;
  
  return parseFloat(amount) / divisor;
};

module.exports = {
  generateOneTimeToken,
  generateGameLaunchUrl,
  generateSignature,
  generateSecurityHeaders,
  validateSignature,
  formatAmount,
  parseAmount
};