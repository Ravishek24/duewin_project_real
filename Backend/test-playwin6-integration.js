// test-playwin6-integration.js - Test PlayWin6 Provider Integration
const axios = require('axios');
const playwin6Service = require('./services/playwin6Service');
const playwin6Config = require('./config/playwin6Config');

// Test configuration
const TEST_CONFIG = {
  baseUrl: 'http://localhost:8000',
  testUserId: 1,
  testGameUid: 'JiliGaming',
  testWalletAmount: 1000
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️ ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  warning: (msg) => console.log(`${colors.yellow}⚠️ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  header: (msg) => console.log(`${colors.bright}${colors.cyan}🎮 ${msg}${colors.reset}`)
};

/**
 * Test PlayWin6 configuration
 */
const testConfiguration = () => {
  log.header('Testing PlayWin6 Configuration');
  
  console.log('Configuration:', {
    apiBaseUrl: playwin6Config.apiBaseUrl,
    hasApiToken: !!playwin6Config.apiToken,
    hasAesKey: !!playwin6Config.aesKey,
    hasAesIv: !!playwin6Config.aesIv,
    defaultCurrency: playwin6Config.defaultCurrency,
    supportedProviders: playwin6Config.supportedProviders.length,
    supportedGameTypes: playwin6Config.supportedGameTypes.length
  });
  
  if (!playwin6Config.apiToken) {
    log.warning('API token not configured');
  }
  
  if (!playwin6Config.aesKey || !playwin6Config.aesIv) {
    log.warning('AES encryption not fully configured');
  }
  
  log.success('Configuration test completed');
};

/**
 * Test PlayWin6 service health check
 */
const testHealthCheck = async () => {
  log.header('Testing PlayWin6 Health Check');
  
  try {
    const result = await playwin6Service.healthCheck();
    
    if (result.success) {
      log.success('Health check passed');
      console.log('Health status:', result);
    } else {
      log.error('Health check failed');
      console.log('Error:', result.message);
    }
  } catch (error) {
    log.error('Health check error: ' + error.message);
  }
};

/**
 * Test getting providers
 */
const testGetProviders = async () => {
  log.header('Testing Get Providers');
  
  try {
    const result = await playwin6Service.getProviders();
    
    if (result.success) {
      log.success('Providers retrieved successfully');
      console.log('Providers:', result.providers);
    } else {
      log.error('Failed to get providers: ' + result.message);
    }
  } catch (error) {
    log.error('Get providers error: ' + error.message);
  }
};

/**
 * Test getting provider games
 */
const testGetProviderGames = async () => {
  log.header('Testing Get Provider Games');
  
  try {
    const result = await playwin6Service.getProviderGameList(
      'JiliGaming',
      5,
      'Slot Game'
    );
    
    if (result.success) {
      log.success('Provider games retrieved successfully');
      console.log('Games count:', result.count);
      console.log('Provider:', result.provider);
      console.log('Type:', result.type);
    } else {
      log.error('Failed to get provider games: ' + result.message);
    }
  } catch (error) {
    log.error('Get provider games error: ' + error.message);
  }
};

/**
 * Test game launch
 */
const testGameLaunch = async () => {
  log.header('Testing Game Launch');
  
  try {
    const result = await playwin6Service.launchGame(
      TEST_CONFIG.testUserId,
      TEST_CONFIG.testGameUid,
      TEST_CONFIG.testWalletAmount
    );
    
    if (result.success) {
      log.success('Game launched successfully');
      console.log('Launch URL:', result.launchUrl);
      console.log('Session Token:', result.sessionToken);
      console.log('User ID:', result.userId);
      console.log('Game UID:', result.gameUid);
      console.log('Timestamp:', result.timestamp);
    } else {
      log.error('Failed to launch game: ' + result.message);
    }
  } catch (error) {
    log.error('Game launch error: ' + error.message);
  }
};

/**
 * Test API endpoints via HTTP
 */
const testApiEndpoints = async () => {
  log.header('Testing API Endpoints via HTTP');
  
  const endpoints = [
    { name: 'Health Check', url: '/api/playwin6/health', method: 'GET' },
    { name: 'Get Providers', url: '/api/playwin6/providers', method: 'GET' },
    { name: 'Get Games', url: '/api/playwin6/games/JiliGaming?count=5&type=Slot Game', method: 'GET' }
  ];
  
  for (const endpoint of endpoints) {
    try {
      log.info(`Testing ${endpoint.name}...`);
      
      const response = await axios({
        method: endpoint.method,
        url: `${TEST_CONFIG.baseUrl}${endpoint.url}`,
        timeout: 10000
      });
      
      if (response.status === 200) {
        log.success(`${endpoint.name} - Status: ${response.status}`);
        if (response.data.success !== undefined) {
          console.log('Response success:', response.data.success);
        }
      } else {
        log.warning(`${endpoint.name} - Status: ${response.status}`);
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        log.error(`${endpoint.name} - Server not running at ${TEST_CONFIG.baseUrl}`);
      } else {
        log.error(`${endpoint.name} - Error: ${error.message}`);
      }
    }
  }
};

/**
 * Test callback handling
 */
const testCallbackHandling = async () => {
  log.header('Testing Callback Handling');
  
  const testCallbackData = {
    user_id: 'player1',
    wallet_amount: '1000.00',
    game_uid: 'JiliGaming',
    game_id: 'slot_game_001',
    provider: 'JiliGaming',
    token: 'test_token',
    timestamp: Date.now().toString(),
    transaction_id: 'test_tx_123',
    bet_amount: '10.00',
    win_amount: '0.00',
    game_result: 'loss',
    session_id: 'test_session_123',
    action: 'bet',
    action_id: 'action_001',
    old_balance: '990.00',
    new_balance: '1000.00',
    platform: 'desktop'
  };
  
  try {
    const result = await playwin6Service.handleCallback(testCallbackData, '127.0.0.1');
    
    if (result.success) {
      log.success('Callback handled successfully');
      console.log('Transaction ID:', result.transactionId);
      console.log('User ID:', result.userId);
    } else {
      log.error('Failed to handle callback: ' + result.message);
    }
  } catch (error) {
    log.error('Callback handling error: ' + error.message);
  }
};

/**
 * Main test function
 */
const runTests = async () => {
  log.header('Starting PlayWin6 Integration Tests');
  
  // Test configuration
  testConfiguration();
  console.log('');
  
  // Test service functions
  await testHealthCheck();
  console.log('');
  
  await testGetProviders();
  console.log('');
  
  await testGetProviderGames();
  console.log('');
  
  await testGameLaunch();
  console.log('');
  
  await testCallbackHandling();
  console.log('');
  
  // Test API endpoints
  await testApiEndpoints();
  console.log('');
  
  log.header('PlayWin6 Integration Tests Completed');
};

// Run tests if this file is executed directly
if (require.main === module) {
  runTests().catch(error => {
    log.error('Test execution failed: ' + error.message);
    process.exit(1);
  });
}

module.exports = {
  runTests,
  testConfiguration,
  testHealthCheck,
  testGetProviders,
  testGetProviderGames,
  testGameLaunch,
  testCallbackHandling,
  testApiEndpoints
}; 