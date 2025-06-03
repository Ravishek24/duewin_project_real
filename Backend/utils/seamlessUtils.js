// utils/seamlessUtils.js - FIXED SIGNATURE VALIDATION
const crypto = require('crypto');
const seamlessConfig = require('../config/seamlessConfig');

/**
 * Validate the signature in a seamless wallet request
 * According to docs: key = sha1([SALT KEY]+[QUERY STRING])
 * @param {Object} queryParams - The query parameters from the request
 * @returns {boolean} - Whether the signature is valid
 */
// 1. CRITICAL: Signature validation must match docs exactly
const validateSeamlessSignature = (queryParams) => {
  try {
    console.log('🔐 === SIGNATURE VALIDATION ===');
    console.log('🔐 Query params received:', queryParams);
    
    const params = { ...queryParams };
    const receivedKey = params.key;
    delete params.key;
    
    if (!receivedKey) {
      console.error('❌ No key parameter found in request');
      return false;
    }
    
    // CRITICAL: DO NOT SORT - Use the original order from the URL
    // The signature is calculated based on the exact order the provider sends
    // We need to reconstruct the original query string order
    
    // Looking at your logs, the actual order sent by the provider appears to be:
    // callerId, callerPassword, callerPrefix, action, remote_id, username, session_id, currency, provider, gamesession_id, original_session_id
    
    const parameterOrder = [
      'callerId',
      'callerPassword', 
      'callerPrefix',
      'action',
      'remote_id',
      'username', 
      'session_id',
      'currency',
      'provider',
      'gamesession_id',
      'original_session_id'
    ];
    
    // Build query string in the provider's expected order
    const queryStringParts = [];
    
    // Add parameters in the expected order if they exist
    parameterOrder.forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        queryStringParts.push(`${key}=${params[key]}`);
      }
    });
    
    // Add any remaining parameters that weren't in our expected order
    Object.keys(params).forEach(key => {
      if (!parameterOrder.includes(key)) {
        queryStringParts.push(`${key}=${params[key]}`);
      }
    });
    
    const queryString = queryStringParts.join('&');
    
    console.log('🔐 Reconstructed query string:', queryString);
    console.log('🔐 Salt key:', process.env.SEAMLESS_SALT_KEY);
    
    // Calculate expected signature: sha1(SALT_KEY + QUERY_STRING)
    const expectedKey = crypto
      .createHash('sha1')
      .update(process.env.SEAMLESS_SALT_KEY + queryString)
      .digest('hex');
    
    console.log('🔐 Expected key:', expectedKey);
    console.log('🔐 Received key:', receivedKey);
    
    const isValid = receivedKey === expectedKey;
    console.log('🔐 Signature validation result:', isValid);
    
    // If validation fails, try alternative parameter orders
    if (!isValid) {
      console.log('🔐 Trying alternative parameter ordering...');
      
      // Alternative 1: Alphabetical order (what we were doing before)
      const sortedKeys = Object.keys(params).sort();
      const sortedQueryString = sortedKeys
        .map(key => `${key}=${params[key]}`)
        .join('&');
      
      const alternativeKey1 = crypto
        .createHash('sha1')
        .update(process.env.SEAMLESS_SALT_KEY + sortedQueryString)
        .digest('hex');
        
      console.log('🔐 Alternative 1 (sorted):', alternativeKey1);
      console.log('🔐 Alternative 1 query string:', sortedQueryString);
      
      if (receivedKey === alternativeKey1) {
        console.log('✅ Signature valid with sorted parameters');
        return true;
      }
      
      // Alternative 2: Try the exact order from the HTTP request
      // This requires parsing the original URL, but for now let's try common orders
      const commonOrder = [
        'action',
        'callerId', 
        'callerPassword',
        'callerPrefix',
        'remote_id',
        'username',
        'session_id',
        'currency',
        'provider',
        'gamesession_id',
        'original_session_id'
      ];
      
      const commonQueryString = commonOrder
        .filter(key => params[key] !== undefined)
        .map(key => `${key}=${params[key]}`)
        .join('&');
        
      const alternativeKey2 = crypto
        .createHash('sha1')
        .update(process.env.SEAMLESS_SALT_KEY + commonQueryString)
        .digest('hex');
        
      console.log('🔐 Alternative 2 (common order):', alternativeKey2);
      console.log('🔐 Alternative 2 query string:', commonQueryString);
      
      if (receivedKey === alternativeKey2) {
        console.log('✅ Signature valid with common parameter order');
        return true;
      }
    }
    
    return isValid;
  } catch (error) {
    console.error('❌ Error validating signature:', error);
    return false;
  }
};


