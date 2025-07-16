// test-spribe-auth.js - Test SPRIBE authentication flow
const axios = require('axios');
const crypto = require('crypto');

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'https://api.strikecolor1.com', // Your API base URL
  clientId: process.env.SPRIBE_CLIENT_ID || 'strike',
  clientSecret: process.env.SPRIBE_CLIENT_SECRET || 'test_secret',
  userId: 13,
  gameId: 'aviator'
};

/**
 * Generate SPRIBE headers for testing
 */
const generateTestHeaders = (path, body) => {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const bodyString = body ? JSON.stringify(body) : '';
  const signatureString = timestamp + path + bodyString;
  
  const signature = crypto
    .createHmac('sha256', TEST_CONFIG.clientSecret)
    .update(signatureString)
    .digest('hex');
  
  return {
    'X-Spribe-Client-ID': TEST_CONFIG.clientId,
    'X-Spribe-Client-TS': timestamp,
    'X-Spribe-Client-Signature': signature,
    'Content-Type': 'application/json; charset=utf-8'
  };
};

/**
 * Test authentication without headers (simulating current SPRIBE behavior)
 */
const testAuthWithoutHeaders = async () => {
  console.log('\n🧪 ===== TESTING AUTH WITHOUT HEADERS =====');
  
  try {
    const authData = {
      user_token: 'b4dbcadd6f3fb6c6b37ed7fd24d6099d68527d18160812df77e3cf5c35ef180a',
      session_token: 'b213d8c4ef5843a68befa45ca754f3bf',
      platform: 'mobile',
      currency: 'USD'
    };
    
    const response = await axios.post(`${TEST_CONFIG.baseUrl}/api/spribe/auth`, authData, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      }
    });
    
    console.log('✅ Auth without headers successful:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Auth without headers failed:', {
      status: error.response?.status,
      data: error.response?.data
    });
    return false;
  }
};

/**
 * Test authentication with headers (simulating v1.9.0+ behavior)
 */
const testAuthWithHeaders = async () => {
  console.log('\n🧪 ===== TESTING AUTH WITH HEADERS =====');
  
  try {
    const authData = {
      user_token: 'b4dbcadd6f3fb6c6b37ed7fd24d6099d68527d18160812df77e3cf5c35ef180a',
      session_token: 'b213d8c4ef5843a68befa45ca754f3bf',
      platform: 'mobile',
      currency: 'USD'
    };
    
    const headers = generateTestHeaders('/api/spribe/auth', authData);
    
    const response = await axios.post(`${TEST_CONFIG.baseUrl}/api/spribe/auth`, authData, {
      headers
    });
    
    console.log('✅ Auth with headers successful:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Auth with headers failed:', {
      status: error.response?.status,
      data: error.response?.data
    });
    return false;
  }
};

/**
 * Test game launch URL generation
 */
const testGameLaunch = async () => {
  console.log('\n🧪 ===== TESTING GAME LAUNCH =====');
  
  try {
    const response = await axios.get(`${TEST_CONFIG.baseUrl}/api/spribe/launch/aviator`, {
      params: {
        userId: TEST_CONFIG.userId
      }
    });
    
    console.log('✅ Game launch successful:', response.data);
    return response.data.url;
  } catch (error) {
    console.error('❌ Game launch failed:', {
      status: error.response?.status,
      data: error.response?.data
    });
    return null;
  }
};

/**
 * Run all tests
 */
const runTests = async () => {
  console.log('🚀 Starting SPRIBE integration tests...');
  
  // Test 1: Game launch
  const launchUrl = await testGameLaunch();
  
  // Test 2: Auth without headers (current SPRIBE behavior)
  const authWithoutHeaders = await testAuthWithoutHeaders();
  
  // Test 3: Auth with headers (future SPRIBE behavior)
  const authWithHeaders = await testAuthWithHeaders();
  
  // Summary
  console.log('\n📊 ===== TEST RESULTS =====');
  console.log('Game Launch:', launchUrl ? '✅ PASS' : '❌ FAIL');
  console.log('Auth (no headers):', authWithoutHeaders ? '✅ PASS' : '❌ FAIL');
  console.log('Auth (with headers):', authWithHeaders ? '✅ PASS' : '❌ FAIL');
  
  if (authWithoutHeaders && authWithHeaders) {
    console.log('\n🎉 All tests passed! SPRIBE integration is working correctly.');
  } else {
    console.log('\n⚠️ Some tests failed. Check the logs above for details.');
  }
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = {
  testAuthWithoutHeaders,
  testAuthWithHeaders,
  testGameLaunch,
  runTests
}; 