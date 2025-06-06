const crypto = require('crypto');

/**
 * Create SPRIBE signature according to their documentation
 * @param {number} timestamp - Unix timestamp in seconds
 * @param {string} path - Request path with query parameters
 * @param {Object|string} body - Request body (for POST/PUT requests)
 * @param {string} clientSecret - SPRIBE client secret
 * @returns {string} - Generated signature
 */
const createSpribeSignature = (timestamp, path, body, clientSecret) => {
  try {
    // Create HMAC instance with SHA256
    const hmac = crypto.createHmac('sha256', clientSecret);
    
    // Convert timestamp to string
    const timestampStr = timestamp.toString();
    
    // Convert body to string if it's an object
    const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';
    
    // Update HMAC in exact order: timestamp + path + body
    hmac.update(timestampStr);
    hmac.update(path);
    if (bodyStr) {
      hmac.update(bodyStr);
    }
    
    // Get hex digest
    return hmac.digest('hex');
  } catch (error) {
    console.error('Error creating SPRIBE signature:', error);
    throw new Error(`Error creating SPRIBE signature: ${error.message}`);
  }
};

/**
 * Validate SPRIBE request signature
 * @param {string} clientId - Client ID from header
 * @param {string} timestamp - Timestamp from header
 * @param {string} signature - Signature from header
 * @param {string} path - Request path with query parameters
 * @param {Object|string} body - Request body
 * @param {string} clientSecret - SPRIBE client secret
 * @returns {boolean} - True if signature is valid
 */
const validateSpribeSignature = (clientId, timestamp, signature, path, body, clientSecret) => {
  try {
    console.log('Validating SPRIBE signature:', {
      clientId,
      timestamp,
      path,
      body,
      receivedSignature: signature
    });

    // Validate timestamp (within 5 minutes)
    const now = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp);
    
    if (Math.abs(now - requestTime) > 300) { // 5 minutes expiration
      console.error('SPRIBE request timestamp expired:', {
        requestTime,
        currentTime: now,
        difference: Math.abs(now - requestTime)
      });
      return false;
    }
    
    // Generate expected signature
    const expectedSignature = createSpribeSignature(requestTime, path, body, clientSecret);
    
    console.log('SPRIBE signature comparison:', {
      received: signature,
      expected: expectedSignature,
      matches: signature.toLowerCase() === expectedSignature.toLowerCase()
    });
    
    // Compare signatures (case-insensitive as per SPRIBE docs)
    return signature.toLowerCase() === expectedSignature.toLowerCase();
  } catch (error) {
    console.error('Error validating SPRIBE signature:', error);
    return false;
  }
};

/**
 * Generate SPRIBE security headers for outgoing requests
 * @param {string} requestUri - Request URI with query parameters
 * @param {Object|string} requestBody - Request body (for POST/PUT requests)
 * @param {string} clientId - SPRIBE client ID
 * @param {string} clientSecret - SPRIBE client secret
 * @returns {Object} - Security headers object
 */
const generateSpribeHeaders = (requestUri, requestBody, clientId, clientSecret) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createSpribeSignature(timestamp, requestUri, requestBody, clientSecret);
  
  return {
    'X-Spribe-Client-ID': clientId,
    'X-Spribe-Client-TS': timestamp.toString(),
    'X-Spribe-Client-Signature': signature,
    'Content-Type': 'application/json; charset=utf-8'
  };
};

module.exports = {
  createSpribeSignature,
  validateSpribeSignature,
  generateSpribeHeaders
}; 