// utils/spribeUtils.js - UPDATED FOR USD CURRENCY
const crypto = require('crypto');
const spribeConfig = require('../config/spribeConfig');
const logger = require('../utils/logger');

/**
 * Format amount for SPRIBE API (convert from decimal to integer units)
 * For fiat currencies (USD/EUR): 1 unit = 1000 (e.g., 5.32 USD = 5320 units)
 * For crypto: 1 unit = 100000000 (e.g., 0.0532 BTC = 5320000 units)
 * @param {number} amount - Amount in decimal format (e.g., 5.32)
 * @param {string} currency - Currency code
 * @returns {number} - Amount in smallest units
 */
const formatAmount = (amount, currency) => {
  console.log('\n💰 ===== FORMATTING AMOUNT FOR SPRIBE =====');
  console.log('📦 Input:', { amount, currency });

  try {
    // Convert EUR to USD if needed
    let usdAmount = amount;
    if (currency === 'EUR') {
      usdAmount = amount * 1.08; // Simple conversion rate
      console.log('💱 Converted EUR to USD:', { eur: amount, usd: usdAmount });
    }

    // Format amount in smallest units (1 USD = 1000 units)
    const formattedAmount = Math.round(usdAmount * 1000);
    
    console.log('✅ Formatted amount:', {
      original: amount,
      currency,
      converted: usdAmount,
      formatted: formattedAmount
    });

    return formattedAmount;
  } catch (error) {
    console.error('❌ Amount formatting error:', error);
    throw error;
  }
};

/**
 * Parse amount from SPRIBE API (convert from integer units to decimal)
 * @param {number} amount - Amount in smallest units
 * @param {string} currency - Currency code
 * @returns {number} - Amount in decimal format
 */
const parseAmount = (amount, currency) => {
  console.log('\n💰 ===== PARSING AMOUNT FROM SPRIBE =====');
  console.log('📦 Input:', { amount, currency });

  try {
    // Convert from smallest units to USD
    const usdAmount = amount / 1000;
    
    // Convert to EUR if needed
    let finalAmount = usdAmount;
    if (currency === 'EUR') {
      finalAmount = usdAmount / 1.08; // Simple conversion rate
      console.log('💱 Converted USD to EUR:', { usd: usdAmount, eur: finalAmount });
    }

    console.log('✅ Parsed amount:', {
      original: amount,
      currency,
      usd: usdAmount,
      final: finalAmount
    });

    return finalAmount;
  } catch (error) {
    console.error('❌ Amount parsing error:', error);
    throw error;
  }
};

/**
 * Generate game launch URL
 * @param {string} gameId - Game identifier
 * @param {string} userId - User identifier
 * @param {Object} options - Launch options
 * @returns {string} - Complete launch URL
 */
const generateGameLaunchUrl = async (gameId, userId, options = {}) => {
  try {
    logger.info('🎮 Generating game launch URL:', { gameId, userId });

    // Validate required parameters
    if (!gameId || !userId) {
      throw new Error('Missing required parameters: gameId and userId are required');
    }

    // Ensure userId is a string and not undefined
    if (typeof userId === 'object' || userId === undefined) {
      throw new Error('Invalid userId: must be a string and not undefined');
    }

    // Generate timestamp for security
    const timestamp = Math.floor(Date.now() / 1000);

    // Construct base URL
    const baseUrl = spribeConfig.gameLaunchUrl;

    // Prepare query parameters according to SPRIBE documentation
    const queryParams = new URLSearchParams({
      user: userId.toString(),
      token: options.userToken || '',
      currency: options.currency || 'USD',
      operator: spribeConfig.clientId, // Use client ID as operator
      lang: options.lang || 'en'
    });

    // Add optional parameters if provided
    if (options.returnUrl) {
      queryParams.append('return_url', options.returnUrl);
    }

    // Add callback URLs with security parameters
    const callbackParams = new URLSearchParams({
      client_id: spribeConfig.clientId,
      client_secret: spribeConfig.clientSecret,
      timestamp: timestamp.toString()
    });

    // Construct callback URLs using the base URL from config
    const callbackBaseUrl = spribeConfig.callbackBaseUrl || 'https://strike.atsproduct.in';
    
    // Add callback URLs
    queryParams.append('auth_callback_url', `${callbackBaseUrl}/api/spribe/auth?${callbackParams.toString()}`);
    queryParams.append('info_callback_url', `${callbackBaseUrl}/api/spribe/info?${callbackParams.toString()}`);
    queryParams.append('withdraw_callback_url', `${callbackBaseUrl}/api/spribe/withdraw?${callbackParams.toString()}`);
    queryParams.append('deposit_callback_url', `${callbackBaseUrl}/api/spribe/deposit?${callbackParams.toString()}`);
    queryParams.append('rollback_callback_url', `${callbackBaseUrl}/api/spribe/rollback?${callbackParams.toString()}`);

    // Construct final URL
    const launchUrl = `${baseUrl}/${gameId}?${queryParams.toString()}`;

    logger.info('✅ Launch URL generated:', {
      success: true,
      url: launchUrl,
      sessionId: options.sessionId
    });

    return {
      success: true,
      url: launchUrl,
      sessionId: options.sessionId
    };

  } catch (error) {
    logger.error('❌ Error generating launch URL:', error);
    throw error;
  }
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
 * Validate SPRIBE request signature
 */
const validateSignature = (clientId, timestamp, signature, path, body) => {
  console.log('\n🔐 ===== VALIDATING SPRIBE SIGNATURE =====');
  console.log('📦 Input parameters:', {
    clientId,
    timestamp,
    signatureLength: signature?.length,
    path,
    body
  });

  try {
    // Validate required parameters
    if (!clientId || !timestamp || !signature || !path) {
      console.error('❌ Missing required parameters:', {
        clientId: !!clientId,
        timestamp: !!timestamp,
        signature: !!signature,
        path: !!path
      });
      return false;
    }

    // Validate client ID
    if (clientId !== spribeConfig.clientId) {
      console.error('❌ Invalid client ID:', {
        received: clientId,
        expected: spribeConfig.clientId
      });
      return false;
    }

    // Create signature string
    const bodyString = body ? JSON.stringify(body) : '';
    const signatureString = `${path}${timestamp}${bodyString}`;
    
    // Generate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', spribeConfig.clientSecret)
      .update(signatureString)
      .digest('hex');

    // Compare signatures
    const isValid = signature === expectedSignature;

    console.log('🔍 Signature validation:', {
      isValid,
      receivedSignature: signature.substring(0, 10) + '...',
      expectedSignature: expectedSignature.substring(0, 10) + '...',
      signatureString: signatureString.substring(0, 50) + '...'
    });

    return isValid;
  } catch (error) {
    console.error('❌ Signature validation error:', error);
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
 * Get user's preferred currency - Always USD for SPRIBE
 * @param {Object} user - User object
 * @returns {string} - Currency code
 */
const getUserCurrency = (user) => {
  return user.currency || spribeConfig.defaultCurrency;
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