/**
 * Generate a signature for outgoing requests to the provider
 * @param {Object} params - The parameters to include in the signature
 * @returns {string} - The generated signature
 */
/**
 * FIXED: Generate a signature for outgoing requests
 */
const generateSeamlessSignature = (params) => {
  try {
    console.log('🔐 === GENERATING SIGNATURE ===');
    console.log('🔐 Params for signature:', params);
    
    // Sort parameters alphabetically for outgoing requests
    const sortedKeys = Object.keys(params).sort();
    const queryString = sortedKeys
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    console.log('🔐 Query string for signature:', queryString);
    
    const signature = crypto
      .createHash('sha1')
      .update(process.env.SEAMLESS_SALT_KEY + queryString)
      .digest('hex');
    
    console.log('🔐 Generated signature:', signature);
    
    return signature;
  } catch (error) {
    console.error('❌ Error generating signature:', error);
    return '';
  }
};


/**
 * Validate caller credentials (basic authentication)
 * @param {Object} queryParams - Query parameters containing callerId and callerPassword
 * @returns {boolean} - Whether credentials are valid
 */
const validateCallerCredentials = (queryParams) => {
  try {
    const { callerId, callerPassword } = queryParams;
    
    if (!callerId || !callerPassword) {
      console.error('❌ Missing caller credentials');
      return false;
    }
    
    // Validate callerId (should match api_login)
    const expectedCallerId = process.env.SEAMLESS_API_LOGIN;
    const callerIdValid = callerId === expectedCallerId;
    
    // Validate callerPassword (should be MD5 of api_password OR SHA1)
    const expectedCallerPasswordMD5 = crypto
      .createHash('md5')
      .update(process.env.SEAMLESS_API_PASSWORD)
      .digest('hex');
      
    const expectedCallerPasswordSHA1 = crypto
      .createHash('sha1')
      .update(process.env.SEAMLESS_API_PASSWORD)
      .digest('hex');
    
    const callerPasswordValid = callerPassword === expectedCallerPasswordMD5 || 
                               callerPassword === expectedCallerPasswordSHA1 ||
                               callerPassword === process.env.SEAMLESS_API_PASSWORD;
    
    console.log('🔐 Caller ID validation:', {
      expected: expectedCallerId,
      received: callerId,
      valid: callerIdValid
    });
    
    console.log('🔐 Caller password validation:', {
      received: callerPassword,
      valid: callerPasswordValid
    });
    
    return callerIdValid && callerPasswordValid;
  } catch (error) {
    console.error('❌ Error validating caller credentials:', error);
    return false;
  }
};

/**
 * ENHANCED: Try to validate signature with original URL parameter order
 */
