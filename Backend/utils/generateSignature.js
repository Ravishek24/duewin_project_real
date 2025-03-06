import crypto from 'crypto';
import qs from 'querystring';
import { paymentConfig } from '../config/paymentConfig.js';

/**
 * Generate MD5 signature for API request
 * @param {Object} params - The request parameters
 * @returns {string} - The generated signature
 */
export const generateSignature = (params) => {
  // Sort the parameters in lexicographic order
  const sortedParams = Object.keys(params)
    .filter((key) => params[key] !== "" && params[key] !== undefined) // Remove empty values
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});

  // Convert to URL key-value pair format
  const queryString = qs.stringify(sortedParams);
  
  // Append private key
  const stringToSign = `${queryString}&key=${paymentConfig.key}`;
  
  // Generate MD5 hash and return in lowercase
  return crypto.createHash('md5').update(stringToSign).digest('hex').toLowerCase();
};
