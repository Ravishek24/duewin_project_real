/**
 * Test script to diagnose Play'n GO signup error
 * This script will test player creation and game launch for Play'n GO games
 */

require('dotenv').config();
const axios = require('axios');

// Initialize database models first
const { initializeModels } = require('../models');
const seamlessConfig = require('../config/seamlessConfig');

// Test user ID
const TEST_USER_ID = 13;
const TEST_GAME_ID = '103955'; // Play'n GO game that's failing

/**
 * Generate consistent player credentials
 */
const generatePlayerCredentials = (user) => {
  return {
    username: `player${user.user_id}`,
    password: `pwd${user.user_id}${seamlessConfig.password_salt}`,
    nickname: user.user_name ? user.user_name.substring(0, 16) : `Player${user.user_id}`
  };
};

/**
 * Test player creation specifically for Play'n GO
 */
const testPlayerCreation = async (User) => {
  try {
    console.log('🔍 === TESTING PLAYER CREATION ===');
    
    const user = await User.findByPk(TEST_USER_ID);
    if (!user) {
      console.error('❌ Test user not found');
      return;
    }

    const credentials = generatePlayerCredentials(user);
    
    console.log('👤 Test user:', {
      user_id: user.user_id,
      username: user.user_name,
      email: user.email
    });

    console.log('🔑 Generated credentials:', {
      username: credentials.username,
      nickname: credentials.nickname,
      password_length: credentials.password.length
    });

    // Test 1: Check if player exists
    console.log('\n📋 Test 1: Checking if player exists...');
    const existsRequest = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'playerExists',
      user_username: credentials.username,
      currency: seamlessConfig.default_currency
    };

    console.log('🔍 Player exists request:', JSON.stringify(existsRequest, null, 2));

    const existsResponse = await axios.post(seamlessConfig.api_url.production, existsRequest);
    console.log('🔍 Player exists response:', JSON.stringify(existsResponse.data, null, 2));

    // Test 2: Create player if doesn't exist
    if (existsResponse.data.error !== 0 || !existsResponse.data.response) {
      console.log('\n📋 Test 2: Creating player...');
      const createRequest = {
        api_login: seamlessConfig.api_login,
        api_password: seamlessConfig.api_password,
        method: 'createPlayer',
        user_username: credentials.username,
        user_password: credentials.password,
        user_nickname: credentials.nickname,
        currency: seamlessConfig.default_currency
      };

      console.log('🎮 Create player request:', JSON.stringify(createRequest, null, 2));

      const createResponse = await axios.post(seamlessConfig.api_url.production, createRequest);
      console.log('🎮 Create player response:', JSON.stringify(createResponse.data, null, 2));

      if (createResponse.data.error !== 0) {
        console.error('❌ Player creation failed:', createResponse.data.message);
        return false;
      }

      console.log('✅ Player created successfully');
      return createResponse.data.response;
    } else {
      console.log('✅ Player already exists');
      return existsResponse.data.response;
    }

  } catch (error) {
    console.error('❌ Error in player creation test:', error.message);
    if (error.response) {
      console.error('❌ Provider response:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
};

/**
 * Test game launch specifically for Play'n GO
 */
const testGameLaunch = async (User, playerInfo) => {
  try {
    console.log('\n🎮 === TESTING GAME LAUNCH ===');
    
    const user = await User.findByPk(TEST_USER_ID);
    const credentials = generatePlayerCredentials(user);

    const gameRequest = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'getGame',
      lang: 'en',
      user_username: credentials.username,
      user_password: credentials.password,
      gameid: TEST_GAME_ID,
      homeurl: seamlessConfig.home_url,
      cashierurl: seamlessConfig.cashier_url,
      play_for_fun: 0,
      currency: seamlessConfig.default_currency
    };

    console.log('🎮 Game launch request:', JSON.stringify(gameRequest, null, 2));

    const gameResponse = await axios.post(seamlessConfig.api_url.production, gameRequest);
    console.log('🎮 Game launch response:', JSON.stringify(gameResponse.data, null, 2));

    if (gameResponse.data.error !== 0) {
      console.error('❌ Game launch failed:', gameResponse.data.message);
      return false;
    }

    console.log('✅ Game launch successful');
    console.log('🎮 Game URL:', gameResponse.data.url || gameResponse.data.response);
    console.log('🎮 Session ID:', gameResponse.data.sessionid);
    console.log('🎮 Game Session ID:', gameResponse.data.gamesession_id);

    return gameResponse.data;

  } catch (error) {
    console.error('❌ Error in game launch test:', error.message);
    if (error.response) {
      console.error('❌ Provider response:', JSON.stringify(error.response.data, null, 2));
    }
    return false;
  }
};

/**
 * Test provider configuration
 */
const testProviderConfig = async () => {
  try {
    console.log('\n⚙️ === TESTING PROVIDER CONFIGURATION ===');
    
    console.log('🔧 API URL:', seamlessConfig.api_url.production);
    console.log('🔧 API Login:', seamlessConfig.api_login);
    console.log('🔧 Default Currency:', seamlessConfig.default_currency);
    console.log('🔧 Home URL:', seamlessConfig.home_url);
    console.log('🔧 Cashier URL:', seamlessConfig.cashier_url);

    // Test basic connectivity
    console.log('\n🌐 Testing API connectivity...');
    const testRequest = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'getGameList',
      show_systems: 0,
      show_additional: false,
      currency: seamlessConfig.default_currency
    };

    const testResponse = await axios.post(seamlessConfig.api_url.production, testRequest);
    console.log('✅ API connectivity test successful');
    console.log('📊 Available games:', testResponse.data.response?.length || 0);

  } catch (error) {
    console.error('❌ Provider configuration test failed:', error.message);
  }
};

/**
 * Main test function
 */
const runTests = async () => {
  try {
    console.log('🚀 === PLAY\'N GO DIAGNOSTIC TEST ===\n');
    
    // Initialize models first
    console.log('🔧 Initializing database models...');
    await initializeModels();
    console.log('✅ Database models initialized');
    
    // Now import User model after initialization
    const { User } = require('../models');
    
    // Test 1: Provider configuration
    await testProviderConfig();
    
    // Test 2: Player creation
    const playerInfo = await testPlayerCreation(User);
    
    if (!playerInfo) {
      console.error('❌ Player creation failed, cannot test game launch');
      return;
    }
    
    // Test 3: Game launch
    const gameResult = await testGameLaunch(User, playerInfo);
    
    if (gameResult) {
      console.log('\n✅ === ALL TESTS PASSED ===');
      console.log('🎮 The issue might be on the frontend or game provider side');
      console.log('🔍 Check the game URL in browser for any JavaScript errors');
    } else {
      console.log('\n❌ === GAME LAUNCH FAILED ===');
      console.log('🔍 The issue is with the game launch API call');
    }

  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
  }
};

// Run the tests
runTests().then(() => {
  console.log('\n🏁 Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Test failed:', error);
  process.exit(1);
}); 