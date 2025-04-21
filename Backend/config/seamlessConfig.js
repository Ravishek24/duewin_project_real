// config/seamlessConfig.js
import dotenv from 'dotenv';

dotenv.config();

export const seamlessConfig = {
  // API Credentials (should be stored in environment variables)
  api_login: process.env.SEAMLESS_API_LOGIN || 'your_api_login',
  api_password: process.env.SEAMLESS_API_PASSWORD || 'your_api_password',
  
  // Salt key for request validation
  salt_key: process.env.SEAMLESS_SALT_KEY || 'your_salt_key',
  
  // API URLs
  api_url: {
    staging: 'https://stage.game-program.com/api/seamless/provider',
    production: process.env.NODE_ENV === 'production' 
      ? process.env.SEAMLESS_API_URL 
      : 'https://stage.game-program.com/api/seamless/provider'
  },
  
  // Default language
  default_language: 'en',
  
  // Default currency
  default_currency: 'INR',
  
  // Default URLs
  home_url: process.env.FRONTEND_URL || 'http://localhost:3000',
  cashier_url: process.env.FRONTEND_URL ? `${process.env.FRONTEND_URL}/wallet` : 'http://localhost:3000/wallet',
  
  // Free rounds settings
  default_betlevel: 'min',
  
  // Session expiration time in seconds (24 hours)
  session_expiry: 86400,
  
  // Callback timeout (in milliseconds)
  callback_timeout: 10000
};

export default seamlessConfig;

// utils/seamlessUtils.js
import crypto from 'crypto';
import { seamlessConfig } from '../config/seamlessConfig.js';

/**
 * Validate the signature in a seamless wallet request
 * @param {Object} queryParams - The query parameters from the request
 * @returns {boolean} - Whether the signature is valid
 */
export const validateSeamlessSignature = (queryParams) => {
  try {
    // Clone the query parameters
    const params = { ...queryParams };
    
    // Extract the key (signature)
    const receivedKey = params.key;
    delete params.key;
    
    // Sort parameters alphabetically as required by the API
    const sortedParams = {};
    Object.keys(params)
      .sort()
      .forEach(key => {
        sortedParams[key] = params[key];
      });
    
    // Build the query string
    const queryString = Object.entries(sortedParams)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    
    // Generate the expected hash
    const expectedKey = crypto
      .createHash('sha1')
      .update(seamlessConfig.salt_key + queryString)
      .digest('hex');
    
    // Compare the keys
    return receivedKey === expectedKey;
  } catch (error) {
    console.error('Error validating seamless signature:', error);
    return false;
  }
};

/**
 * Generate a signature for outgoing requests
 * @param {Object} params - The parameters to include in the signature
 * @returns {string} - The generated signature
 */
export const generateSeamlessSignature = (params) => {
  try {
    // Build the query string from parameters
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    
    // Generate the hash
    return crypto
      .createHash('sha1')
      .update(seamlessConfig.salt_key + queryString)
      .digest('hex');
  } catch (error) {
    console.error('Error generating seamless signature:', error);
    return '';
  }
};

export default {
  validateSeamlessSignature,
  generateSeamlessSignature
};