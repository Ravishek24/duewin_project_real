// utils/seamlessUtils.js
const crypto = require('crypto');
const { seamlessConfig } = require('../config/seamlessConfig');

/**
 * Validate the signature in a seamless wallet request
 * @param {Object} queryParams - The query parameters from the request
 * @returns {boolean} - Whether the signature is valid
 */
const validateSeamlessSignature = (queryParams) => {
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
const generateSeamlessSignature = (params) => {
  try {
    // Sort parameters alphabetically
    const sortedParams = {};
    Object.keys(params)
      .sort()
      .forEach(key => {
        sortedParams[key] = params[key];
      });
    
    // Build the query string from parameters
    const queryString = Object.entries(sortedParams)
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

module.exports = {
  validateSeamlessSignature,
  generateSeamlessSignature
};