// utils/spribeSignatureUtils.js - SPRIBE SIGNATURE VALIDATION WITH BACKWARD COMPATIBILITY

const crypto = require('crypto');
const spribeConfig = require('../config/spribeConfig');

/**
 * Validate Spribe request signature with backward compatibility
 * @param {Object} req - Express request object
 * @returns {boolean} - True if signature is valid
 */
const validateSpribeSignature = (req) => {
  try {
    console.log('🔐 ===== VALIDATING SPRIBE SIGNATURE =====');
    
    // Get required headers
    const clientId = req.headers['x-spribe-client-id'];
    const timestamp = req.headers['x-spribe-client-ts'];
    const signature = req.headers['x-spribe-client-signature'];
    
    console.log('📦 Headers received:', {
      clientId: clientId ? clientId.substring(0, 8) + '...' : null,
      timestamp,
      signature: signature ? signature.substring(0, 16) + '...' : null
    });
    
    // 🔥 BACKWARD COMPATIBILITY: If headers are missing, check if this is a test environment
    if (!clientId || !timestamp || !signature) {
      console.log('⚠️ Missing security headers - checking for test environment compatibility');
      
      // Check if this is a test environment using the new config method
      const isTestEnvironment = spribeConfig.isTestEnvironment();
      
      if (isTestEnvironment) {
        console.log('✅ Test environment detected - allowing request without headers');
        console.log('🔍 Environment details:', {
          apiBaseUrl: spribeConfig.apiBaseUrl,
          nodeEnv: process.env.NODE_ENV,
          securityMode: spribeConfig.securityMode
        });
        return true; // Allow in test environment
      }
      
      console.error('❌ Missing required headers in production environment:', {
        clientId: !!clientId,
        timestamp: !!timestamp,
        signature: !!signature
      });
      return false;
    }
    
    // 🔥 STRICT VALIDATION: If headers are present, validate them properly
    console.log('🔍 Validating headers in strict mode');
    
    // Validate client ID
    if (clientId !== spribeConfig.clientId) {
      console.error('❌ Invalid client ID:', {
        received: clientId,
        expected: spribeConfig.clientId
      });
      return false;
    }
    
    // Validate timestamp (should be within 5 minutes)
    const currentTime = Math.floor(Date.now() / 1000);
    const requestTime = parseInt(timestamp);
    const timeDiff = Math.abs(currentTime - requestTime);
    
    if (timeDiff > 300) { // 5 minutes
      console.error('❌ Timestamp expired:', {
        currentTime,
        requestTime,
        timeDiff
      });
      return false;
    }
    
    // Create signature string according to Spribe docs
    const path = req.path; // e.g., "/auth", "/withdraw"
    const body = req.body ? JSON.stringify(req.body) : '';
    
    // Concatenate: timestamp + path + body
    const signatureString = timestamp + path + body;
    
    console.log('🔍 Signature components:', {
      timestamp,
      path,
      bodyLength: body.length,
      signatureStringLength: signatureString.length
    });
    
    // Generate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', spribeConfig.clientSecret)
      .update(signatureString)
      .digest('hex');
    
    console.log('🔍 Signature comparison:', {
      received: signature.substring(0, 16) + '...',
      expected: expectedSignature.substring(0, 16) + '...',
      match: signature.toLowerCase() === expectedSignature.toLowerCase()
    });
    
    // Compare signatures (case-insensitive)
    const isValid = signature.toLowerCase() === expectedSignature.toLowerCase();
    
    if (isValid) {
      console.log('✅ Signature validation successful');
    } else {
      console.error('❌ Signature validation failed');
    }
    
    return isValid;
    
  } catch (error) {
    console.error('❌ Signature validation error:', error);
    return false;
  }
};

/**
 * Generate Spribe headers for outgoing requests
 * @param {string} path - Request path
 * @param {Object|string} body - Request body
 * @param {string} clientId - Client ID
 * @param {string} clientSecret - Client secret
 * @returns {Object} - Headers object
 */
const generateSpribeHeaders = (path, body, clientId, clientSecret) => {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyString = body ? JSON.stringify(body) : '';
  const signatureString = timestamp + path + bodyString;
  
  const signature = crypto
    .createHmac('sha256', clientSecret)
    .update(signatureString)
    .digest('hex');
  
  return {
    'X-Spribe-Client-ID': clientId,
    'X-Spribe-Client-TS': timestamp,
    'X-Spribe-Client-Signature': signature,
    'Content-Type': 'application/json; charset=utf-8'
  };
};

module.exports = {
  validateSpribeSignature,
  generateSpribeHeaders
}; 