const validateSeamlessSignatureFromURL = (originalUrl, queryParams) => {
  try {
    console.log('🔐 === SIGNATURE VALIDATION FROM URL ===');
    
    const params = { ...queryParams };
    const receivedKey = params.key;
    delete params.key;
    
    if (!receivedKey) {
      console.error('❌ No key parameter found');
      return false;
    }
    
    // Extract query string from original URL (everything after ?)
    const urlParts = originalUrl.split('?');
    if (urlParts.length < 2) {
      console.error('❌ No query string in URL');
      return validateSeamlessSignature(queryParams); // Fallback
    }
    
    let queryString = urlParts[1];
    
    // Remove the key parameter from the end
    const keyIndex = queryString.lastIndexOf('&key=');
    if (keyIndex !== -1) {
      queryString = queryString.substring(0, keyIndex);
    } else {
      // Key might be the first parameter
      const keyFirstIndex = queryString.indexOf('key=');
      if (keyFirstIndex === 0) {
        const nextParam = queryString.indexOf('&');
        if (nextParam !== -1) {
          queryString = queryString.substring(nextParam + 1);
        } else {
          queryString = '';
        }
      }
    }
    
    console.log('🔐 Original query string (without key):', queryString);
    console.log('🔐 Salt key:', process.env.SEAMLESS_SALT_KEY);
    
    // Calculate signature with original order
    const expectedKey = crypto
      .createHash('sha1')
      .update(process.env.SEAMLESS_SALT_KEY + queryString)
      .digest('hex');
    
    console.log('🔐 Expected key (original order):', expectedKey);
    console.log('🔐 Received key:', receivedKey);
    
    const isValid = receivedKey === expectedKey;
    console.log('🔐 Signature validation result (original order):', isValid);
    
    if (!isValid) {
      console.log('🔐 Original order failed, falling back to standard validation');
      return validateSeamlessSignature(queryParams);
    }
    
    return isValid;
  } catch (error) {
    console.error('❌ Error validating signature from URL:', error);
    return validateSeamlessSignature(queryParams); // Fallback
  }
};

/**
 * Enhanced signature validation that also checks caller credentials
 * @param {Object} queryParams - All query parameters
 * @returns {boolean} - Whether the request is valid
 */
const validateSeamlessRequest = (queryParams) => {
  try {
    console.log('🔐 Starting complete request validation...');
    
    // For development, you might want to bypass validation temporarily
    if (process.env.NODE_ENV === 'development' && process.env.BYPASS_SIGNATURE_VALIDATION === 'true') {
      console.log('⚠️ BYPASSING SIGNATURE VALIDATION FOR DEVELOPMENT');
      return true;
    }
    
    // First validate caller credentials
    const credentialsValid = validateCallerCredentials(queryParams);
    if (!credentialsValid) {
      console.error('❌ Caller credentials validation failed');
      return false;
    }
    
    // Then validate signature
    const signatureValid = validateSeamlessSignature(queryParams);
    if (!signatureValid) {
      console.error('❌ Signature validation failed');
      return false;
    }
    
    console.log('✅ Complete request validation successful');
    return true;
  } catch (error) {
    console.error('❌ Error in complete request validation:', error);
    return false;
  }
};

/**
 * Test signature validation with known values
 */
const testSignatureValidation = () => {
  console.log('🧪 === TESTING SIGNATURE VALIDATION ===');
  
  // Test with your actual received parameters
  const testParams = {
    callerId: 'flywin_mc_s',
    callerPassword: '2c90816c9475027980a84afd2ba3a7c03817011e',
    callerPrefix: '8fa8',
    action: 'balance',
    remote_id: '1992440',
    username: 'player13',
    session_id: '68366c46e4915',
    currency: 'EUR',
    provider: 'sr',
    gamesession_id: 'sr_149677-1703685-08b57c412ffa27c7f8d0c4b5db5b586c',
    original_session_id: '68366c46e4915',
    key: '4bac38b952e06030d3d01b1b02e2e23588b98567'
  };
  
  const isValid = validateSeamlessSignature(testParams);
  
  console.log('🧪 Test result:', isValid);
  console.log('🧪 =====================================');
  
  return isValid;
};


module.exports = {
  validateSeamlessSignature,
  generateSeamlessSignature,
  validateCallerCredentials,
  validateSeamlessRequest,
  testSignatureValidation,
  validateSeamlessSignatureFromURL
};