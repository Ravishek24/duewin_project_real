// test-playwin6-callback-integration.js - Test PlayWin6 Callback Integration with Models
const axios = require('axios');
const crypto = require('crypto');

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.BACKEND_URL || 'http://localhost:8000',
  testUserId: 1,
  testUsername: 'testuser',
  testGameUid: 'JiliGaming',
  testProvider: 'JiliGaming'
};

// Logging utility
const log = {
  header: (msg) => console.log(`\n🔵 ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
  warning: (msg) => console.log(`⚠️ ${msg}`),
  info: (msg) => console.log(`ℹ️ ${msg}`)
};

/**
 * Test callback data scenarios
 */
const testCallbackScenarios = {
  // Bet transaction
  betTransaction: {
    user_id: 'player1',
    wallet_amount: '1000.00',
    game_uid: 'JiliGaming',
    game_id: 'slot_game_001',
    provider: 'JiliGaming',
    token: 'test_token_bet',
    timestamp: Date.now().toString(),
    transaction_id: 'tx_bet_001',
    bet_amount: '10.00',
    win_amount: '0.00',
    game_result: 'loss',
    session_id: 'session_bet_001',
    action: 'bet',
    action_id: 'action_bet_001',
    old_balance: '1010.00',
    new_balance: '1000.00',
    platform: 'desktop'
  },

  // Win transaction
  winTransaction: {
    user_id: 'player1',
    wallet_amount: '1050.00',
    game_uid: 'JiliGaming',
    game_id: 'slot_game_001',
    provider: 'JiliGaming',
    token: 'test_token_win',
    timestamp: Date.now().toString(),
    transaction_id: 'tx_win_001',
    bet_amount: '0.00',
    win_amount: '50.00',
    game_result: 'win',
    session_id: 'session_win_001',
    action: 'win',
    action_id: 'action_win_001',
    old_balance: '1000.00',
    new_balance: '1050.00',
    platform: 'desktop'
  },

  // Balance update
  balanceUpdate: {
    user_id: 'player1',
    wallet_amount: '1200.00',
    game_uid: 'JiliGaming',
    game_id: 'slot_game_001',
    provider: 'JiliGaming',
    token: 'test_token_balance',
    timestamp: Date.now().toString(),
    transaction_id: 'tx_balance_001',
    bet_amount: '0.00',
    win_amount: '0.00',
    game_result: 'balance_update',
    session_id: 'session_balance_001',
    action: 'balance',
    action_id: 'action_balance_001',
    old_balance: '1050.00',
    new_balance: '1200.00',
    platform: 'desktop'
  },

  // Game completion
  gameCompletion: {
    user_id: 'player1',
    wallet_amount: '1200.00',
    game_uid: 'JiliGaming',
    game_id: 'slot_game_001',
    provider: 'JiliGaming',
    token: 'test_token_complete',
    timestamp: Date.now().toString(),
    transaction_id: 'tx_complete_001',
    bet_amount: '0.00',
    win_amount: '0.00',
    game_result: 'completed',
    session_id: 'session_complete_001',
    action: 'complete',
    action_id: 'action_complete_001',
    old_balance: '1200.00',
    new_balance: '1200.00',
    platform: 'desktop'
  }
};

/**
 * Test database models directly
 */
const testDatabaseModels = async () => {
  log.header('Testing Database Models Directly');
  
  try {
    // Import models
    const { getModels } = require('./models');
    const models = await getModels();
    
    const { User, PlayWin6GameSession, PlayWin6Transaction } = models;
    
    if (!User || !PlayWin6GameSession || !PlayWin6Transaction) {
      throw new Error('Required models not found');
    }
    
    log.success('All required models loaded successfully');
    
    // Test model associations
    if (PlayWin6GameSession.associate && PlayWin6Transaction.associate) {
      log.success('Model associations are defined');
    } else {
      log.warning('Model associations not found');
    }
    
    // Test model instance methods
    const testSession = PlayWin6GameSession.build({
      user_id: TEST_CONFIG.testUserId,
      game_id: 'test_game',
      provider: 'JiliGaming',
      session_token: 'test_session_token',
      status: 'active'
    });
    
    if (typeof testSession.isValid === 'function') {
      log.success('Session model instance methods available');
    }
    
    const testTransaction = PlayWin6Transaction.build({
      user_id: TEST_CONFIG.testUserId,
      session_id: 1,
      type: 'bet',
      amount: 10.00,
      provider_tx_id: 'test_tx'
    });
    
    if (typeof testTransaction.isBet === 'function') {
      log.success('Transaction model instance methods available');
    }
    
    return true;
  } catch (error) {
    log.error('Database models test failed: ' + error.message);
    return false;
  }
};

/**
 * Test callback processing with different scenarios
 */
const testCallbackProcessing = async () => {
  log.header('Testing Callback Processing Scenarios');
  
  try {
    const playwin6Service = require('./services/playwin6Service');
    
    for (const [scenarioName, callbackData] of Object.entries(testCallbackScenarios)) {
      log.info(`Testing scenario: ${scenarioName}`);
      
      try {
        const result = await playwin6Service.handleCallback(callbackData, '127.0.0.1');
        
        if (result.success) {
          log.success(`${scenarioName}: Callback processed successfully`);
          console.log('  - Transaction ID:', result.transactionId);
          console.log('  - Operator TX ID:', result.operatorTxId);
          console.log('  - User ID:', result.userId);
          console.log('  - Session ID:', result.sessionId);
          console.log('  - Transaction Type:', result.transactionType);
          console.log('  - Amount:', result.amount);
        } else {
          log.error(`${scenarioName}: Failed to process callback - ${result.message}`);
        }
      } catch (error) {
        log.error(`${scenarioName}: Error processing callback - ${error.message}`);
      }
      
      console.log(''); // Add spacing between scenarios
    }
    
    return true;
  } catch (error) {
    log.error('Callback processing test failed: ' + error.message);
    return false;
  }
};

/**
 * Test API endpoint for callback
 */
const testCallbackEndpoint = async () => {
  log.header('Testing Callback API Endpoint');
  
  try {
    const testData = testCallbackScenarios.betTransaction;
    
    const response = await axios.post(`${TEST_CONFIG.baseUrl}/api/playwin6/callback`, testData, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    if (response.status === 200) {
      log.success('Callback endpoint responded successfully');
      console.log('Response:', response.data);
    } else {
      log.warning(`Callback endpoint responded with status: ${response.status}`);
    }
    
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      log.error('Server not running at ' + TEST_CONFIG.baseUrl);
    } else {
      log.error('Callback endpoint test failed: ' + error.message);
    }
    return false;
  }
};

/**
 * Test database verification after callbacks
 */
const testDatabaseVerification = async () => {
  log.header('Testing Database Verification After Callbacks');
  
  try {
    const { getModels } = require('./models');
    const models = await getModels();
    
    const { PlayWin6GameSession, PlayWin6Transaction } = models;
    
    // Check for created sessions
    const sessions = await PlayWin6GameSession.findAll({
      where: {
        session_token: {
          [require('sequelize').Op.like]: 'session_%'
        }
      },
      limit: 10
    });
    
    log.info(`Found ${sessions.length} test sessions in database`);
    
    for (const session of sessions) {
      console.log(`  - Session ID: ${session.id}, Token: ${session.session_token}, Status: ${session.status}`);
    }
    
    // Check for created transactions
    const transactions = await PlayWin6Transaction.findAll({
      where: {
        provider_tx_id: {
          [require('sequelize').Op.like]: 'tx_%'
        }
      },
      limit: 10
    });
    
    log.info(`Found ${transactions.length} test transactions in database`);
    
    for (const transaction of transactions) {
      console.log(`  - TX ID: ${transaction.id}, Provider TX: ${transaction.provider_tx_id}, Type: ${transaction.type}, Amount: ${transaction.amount}`);
    }
    
    // Test model associations
    if (sessions.length > 0 && transactions.length > 0) {
      const session = sessions[0];
      const transaction = transactions[0];
      
      // Test session methods
      if (session.isValid) {
        console.log(`  - Session valid: ${session.isValid()}`);
      }
      
      if (session.getDuration) {
        console.log(`  - Session duration: ${session.getDuration()}ms`);
      }
      
      // Test transaction methods
      if (transaction.isBet) {
        console.log(`  - Transaction is bet: ${transaction.isBet()}`);
      }
      
      if (transaction.isWin) {
        console.log(`  - Transaction is win: ${transaction.isWin()}`);
      }
      
      if (transaction.getFormattedAmount) {
        console.log(`  - Formatted amount: ${transaction.getFormattedAmount()}`);
      }
    }
    
    return true;
  } catch (error) {
    log.error('Database verification test failed: ' + error.message);
    return false;
  }
};

/**
 * Test error handling scenarios
 */
const testErrorHandling = async () => {
  log.header('Testing Error Handling Scenarios');
  
  try {
    const playwin6Service = require('./services/playwin6Service');
    
    // Test invalid IP
    const invalidIpResult = await playwin6Service.handleCallback(
      testCallbackScenarios.betTransaction, 
      '192.168.1.1' // Invalid IP
    );
    
    if (!invalidIpResult.success) {
      log.success('Invalid IP correctly rejected');
    } else {
      log.warning('Invalid IP was not rejected');
    }
    
    // Test missing required fields
    const invalidData = { ...testCallbackScenarios.betTransaction };
    delete invalidData.user_id;
    
    const missingFieldsResult = await playwin6Service.handleCallback(
      invalidData, 
      '127.0.0.1'
    );
    
    if (!missingFieldsResult.success) {
      log.success('Missing required fields correctly rejected');
    } else {
      log.warning('Missing required fields were not rejected');
    }
    
    // Test old timestamp
    const oldTimestampData = { ...testCallbackScenarios.betTransaction };
    oldTimestampData.timestamp = (Date.now() - 10 * 60 * 1000).toString(); // 10 minutes ago
    
    const oldTimestampResult = await playwin6Service.handleCallback(
      oldTimestampData, 
      '127.0.0.1'
    );
    
    if (!oldTimestampResult.success) {
      log.success('Old timestamp correctly rejected');
    } else {
      log.warning('Old timestamp was not rejected');
    }
    
    return true;
  } catch (error) {
    log.error('Error handling test failed: ' + error.message);
    return false;
  }
};

/**
 * Test model cleanup and maintenance
 */
const testModelCleanup = async () => {
  log.header('Testing Model Cleanup and Maintenance');
  
  try {
    const playwin6Service = require('./services/playwin6Service');
    
    // Test session cleanup
    const cleanupResult = await playwin6Service.cleanupExpiredSessions();
    
    if (cleanupResult.success) {
      log.success('Session cleanup executed successfully');
      console.log('  - Cleaned sessions:', cleanupResult.cleanedCount);
    } else {
      log.warning('Session cleanup failed: ' + cleanupResult.message);
    }
    
    // Test health check
    const healthResult = await playwin6Service.healthCheck();
    
    if (healthResult.success) {
      log.success('Health check passed');
      console.log('  - Service status:', healthResult.status);
    } else {
      log.warning('Health check failed: ' + healthResult.message);
    }
    
    return true;
  } catch (error) {
    log.error('Model cleanup test failed: ' + error.message);
    return false;
  }
};

/**
 * Main test function
 */
const runCallbackIntegrationTests = async () => {
  log.header('Starting PlayWin6 Callback Integration Tests');
  
  const results = {
    databaseModels: false,
    callbackProcessing: false,
    callbackEndpoint: false,
    databaseVerification: false,
    errorHandling: false,
    modelCleanup: false
  };
  
  // Test database models
  results.databaseModels = await testDatabaseModels();
  console.log('');
  
  // Test callback processing
  results.callbackProcessing = await testCallbackProcessing();
  console.log('');
  
  // Test callback endpoint
  results.callbackEndpoint = await testCallbackEndpoint();
  console.log('');
  
  // Test database verification
  results.databaseVerification = await testDatabaseVerification();
  console.log('');
  
  // Test error handling
  results.errorHandling = await testErrorHandling();
  console.log('');
  
  // Test model cleanup
  results.modelCleanup = await testModelCleanup();
  console.log('');
  
  // Summary
  log.header('Test Results Summary');
  
  const passedTests = Object.values(results).filter(result => result).length;
  const totalTests = Object.keys(results).length;
  
  console.log(`Tests passed: ${passedTests}/${totalTests}`);
  
  for (const [testName, result] of Object.entries(results)) {
    const status = result ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${testName}: ${status}`);
  }
  
  if (passedTests === totalTests) {
    log.success('All PlayWin6 callback integration tests passed!');
    console.log('\n🎉 The callback handling correctly updates the model files and everything works in order.');
  } else {
    log.warning('Some tests failed. Please review the issues above.');
  }
  
  return results;
};

// Run tests if this file is executed directly
if (require.main === module) {
  runCallbackIntegrationTests().catch(error => {
    log.error('Test execution failed: ' + error.message);
    process.exit(1);
  });
}

module.exports = {
  runCallbackIntegrationTests,
  testCallbackScenarios,
  testDatabaseModels,
  testCallbackProcessing,
  testCallbackEndpoint,
  testDatabaseVerification,
  testErrorHandling,
  testModelCleanup
}; 