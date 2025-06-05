// utils/spribeUtils.js - UPDATED FOR EUR CURRENCY
const crypto = require('crypto');
const spribeConfig = require('../config/spribeConfig');

/**
 * Format amount for SPRIBE API (convert from decimal to integer units)
 * For fiat currencies (USD/EUR): 1 unit = 1000 (e.g., 5.32 USD = 5320 units)
 * For crypto: 1 unit = 100000000 (e.g., 0.0532 BTC = 5320000 units)
 * @param {number} amount - Amount in decimal format (e.g., 5.32)
 * @param {string} currency - Currency code
 * @returns {number} - Amount in smallest units
 */
const formatAmount = (amount, currency = 'USD') => {
  const numAmount = parseFloat(amount);
  
  switch (currency.toUpperCase()) {
    case 'EUR':
    case 'USD':
    case 'INR':
      // Fiat currencies: 1 unit = 1000 smallest units
      return Math.round(numAmount * 1000);
    case 'BTC':
      // Bitcoin: 1 BTC = 100,000,000 satoshi
      return Math.round(numAmount * 100000000);
    default:
      // Default to fiat format
      return Math.round(numAmount * 1000);
  }
};

/**
 * Parse amount from SPRIBE API (convert from integer units to decimal)
 * @param {number} amount - Amount in smallest units
 * @param {string} currency - Currency code
 * @returns {number} - Amount in decimal format
 */
const parseAmount = (amount, currency = 'USD') => {
  const numAmount = parseInt(amount);
  
  switch (currency.toUpperCase()) {
    case 'EUR':
    case 'USD':
    case 'INR':
      // Fiat currencies: divide by 1000
      return numAmount / 1000;
    case 'BTC':
      // Bitcoin: divide by 100,000,000
      return numAmount / 100000000;
    default:
      // Default to fiat format
      return numAmount / 1000;
  }
};

/**
 * Generate game launch URL
 * @param {string} gameId - Game identifier
 * @param {Object} user - User object
 * @param {Object} options - Launch options
 * @returns {string} - Complete launch URL
 */
const generateGameLaunchUrl = (gameId, user, options = {}) => {
  const {
    currency = 'USD', // Default to USD for SPRIBE
    token,
    returnUrl,
    accountHistoryUrl,
    ircDuration,
    ircElapsed,
    lang = 'en'
  } = options;

  // Validate game exists in staging
  if (!spribeConfig.availableGames.includes(gameId)) {
    throw new Error(`Game ${gameId} is not available in staging environment`);
  }

  // Get operator key from environment variable or config
  const operatorKey = process.env.SPRIBE_OPERATOR_KEY || spribeConfig.operatorKey;
  if (!operatorKey) {
    throw new Error('SPRIBE operator key is not configured');
  }

  // Build query parameters
  const params = new URLSearchParams({
    user: user.user_id.toString(),
    token: token,
    lang: lang,
    currency: currency,
    operator: operatorKey, // Use operator key from environment or config
    callback_url: spribeConfig.callbackUrl // Add callback URL
  });

  // Add optional parameters if provided
  if (returnUrl) {
    params.append('return_url', returnUrl);
  }
  
  if (accountHistoryUrl) {
    params.append('account_history_url', accountHistoryUrl);
  }
  
  if (ircDuration) {
    params.append('irc_duration', ircDuration.toString());
  }
  
  if (ircElapsed) {
    params.append('irc_elapsed', ircElapsed.toString());
  }

  // Construct final URL
  const launchUrl = `${spribeConfig.launchUrl}/${gameId}?${params.toString()}`;
  console.log('Generated SPRIBE launch URL:', {
    gameId,
    userId: user.user_id,
    currency,
    tokenLength: token?.length,
    operator: operatorKey,
    url: launchUrl
  });

  return launchUrl;
};

/**
 * Generate security headers for API requests
 * @param {string} requestUri - Request URI with query parameters
 * @param {Object|string} requestBody - Request body (for POST requests)
 * @returns {Object} - Security headers object
 */
