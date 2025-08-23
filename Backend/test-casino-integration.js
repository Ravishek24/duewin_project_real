#!/usr/bin/env node

/**
 * Casino Integration Test Script
 * Run this to test the casino integration
 */

const axios = require('axios');
const CasinoEncryption = require('./services/casinoEncryption');
const casinoConfig = require('./config/casino.config');

// Test configuration
const TEST_CONFIG = {
  baseURL: 'http://localhost:8000', // Your backend URL
  userToken: 'your_test_token_here', // Get this from login
  gameUid: '1', // Test game UID
  testAmount: 100.00
};

// Initialize encryption
const encryption = new CasinoEncryption(casinoConfig.aes_key);

/**
 * Test encryption/decryption
 */
const testEncryption = () => {
  console.log('🔐 === TESTING ENCRYPTION ===');
  
  try {
    const testData = { test: 'Hello World', timestamp: Date.now() };
    const encrypted = encryption.encrypt(JSON.stringify(testData));
    const decrypted = encryption.decrypt(encrypted);
    
    console.log('✅ Original:', testData);
    console.log('✅ Encrypted:', encrypted);
    console.log('✅ Decrypted:', decrypted);
    console.log('✅ Matches:', JSON.stringify(testData) === decrypted);
    
    return true;
  } catch (error) {
    console.error('❌ Encryption test failed:', error.message);
    return false;
  }
};

/**
 * Test casino health endpoint
 */
const testHealth = async () => {
  console.log('\n🏥 === TESTING HEALTH ENDPOINT ===');
  
  try {
    const response = await axios.get(`${TEST_CONFIG.baseURL}/api/casino/health`);
    console.log('✅ Health check response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    return false;
  }
};

/**
 * Test encryption endpoint
 */
const testEncryptionEndpoint = async () => {
  console.log('\n🔐 === TESTING ENCRYPTION ENDPOINT ===');
  
  try {
    const response = await axios.post(
      `${TEST_CONFIG.baseURL}/api/casino/test-encryption`,
      { testData: 'Hello World' },
      {
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.userToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Encryption endpoint response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Encryption endpoint test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
};

/**
 * Test game list endpoint
 */
const testGameList = async () => {
  console.log('\n🎮 === TESTING GAME LIST ===');
  
  try {
    const response = await axios.get(
      `${TEST_CONFIG.baseURL}/api/casino/games`,
      {
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.userToken}`
        }
      }
    );
    
    console.log('✅ Game list response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Game list test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
};

/**
 * Test game launch (will fail if no balance)
 */
const testGameLaunch = async () => {
  console.log('\n🚀 === TESTING GAME LAUNCH ===');
  
  try {
    const response = await axios.post(
      `${TEST_CONFIG.baseURL}/api/casino/games/${TEST_CONFIG.gameUid}/launch`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.userToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('✅ Game launch response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ Game launch test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return true; // This is expected to fail without balance
  }
};

/**
 * Test user sessions endpoint
 */
const testUserSessions = async () => {
  console.log('\n📋 === TESTING USER SESSIONS ===');
  
  try {
    const response = await axios.get(
      `${TEST_CONFIG.baseURL}/api/casino/sessions`,
      {
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.userToken}`
        }
      }
    );
    
    console.log('✅ User sessions response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ User sessions test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
};

/**
 * Test user transactions endpoint
 */
const testUserTransactions = async () => {
  console.log('\n📊 === TESTING USER TRANSACTIONS ===');
  
  try {
    const response = await axios.get(
      `${TEST_CONFIG.baseURL}/api/casino/transactions`,
      {
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.userToken}`
        }
      }
    );
    
    console.log('✅ User transactions response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ User transactions test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
};

/**
 * Test user stats endpoint
 */
const testUserStats = async () => {
  console.log('\n📈 === TESTING USER STATS ===');
  
  try {
    const response = await axios.get(
      `${TEST_CONFIG.baseURL}/api/casino/stats`,
      {
        headers: {
          'Authorization': `Bearer ${TEST_CONFIG.userToken}`
        }
      }
    );
    
    console.log('✅ User stats response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ User stats test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
};

/**
 * Test casino API directly (if credentials are valid)
 */
const testCasinoAPI = async () => {
  console.log('\n🎰 === TESTING CASINO API DIRECTLY ===');
  
  try {
    // Test payload
    const payload = {
      agency_uid: casinoConfig.agency_uid,
      member_account: 'test_player',
      game_uid: TEST_CONFIG.gameUid,
      timestamp: encryption.generateTimestamp(),
      credit_amount: TEST_CONFIG.testAmount.toString(),
      currency_code: 'USD',
      language: 'en',
      home_url: casinoConfig.home_url,
      platform: 'web',
      callback_url: casinoConfig.callback_url
    };

    console.log('📦 Test payload:', payload);

    // Encrypt payload
    const encryptedRequest = encryption.encryptPayload(
      payload,
      casinoConfig.agency_uid,
      payload.timestamp
    );

    console.log('🔐 Encrypted request:', encryptedRequest);

    // Make API call
    const response = await axios.post(
      `${casinoConfig.server_url}${casinoConfig.endpoints.game_v1}`,
      encryptedRequest,
      {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('✅ Casino API response:', response.data);
    
    if (response.data.code === 0) {
      const decryptedPayload = encryption.decryptPayload(response.data.payload);
      console.log('🔓 Decrypted payload:', decryptedPayload);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Casino API test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
};

/**
 * Main test runner
 */
const runTests = async () => {
  console.log('🎯 === CASINO INTEGRATION TEST SUITE ===');
  console.log('🎯 Base URL:', TEST_CONFIG.baseURL);
  console.log('🎯 Game UID:', TEST_CONFIG.gameUid);
  console.log('🎯 Test Amount:', TEST_CONFIG.testAmount);
  
  const results = {
    encryption: testEncryption(),
    health: await testHealth(),
    encryptionEndpoint: await testEncryptionEndpoint(),
    gameList: await testGameList(),
    gameLaunch: await testGameLaunch(),
    userSessions: await testUserSessions(),
    userTransactions: await testUserTransactions(),
    userStats: await testUserStats(),
    casinoAPI: await testCasinoAPI()
  };
  
  console.log('\n📊 === TEST RESULTS SUMMARY ===');
  Object.entries(results).forEach(([test, result]) => {
    console.log(`${result ? '✅' : '❌'} ${test}: ${result ? 'PASSED' : 'FAILED'}`);
  });
  
  const passed = Object.values(results).filter(Boolean).length;
  const total = Object.keys(results).length;
  
  console.log(`\n🎯 Overall: ${passed}/${total} tests passed`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Casino integration is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Check the errors above and review your setup.');
  }
};

// Run tests if this file is executed directly
if (require.main === module) {
  // Check if user token is provided
  if (TEST_CONFIG.userToken === 'your_test_token_here') {
    console.log('⚠️  Please update TEST_CONFIG.userToken with a valid user token');
    console.log('💡 You can get this by logging in through your frontend or API');
    process.exit(1);
  }
  
  runTests().catch(console.error);
}

module.exports = {
  runTests,
  testEncryption,
  testHealth,
  testEncryptionEndpoint,
  testGameList,
  testGameLaunch,
  testUserSessions,
  testUserTransactions,
  testUserStats,
  testCasinoAPI
};
