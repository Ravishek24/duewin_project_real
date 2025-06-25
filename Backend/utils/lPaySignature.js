const crypto = require('crypto');

/**
 * Generate signature for L_pay gateway
 * @param {Object} params - Parameters to sign
 * @param {string} secretKey - Merchant's secret key
 * @returns {string} - Uppercase MD5 signature
 */
const generateLPaySignature = (params, secretKey) => {
  try {
    // 1. Create a sorted map by keys (ASCII order)
    const sortedParams = {};
    Object.keys(params)
      .sort()
      .forEach(key => {
        // Skip empty values, sign, and attach (per doc)
        if (
          params[key] !== undefined &&
          params[key] !== '' &&
          params[key] !== null &&
          key !== 'sign' &&
          key !== 'attach'
        ) {
          sortedParams[key] = params[key];
        }
      });
    // 2. Build the query string in k=v&k=v format
    let queryString = '';
    Object.entries(sortedParams).forEach(([key, value], index) => {
      if (index > 0) queryString += '&';
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
    console.error('Error generating LPay signature:', error);
    throw error;
  }
};

/**
 * Verify signature from L_pay callback
 * @param {Object} callbackData - Callback data from gateway
 * @param {string} receivedSign - Signature to verify
 * @param {string} secretKey - Merchant's secret key
 * @returns {boolean} - Whether the signature is valid
 */
const verifyLPaySignature = (callbackData, receivedSign, secretKey) => {
  try {
    // Clone data and remove sign and attach
    const dataToVerify = { ...callbackData };
    delete dataToVerify.sign;
    delete dataToVerify.attach;
    // Generate signature for verification
    const calculatedSign = generateLPaySignature(dataToVerify, secretKey);
    // Compare signatures
    return calculatedSign === receivedSign;
  } catch (error) {
    console.error('Error verifying LPay signature:', error);
    return false;
  }
};

module.exports = {
  generateLPaySignature,
  verifyLPaySignature
}; 