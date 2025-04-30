// utils/mxPaySignature.js
import crypto from 'crypto';

/**
 * Generate signature for MxPay gateway
 * @param {Object} params - Parameters to sign
 * @param {string} secretKey - Merchant's secret key
 * @returns {string} - Uppercase MD5 signature
 */
export const generateMxPaySignature = (params, secretKey) => {
  try {
    // 1. Create a sorted map by keys (according to ASCII code)
    const sortedParams = {};
    
    // Sort keys using JavaScript's built-in sort
    Object.keys(params)
      .sort()
      .forEach(key => {
        // Skip empty values and sign itself
        if (params[key] !== undefined && 
            params[key] !== '' && 
            params[key] !== null &&
            key !== 'sign' &&
            key !== 'attach') { // The doc says 'attach' is not involved in signature verification
          sortedParams[key] = params[key];
        }
      });
    
    // 2. Build the query string in k=v&k=v format
    let queryString = '';
    Object.entries(sortedParams).forEach(([key, value], index) => {
      if (index > 0) {
        queryString += '&';
      }
      queryString += `${key}=${value}`;
    });
    
    // 3. Append the secret key
    queryString += `&key=${secretKey}`;
    
    // 4. Generate MD5 hash (uppercase)
    const signature = crypto
      .createHash('md5')
      .update(queryString)
      .digest('hex')
      .toUpperCase();
    
    return signature;
  } catch (error) {
    console.error('Error generating MxPay signature:', error);
    throw error;
  }
};

/**
 * Verify signature from MxPay callback
 * @param {Object} callbackData - Callback data from gateway
 * @param {string} receivedSign - Signature to verify
 * @param {string} secretKey - Merchant's secret key
 * @returns {boolean} - Whether the signature is valid
 */
export const verifyMxPaySignature = (callbackData, receivedSign, secretKey) => {
  try {
    // Clone data and remove sign itself
    const dataToVerify = { ...callbackData };
    delete dataToVerify.sign;
    delete dataToVerify.attach; // Exclude attach from signature verification
    
    // Generate signature for verification
    const calculatedSign = generateMxPaySignature(dataToVerify, secretKey);
    
    // Compare signatures
    return calculatedSign === receivedSign;
  } catch (error) {
    console.error('Error verifying MxPay signature:', error);
    return false;
  }
};

export default {
  generateMxPaySignature,
  verifyMxPaySignature
};