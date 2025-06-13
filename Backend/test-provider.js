// test-provider.js - Simple script to test connection to game provider
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '.env') });

const axios = require('axios');
const seamlessConfig = require('./config/seamlessConfig');

function generateHash(data, salt) {
  // Sort the data object by keys
  const sortedData = Object.keys(data)
    .sort()
    .reduce((acc, key) => {
      acc[key] = data[key];
      return acc;
    }, {});

  // Create query string
  const queryString = Object.entries(sortedData)
    .map(([key, value]) => `${key}=${value}`)
    .join('&');

  // Generate SHA1 hash
  return crypto.createHash('sha1')
    .update(salt + queryString)
    .digest('hex');
}

async function testProviderConnection() {
  try {
    console.log('Testing connection to game provider...');
    console.log(`Using API URL: ${seamlessConfig.api_url.staging}`);
    console.log(`Using API login: ${seamlessConfig.api_login}`);
    
    // Simple getGameList request
    const requestData = {
      api_login: seamlessConfig.api_login,
      api_password: seamlessConfig.api_password,
      method: 'getGameList',
      show_systems: 0,
      show_additional: true,
      currency: seamlessConfig.default_currency,
      lang: seamlessConfig.default_language,
      // Add test credentials for staging
      username: 'test',
      password: 'test'
    };

    // Generate hash for request validation
    const hash = generateHash(requestData, seamlessConfig.salt_key);
    requestData.key = hash;

    console.log('\nRequest Data:');
    console.log(JSON.stringify(requestData, null, 2));

    console.log('\nSending request...');
    const startTime = Date.now();
    
    const response = await axios.post(
      seamlessConfig.api_url.staging,
      requestData,
      { 
        timeout: 30000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Basic ' + Buffer.from('test:test').toString('base64')
        }
      }
    );
    
    const endTime = Date.now();
    console.log(`\nRequest completed in ${endTime - startTime}ms`);

    console.log('\nResponse Headers:');
    console.log(JSON.stringify(response.headers, null, 2));
    
    console.log('\nResponse Data:');
    console.log(JSON.stringify(response.data, null, 2));

    if (response.data.error !== 0) {
      console.error('\nError response from provider:', response.data);
      return;
    }

    console.log('\nSuccess! Provider connection is working.');
    console.log(`Games available: ${response.data.response.length}`);
    
    // Test getGame request for a specific game
    if (process.argv[2]) {
      const gameId = process.argv[2];
      console.log(`\nTesting getGame for gameId: ${gameId}`);
      
      const gameRequestData = {
        api_login: seamlessConfig.api_login,
        api_password: seamlessConfig.api_password,
        method: 'getGame',
        lang: seamlessConfig.default_language,
        user_username: 'player1', // Test user
        user_password: 'testpassword',
        gameid: gameId,
        homeurl: seamlessConfig.home_url,
        cashierurl: seamlessConfig.cashier_url,
        play_for_fun: 0,
        currency: seamlessConfig.default_currency,
        // Add test credentials for staging
        username: 'test',
        password: 'test'
      };

      // Generate hash for game request
      const gameHash = generateHash(gameRequestData, seamlessConfig.salt_key);
      gameRequestData.key = gameHash;
      
      console.log('\nGame Request Data:');
      console.log(JSON.stringify(gameRequestData, null, 2));
      
      const gameResponse = await axios.post(
        seamlessConfig.api_url.staging,
        gameRequestData,
        { 
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Basic ' + Buffer.from('test:test').toString('base64')
          }
        }
      );
      
      console.log('\nGame Response Headers:');
      console.log(JSON.stringify(gameResponse.headers, null, 2));
      
      console.log('\nGame Response Data:');
      console.log(JSON.stringify(gameResponse.data, null, 2));
      
      if (gameResponse.data.error !== 0) {
        console.error('\nError getting game:', gameResponse.data);
        return;
      }
      
      console.log('\nGame URL retrieved successfully!');
      console.log('URL:', gameResponse.data.url);
      console.log('Session ID:', gameResponse.data.sessionid);
    }
    
  } catch (error) {
    console.error('\nConnection test failed:');
    if (error.response) {
      // The server responded with a status code outside the range of 2xx
      console.error('Server responded with error status:', error.response.status);
      console.error('Response headers:', JSON.stringify(error.response.headers, null, 2));
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
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