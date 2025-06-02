// Backend/scripts/test-seamless-callbacks.js
// Test script to verify seamless wallet callbacks

const axios = require('axios');
const crypto = require('crypto');

// Configuration - UPDATE THESE VALUES
const config = {
  // Your callback URL
  baseUrl: 'https://strike.atsproduct.in/api/seamless-games',
  
  // Test credentials (should match your seamless config)
  api_login: 'flywin_mc_s',
  api_password: 'NbRWpbhtEVf8wIYW5G',
  salt_key: 'zPNWR8Y91Y', // UPDATE WITH YOUR REAL SALT KEY
  
  // Test player data
  test_player: {
    remote_id: 'player13',
    username: 'player13',
    session_id: 'test_session_' + Date.now(),
    currency: 'EUR',
    game_id: '169542',
    transaction_id: 'test_tx_' + Date.now()
  }
};

// Generate signature for test requests
function generateSignature(params, saltKey) {
  // Sort parameters alphabetically
  const sortedParams = {};
  Object.keys(params)
    .sort()
    .forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        sortedParams[key] = params[key];
      }
    });
  
  // Build query string
  const queryString = Object.entries(sortedParams)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  
  // Generate SHA1 hash
  const stringToHash = saltKey + queryString;
  return crypto.createHash('sha1').update(stringToHash).digest('hex');
}

// Generate MD5 hash for caller password
function generateCallerPassword(password) {
  return crypto.createHash('md5').update(password).digest('hex');
}

// Test individual callback endpoint
async function testCallback(action, additionalParams = {}) {
  try {
    console.log(`\n🧪 Testing ${action.toUpperCase()} callback...`);
    
    // Base parameters for all requests
    const baseParams = {
      action: action,
      callerId: config.api_login,
      callerPassword: generateCallerPassword(config.api_password),
      callerPrefix: '700ha', // Example prefix from docs
      remote_id: config.test_player.remote_id,
      username: config.test_player.username,
      session_id: config.test_player.session_id,
      currency: config.test_player.currency,
      provider: 'ha'
    };
    
    // Add action-specific parameters
    const params = { ...baseParams, ...additionalParams };
    
    // Generate signature
    params.key = generateSignature(params, config.salt_key);
    
    // Build URL with query parameters
    const queryString = Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
    
    const url = `${config.baseUrl}/callback?${queryString}`;
    
    console.log(`📤 Request URL: ${url.substring(0, 150)}...`);
    console.log(`📤 Parameters:`, {
      action: params.action,
      remote_id: params.remote_id,
      session_id: params.session_id,
      signature: params.key,
      amount: params.amount || 'N/A'
    });
    
    // Make the request
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'SeamlessWalletTest/1.0'
      }
    });
    
    console.log(`✅ Response Status: ${response.status}`);
    console.log(`📥 Response Data:`, response.data);
    
    // Validate response format
    if (response.data && response.data.status) {
      if (response.data.status === '200') {
        console.log(`✅ ${action.toUpperCase()} callback SUCCESS`);
      } else {
        console.log(`❌ ${action.toUpperCase()} callback FAILED - Status: ${response.data.status}, Message: ${response.data.msg}`);
      }
    } else {
      console.log(`⚠️ ${action.toUpperCase()} callback - Unexpected response format`);
    }
    
    return response.data;
    
  } catch (error) {
    console.log(`❌ ${action.toUpperCase()} callback ERROR:`, error.message);
    if (error.response) {
      console.log(`📥 Error Response:`, error.response.data);
    }
    return null;
  }
}

// Main test function
async function runCallbackTests() {
  console.log('🚀 Starting Seamless Wallet Callback Tests');
  console.log('🔗 Testing URL:', config.baseUrl);
  console.log('👤 Test Player:', config.test_player.remote_id);
  
  // Check if salt key is configured
  if (config.salt_key === 'your_actual_salt_key') {
    console.log('⚠️ WARNING: Salt key is not configured! Update the salt_key in this script.');
    console.log('⚠️ Tests will likely fail due to signature validation.');
  }
  
  const results = {};
  
  // Test 1: Health check
  console.log('\n📋 Step 1: Testing health endpoint...');
  try {
    const healthResponse = await axios.get(`${config.baseUrl}/health`);
    console.log('✅ Health check passed:', healthResponse.data);
    results.health = 'PASS';
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
    results.health = 'FAIL';
  }
  
  // Test 2: Balance callback
  results.balance = await testCallback('balance', {
    game_id: config.test_player.game_id,
    game_id_hash: `ha_${config.test_player.game_id}`
  }) ? 'PASS' : 'FAIL';
  
  // Test 3: Debit callback (bet)
  results.debit = await testCallback('debit', {
    amount: '10.00',
    game_id: config.test_player.game_id,
    game_id_hash: `ha_${config.test_player.game_id}`,
    transaction_id: config.test_player.transaction_id,
    round_id: 'test_round_' + Date.now(),
    gameplay_final: '0',
    is_freeround_bet: '0',
    jackpot_contribution_in_amount: '0',
    gamesession_id: 'test_gamesession_' + Date.now()
  }) ? 'PASS' : 'FAIL';
  
  // Test 4: Credit callback (win)
  results.credit = await testCallback('credit', {
    amount: '15.00',
    game_id: config.test_player.game_id,
    game_id_hash: `ha_${config.test_player.game_id}`,
    transaction_id: 'test_tx_credit_' + Date.now(),
    round_id: 'test_round_' + Date.now(),
    gameplay_final: '1',
    is_freeround_win: '0',
    is_jackpot_win: '0'
  }) ? 'PASS' : 'FAIL';
  
  // Test 5: Rollback callback
  results.rollback = await testCallback('rollback', {
    amount: '10.00',
    game_id: config.test_player.game_id,
    game_id_hash: `ha_${config.test_player.game_id}`,
    transaction_id: config.test_player.transaction_id, // Rolling back the debit transaction
    round_id: 'test_round_' + Date.now()
  }) ? 'PASS' : 'FAIL';
  
  // Summary
  console.log('\n📊 TEST RESULTS SUMMARY:');
  console.log('========================');
  Object.entries(results).forEach(([test, result]) => {
    const icon = result === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${test.toUpperCase()}: ${result}`);
  });
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r === 'PASS').length;
  
  console.log(`\n🏆 Overall: ${passedTests}/${totalTests} tests passed`);
  
  if (passedTests === totalTests) {
    console.log('🎉 All tests passed! Your seamless wallet callbacks are working correctly.');
  } else {
    console.log('⚠️ Some tests failed. Check the logs above for details.');
    console.log('\n🔧 Common issues:');
    console.log('- Salt key not configured correctly');
    console.log('- Server IP not whitelisted by provider');
    console.log('- Database connection issues');
    console.log('- User/wallet not found in database');
  }
}

// Run tests if script is executed directly
if (require.main === module) {
  runCallbackTests().catch(console.error);
}

module.exports = { runCallbackTests, testCallback };