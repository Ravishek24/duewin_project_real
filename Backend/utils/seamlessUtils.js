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
    const params = { ...queryParams };
    const receivedKey = params.key;
    delete params.key;
    
    if (!receivedKey) {
      console.error('No key parameter found in request');
      return false;
    }
    
    // DOCS COMPLIANCE: Build query string WITHOUT sorting (preserve original order)
    // The docs show: action=balance&remote_id=123&session_id=123-abc&key=hash
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    
    console.log('Query string for validation:', queryString);
    console.log('Salt key:', process.env.SEAMLESS_SALT_KEY);
    
    // DOCS SPEC: sha1([SALT KEY]+[QUERY STRING])
    const expectedKey = crypto
      .createHash('sha1')
      .update(process.env.SEAMLESS_SALT_KEY + queryString)
      .digest('hex');
    
    console.log('Expected key:', expectedKey);
    console.log('Received key:', receivedKey);
    
    return receivedKey === expectedKey;
  } catch (error) {
    console.error('Error validating signature:', error);
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
    console.log('=== GENERATING SIGNATURE ===');
    console.log('Params for signature:', params);
    
    // Build the query string from parameters (preserve order)
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    
    console.log('Query string for signature:', queryString);
    
    // Generate the hash: sha1(SALT_KEY + QUERY_STRING)
    const signature = crypto
      .createHash('sha1')
      .update(seamlessConfig.salt_key + queryString)
      .digest('hex');
    
    console.log('Generated signature:', signature);
    
    return signature;
  } catch (error) {
    console.error('Error generating seamless signature:', error);
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
    
    // Check if credentials are provided
    if (!callerId || !callerPassword) {
      console.error('❌ Missing caller credentials');
      return false;
    }
    
    // Validate against configured credentials
    // According to docs: callerId = api_username, callerPassword = api_password (MD5 hashed)
    const expectedCallerId = seamlessConfig.api_login;
    
    // The callerPassword should be MD5 hash of the API password
    const expectedCallerPassword = crypto
      .createHash('md5')
      .update(seamlessConfig.api_password)
      .digest('hex');
    
    const callerIdValid = callerId === expectedCallerId;
    const callerPasswordValid = callerPassword === expectedCallerPassword;
    
    console.log('🔐 Caller ID validation:', {
      expected: expectedCallerId,
      received: callerId,
      valid: callerIdValid
    });
    
    console.log('🔐 Caller password validation:', {
      expected: expectedCallerPassword,
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
 * Enhanced signature validation that also checks caller credentials
 * @param {Object} queryParams - All query parameters
 * @returns {boolean} - Whether the request is valid
 */
const validateSeamlessRequest = (queryParams) => {
  try {
    console.log('🔐 Starting complete request validation...');
    
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
  console.log('=== TESTING SIGNATURE VALIDATION ===');
  
  // Test with sample data from the documentation
  const testParams = {
    action: 'balance',
    remote_id: '123',
    session_id: '123-abc'
  };
  
  const signature = generateSeamlessSignature(testParams);
  
  const testQuery = {
    ...testParams,
    key: signature
  };
  
  const isValid = validateSeamlessSignature(testQuery);
  
  console.log('Test signature validation result:', isValid);
  console.log('=====================================');
  
  return isValid;
};


module.exports = {
  validateSeamlessSignature,
  generateSeamlessSignature,
  validateCallerCredentials,
  validateSeamlessRequest,
  testSignatureValidation
};