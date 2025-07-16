const crypto = require('crypto');
const qs = require('querystring');
const paymentConfig = require('../config/paymentConfig');

/**
 * Generate MD5 signature for API request
 * @param {Object} params - The request parameters
 * @returns {string} - The generated signature
 */
const generateSignature = (params) => {
  // Exclude 'sign' and empty/undefined values
  const sortedParams = Object.keys(params)
    .filter((key) => key !== 'sign' && params[key] !== '' && params[key] !== undefined)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});

  // Build the string with raw values (no URL encoding)
  const queryString = Object.keys(sortedParams)
    .map(key => `${key}=${sortedParams[key]}`)
    .join('&');
  const stringToSign = `${queryString}&key=${paymentConfig.key}`;
  return crypto.createHash('md5').update(stringToSign).digest('hex').toLowerCase();
};

module.exports = { generateSignature };
