// utils/playwin6Utils.js - PlayWin6 Provider Utilities
const crypto = require('crypto');
const axios = require('axios');
const playwin6Config = require('../config/playwin6Config');

/**
 * Generate AES-256 encrypted hash for payload
 * @param {Object} data - Data to encrypt
 * @param {string} key - AES key
 * @param {string} iv - AES initialization vector
 * @returns {string} - Encrypted hash
 */
const generateAESHash = (data, key = playwin6Config.aesKey, iv = playwin6Config.aesIv) => {
  try {
    if (!key || !iv) {
      throw new Error('AES key and IV are required for encryption');
    }

    // Convert data to JSON string
    const jsonData = JSON.stringify(data);
    
    // Create cipher
    const cipher = crypto.createCipher('aes-256-cbc', key);
    cipher.setAutoPadding(true);
    
    // Encrypt the data
    let encrypted = cipher.update(jsonData, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return encrypted;
  } catch (error) {
    console.error('Error generating AES hash:', error);
    throw error;
  }
};

/**
 * Decrypt AES-256 encrypted hash
 * @param {string} encryptedData - Encrypted data
 * @param {string} key - AES key
 * @param {string} iv - AES initialization vector
 * @returns {Object} - Decrypted data
 */
const decryptAESHash = (encryptedData, key = playwin6Config.aesKey, iv = playwin6Config.aesIv) => {
  try {
    if (!key || !iv) {
      throw new Error('AES key and IV are required for decryption');
    }

    // Create decipher
    const decipher = crypto.createDecipher('aes-256-cbc', key);
    decipher.setAutoPadding(true);
    
    // Decrypt the data
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('Error decrypting AES hash:', error);
    throw error;
  }
};

/**
 * Generate consistent player credentials
 * @param {Object} user - User object
 * @returns {Object} - Player credentials
 */
const generatePlayerCredentials = (user) => {
  const userId = user.user_id || user.id;
  const username = `${playwin6Config.playerPrefix}${userId}`;
  const password = `pwd${userId}${playwin6Config.passwordSalt}`;
  
  return {
    username,
    password,
    userId
  };
};

/**
 * Generate timestamp for API requests
 * @returns {number} - Current timestamp in milliseconds
 */
const generateTimestamp = () => {
  return Date.now();
};

/**
 * Format amount for API requests
 * @param {number} amount - Amount to format
 * @returns {string} - Formatted amount
 */
const formatAmount = (amount) => {
  return parseFloat(amount).toFixed(2);
};

/**
 * Parse amount from API responses
 * @param {string|number} amount - Amount to parse
 * @returns {number} - Parsed amount
 */
const parseAmount = (amount) => {
  return parseFloat(amount) || 0;
};

/**
 * Get user currency (default to INR for PlayWin6)
 * @param {Object} user - User object
 * @returns {string} - Currency code
 */
const getUserCurrency = (user) => {
  return user.currency || playwin6Config.defaultCurrency;
};

/**
 * Validate IP address against allowed IPs
 * @param {string} ipAddress - IP address to validate
 * @returns {boolean} - Whether IP is allowed
 */
const validateIPAddress = (ipAddress) => {
  if (!playwin6Config.allowedIPs || playwin6Config.allowedIPs.length === 0) {
    return true; // No IP restrictions
  }
  
  return playwin6Config.allowedIPs.includes(ipAddress);
};

/**
 * Make HTTP request to PlayWin6 API with retry logic
 * @param {string} url - API URL
 * @param {Object} data - Request data
 * @param {Object} options - Request options
 * @returns {Promise<Object>} - API response
 */
const makePlayWin6Request = async (url, data = null, options = {}) => {
  const maxRetries = options.maxRetries || playwin6Config.maxRetries;
  const timeout = options.timeout || playwin6Config.timeout;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🎮 PlayWin6 API Request (Attempt ${attempt}/${maxRetries}):`, {
        url,
        method: data ? 'POST' : 'GET',
        hasData: !!data
      });

      const requestOptions = {
        method: data ? 'POST' : 'GET',
        timeout,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'PlayWin6-Integration/1.0'
        }
      };

      if (data) {
        requestOptions.data = data;
      }

      const response = await axios(url, requestOptions);
      
      console.log(`✅ PlayWin6 API Response (Attempt ${attempt}):`, {
        status: response.status,
        statusText: response.statusText,
        hasData: !!response.data
      });

      return response.data;
    } catch (error) {
      console.error(`❌ PlayWin6 API Error (Attempt ${attempt}/${maxRetries}):`, {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText
      });

      if (attempt === maxRetries) {
        throw error;
      }

      // Wait before retry (exponential backoff)
      const waitTime = Math.pow(2, attempt) * 1000;
      console.log(`⏳ Waiting ${waitTime}ms before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};

/**
 * Validate game type
 * @param {string} gameType - Game type to validate
 * @returns {boolean} - Whether game type is valid
 */
const validateGameType = (gameType) => {
  return playwin6Config.supportedGameTypes.includes(gameType);
};

/**
 * Validate provider
 * @param {string} provider - Provider to validate
 * @returns {boolean} - Whether provider is valid
 */
const validateProvider = (provider) => {
  return playwin6Config.supportedProviders.includes(provider);
};

/**
 * Generate session token
 * @returns {string} - Session token
 */
const generateSessionToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Validate callback data
 * @param {Object} callbackData - Callback data to validate
 * @returns {Object} - Validation result
 */
const validateCallbackData = (callbackData) => {
  // Required fields for basic callback
  const required = ['user_id', 'wallet_amount', 'game_uid', 'token', 'timestamp'];
  const missing = required.filter(field => !callbackData[field]);
  
  if (missing.length > 0) {
    return {
      valid: false,
      missing,
      message: `Missing required fields: ${missing.join(', ')}`
    };
  }

  // Validate timestamp (should be within last 5 minutes)
  const timestamp = parseInt(callbackData.timestamp);
  const now = Date.now();
  const fiveMinutesAgo = now - (5 * 60 * 1000);
  
  if (timestamp < fiveMinutesAgo) {
    return {
      valid: false,
      message: 'Timestamp is too old'
    };
  }

  // Validate transaction data if present
  if (callbackData.transaction_id) {
    if (!callbackData.bet_amount && !callbackData.win_amount) {
      return {
        valid: false,
        message: 'Transaction must have either bet_amount or win_amount'
      };
    }
  }

  // Validate balance data if present
  if (callbackData.old_balance !== undefined && callbackData.new_balance !== undefined) {
    const oldBalance = parseFloat(callbackData.old_balance);
    const newBalance = parseFloat(callbackData.new_balance);
    
    if (isNaN(oldBalance) || isNaN(newBalance)) {
      return {
        valid: false,
        message: 'Invalid balance values'
      };
    }
  }

  return {
    valid: true
  };
};

/**
 * Format game launch URL with parameters
 * @param {Object} params - Launch parameters
 * @returns {string} - Formatted URL
 */
const formatGameLaunchUrl = (params) => {
  const url = new URL(playwin6Config.gameLaunchUrl);
  
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, params[key]);
    }
  });
  
  return url.toString();
};

/**
 * Format provider game URL with parameters
 * @param {Object} params - Provider game parameters
 * @returns {string} - Formatted URL
 */
const formatProviderGameUrl = (params) => {
  const url = new URL(playwin6Config.providerGameUrl);
  
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, params[key]);
    }
  });
  
  return url.toString();
};

module.exports = {
  generateAESHash,
  decryptAESHash,
  generatePlayerCredentials,
  generateTimestamp,
  formatAmount,
  parseAmount,
  getUserCurrency,
  validateIPAddress,
  makePlayWin6Request,
  validateGameType,
  validateProvider,
  generateSessionToken,
  validateCallbackData,
  formatGameLaunchUrl,
  formatProviderGameUrl
}; 