const generateSecurityHeaders = (requestUri, requestBody = null) => {
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Create signature
  const signature = createSignature(timestamp, requestUri, requestBody);
  
  return {
    'X-Spribe-Client-ID': spribeConfig.clientId,
    'X-Spribe-Client-TS': timestamp.toString(),
    'X-Spribe-Client-Signature': signature,
    'Content-Type': 'application/json; charset=utf-8'
  };
};

/**
 * Create signature for request validation
 * @param {number} timestamp - Unix timestamp
 * @param {string} path - Request path with query parameters
 * @param {Object|string} body - Request body
 * @returns {string} - Generated signature
 */
const createSignature = (timestamp, path, body) => {
  try {
    const hmac = crypto.createHmac('sha256', spribeConfig.clientSecret);
    
    // Concatenate in exact order: timestamp + path + body
    const timestampStr = timestamp.toString();
    const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';
    
    // Update in exact order as per SPRIBE docs
    hmac.update(timestampStr);
    hmac.update(path);
    if (bodyStr) {
      hmac.update(bodyStr);
    }
    
    return hmac.digest('hex');
  } catch (error) {
    console.error('Error creating signature:', error);
    throw new Error(`Error creating signature: ${error.message}`);
  }
};

/**
 * Validate incoming request signature from SPRIBE
 * @param {string} clientId - Client ID from header
 * @param {string} timestamp - Timestamp from header
 * @param {string} signature - Signature from header
 * @param {string} path - Request path with query parameters
 * @param {Object} body - Request body
 * @returns {boolean} - True if signature is valid
 */
const validateSignature = (clientId, timestamp, signature, path, body) => {
  try {
    console.log('Validating signature:', {
      receivedClientId: clientId,
      expectedClientId: spribeConfig.clientId,
      receivedTimestamp: timestamp,
      currentTimestamp: Math.floor(Date.now() / 1000),
      receivedSignature: signature,
      path,
      body
    });

    // Validate client ID
    if (clientId !== spribeConfig.clientId) {
      console.error('Invalid client ID:', {
        received: clientId,
        expected: spribeConfig.clientId
      });
      return false;
    }
    
    // Validate timestamp (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp);
    
    if (Math.abs(now - requestTime) > spribeConfig.signatureExpirationTime) {
      console.error('Request timestamp expired:', {
        requestTime,
        currentTime: now,
        difference: Math.abs(now - requestTime),
        maxAllowed: spribeConfig.signatureExpirationTime
      });
      return false;
    }
    
    // Generate expected signature
    const expectedSignature = createSignature(requestTime, path, body);
    
    console.log('Signature comparison:', {
      received: signature,
      expected: expectedSignature,
      matches: signature === expectedSignature
    });
    
    return signature === expectedSignature;
  } catch (error) {
    console.error('Error validating signature:', error);
    return false;
  }
};

/**
 * Validate request IP against allowed SPRIBE IPs
 * @param {string} clientIP - Client IP address
 * @returns {boolean} - True if IP is allowed
 */
const validateIP = (clientIP) => {
  // Remove IPv6 prefix if present
  const cleanIP = clientIP.replace(/^::ffff:/, '');
  
  console.log('Validating IP:', {
    originalIP: clientIP,
    cleanIP,
    environment: process.env.NODE_ENV,
    allowedIPs: spribeConfig.allowedIPs
  });
  
  // In development or staging, allow all IPs
  if (process.env.NODE_ENV !== 'production') {
    console.log('Development/Staging mode: Allowing all IPs');
    return true;
  }
  
  // In production, only allow SPRIBE IPs
  const isAllowed = spribeConfig.allowedIPs.includes(cleanIP);
  console.log('IP validation result:', {
    cleanIP,
    isAllowed,
    allowedIPs: spribeConfig.allowedIPs
  });
  
  return isAllowed;
};

/**
 * Get user's preferred currency with USD as default for SPRIBE
 * @param {Object} user - User object
 * @returns {string} - Currency code
 */
const getUserCurrency = (user) => {
  // Always return USD for SPRIBE games
  return 'USD';
};

module.exports = {
  formatAmount,
  parseAmount,
  generateGameLaunchUrl,
  generateSecurityHeaders,
  createSignature,
  validateSignature,
  validateIP,
  getUserCurrency
};