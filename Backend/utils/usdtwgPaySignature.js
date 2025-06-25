const crypto = require('crypto');

/**
 * Generate HMAC-SHA256 signature (base64) for usdtwgpay
 * @param {string} method - HTTP method (GET/POST, uppercase)
 * @param {string} urlPath - Path only, e.g. /api/merchant/Balance
 * @param {string} accessKey
 * @param {string|number} timestamp
 * @param {string} nonce
 * @param {string} accessSecret
 * @returns {string} - base64 signature
 */
function generateUsdtwgPaySignature(method, urlPath, accessKey, timestamp, nonce, accessSecret) {
  const signatureData = `${method.toUpperCase()}&${urlPath}&${accessKey}&${timestamp}&${nonce}`;
  const hmac = crypto.createHmac('sha256', accessSecret);
  hmac.update(signatureData);
  return hmac.digest('base64');
}

/**
 * Verify signature from usdtwgpay callback
 * @param {string} method
 * @param {string} urlPath
 * @param {string} accessKey
 * @param {string|number} timestamp
 * @param {string} nonce
 * @param {string} accessSecret
 * @param {string} receivedSign
 * @returns {boolean}
 */
function verifyUsdtwgPaySignature(method, urlPath, accessKey, timestamp, nonce, accessSecret, receivedSign) {
  const expectedSign = generateUsdtwgPaySignature(method, urlPath, accessKey, timestamp, nonce, accessSecret);
  return expectedSign === receivedSign;
}

module.exports = {
  generateUsdtwgPaySignature,
  verifyUsdtwgPaySignature
}; 