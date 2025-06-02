// utils/seamlessUtils.js - FIXED SIGNATURE VALIDATION
const crypto = require('crypto');
const seamlessConfig = require('../config/seamlessConfig');

/**
 * Validate the signature in a seamless wallet request
 * According to docs: key = sha1([SALT KEY]+[QUERY STRING])
 * @param {Object} queryParams - The query parameters from the request
 * @returns {boolean} - Whether the signature is valid
 */
const validateSeamlessSignature = (queryParams) => {
  try {
    console.log('=== SIGNATURE VALIDATION DEBUG ===');
    console.log('Raw query params:', queryParams);
    
    // Clone the query parameters
    const params = { ...queryParams };
    
    // Extract the key (signature)
    const receivedKey = params.key;
    delete params.key;
    
    console.log('Received key:', receivedKey);
    console.log('Params without key:', params);
    
    if (!receivedKey) {
      console.error('No key parameter found in request');
      return false;
    }
    
    // CRITICAL FIX: Build query string exactly as the provider does
    // The query string should be built in the exact order the parameters appear
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    
    console.log('Query string for validation:', queryString);
    console.log('Salt key (first 5 chars):', seamlessConfig.salt_key.substring(0, 5) + '...');
    
    // Generate the expected hash: sha1(SALT_KEY + QUERY_STRING)
    const expectedKey = crypto
      .createHash('sha1')
      .update(seamlessConfig.salt_key + queryString)
      .digest('hex');
    
    console.log('Expected key:', expectedKey);
    console.log('Keys match:', receivedKey === expectedKey);
    
    return receivedKey === expectedKey;
  } catch (error) {
    console.error('Error validating seamless signature:', error);
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