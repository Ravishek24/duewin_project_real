// test-provider.js - Simple script to test connection to game provider
const axios = require('axios');
const seamlessConfig = require('./config/seamlessConfig');

async function testProviderConnection() {
  try {
    console.log('Testing connection to game provider...');
    console.log(`Using API URL: ${seamlessConfig.api_url.production}`);
    console.log(`Using API login: ${seamlessConfig.api_login}`);
    
    // Simple getGameList request
    const requestData = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'getGameList',
      show_systems: 0,
      show_additional: true,
      currency: seamlessConfig.default_currency
    };

    console.log('Sending request...');
    const startTime = Date.now();
    
    const response = await axios.post(
      seamlessConfig.api_url.production,
      requestData,
      { timeout: 30000 } // 30 second timeout
    );
    
    const endTime = Date.now();
    console.log(`Request completed in ${endTime - startTime}ms`);

    if (response.data.error !== 0) {
      console.error('Error response from provider:', response.data);
      return;
    }

    console.log('Success! Provider connection is working.');
    console.log(`Games available: ${response.data.response.length}`);
    
    // Test getGame request for a specific game
    if (process.argv[2]) {
      const gameId = process.argv[2];
      console.log(`\nTesting getGame for gameId: ${gameId}`);
      
      const gameRequestData = {
        api_login: seamlessConfig.api_login,
        api_password: seamlessConfig.api_password,
        method: 'getGame',
        lang: 'en',
        user_username: 'player1', // Test user
        user_password: 'testpassword',
        gameid: gameId,
        homeurl: seamlessConfig.home_url,
        cashierurl: seamlessConfig.cashier_url,
        play_for_fun: 0,
        currency: seamlessConfig.default_currency
      };
      
      const gameResponse = await axios.post(
        seamlessConfig.api_url.production,
        gameRequestData,
        { timeout: 30000 }
      );
      
      if (gameResponse.data.error !== 0) {
        console.error('Error getting game:', gameResponse.data);
        return;
      }
      
      console.log('Game URL retrieved successfully!');
      console.log('URL:', gameResponse.data.url);
      console.log('Session ID:', gameResponse.data.sessionid);
    }
    
  } catch (error) {
    console.error('Connection test failed:');
    if (error.response) {
      // The server responded with a status code outside the range of 2xx
      console.error('Server responded with error status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received. Timeout or network error.');
      console.error('Request details:', error.request._currentUrl);
    } else {
      // Something happened in setting up the request
      console.error('Error setting up request:', error.message);
    }
  }
}

testProviderConnection(); 