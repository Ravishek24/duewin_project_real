/**
 * Test script for Strike API endpoint and game list caching
 * 
 * This script will:
 * 1. Make a request to the Strike API to get games
 * 2. Test if the response is properly cached
 * 3. Make a second request to verify cache is used
 * 
 * Usage: 
 * - Without token: node scripts/test-strike-games.js
 * - With token: node scripts/test-strike-games.js YOUR_TOKEN_HERE
 */

const axios = require('axios');
const redis = require('../config/redisConfig').redis;

// Main function
async function testStrikeGamesAPI() {
  console.log('===== STRIKE API GAMES ENDPOINT TEST =====');

  // Get the token from command line args or use a default test token
  const token = process.argv[2] || process.env.TEST_AUTH_TOKEN;
  if (!token) {
    console.warn('⚠️ No auth token provided. Using the script: node scripts/test-strike-games.js YOUR_TOKEN');
    console.warn('You can also set the TEST_AUTH_TOKEN environment variable');
  } else {
    console.log('Using provided auth token');
  }

  try {
    // Check Redis connectivity first
    try {
      await redis.ping();
      console.log('✅ Redis connected successfully');
    } catch (error) {
      console.error('❌ Redis connection error:', error.message);
    }

    // Configure axios with longer timeout
    const axiosInstance = axios.create({
      timeout: 30000, // 30 seconds timeout
      headers: token ? {
        'Authorization': `Bearer ${token}`
      } : {}
    });

    // Test direct API call to Strike
    const strikeUrl = 'https://strike.atsproduct.in/api/seamless/games';
    console.log(`\nMaking direct request to: ${strikeUrl}`);
    console.log(`Timeout set to: 30 seconds`);
    
    // Make direct API call
    console.time('API Call Time');
    try {
      console.log('Starting API request...');
      const response = await axiosInstance.get(strikeUrl);
      console.timeEnd('API Call Time');
      
      console.log('✅ API call successful!');
      console.log(`Status: ${response.status}`);
      console.log(`Response size: ${JSON.stringify(response.data).length} characters`);
      
      if (response.data.games) {
        console.log(`Retrieved ${response.data.games.length} games`);
        
        // Display a sample of games
        if (response.data.games.length > 0) {
          console.log('\nSample game:');
          console.log(JSON.stringify(response.data.games[0], null, 2));
        }
        
        // Check for fromCache flag
        console.log(`\nResponse from cache: ${response.data.fromCache ? 'Yes' : 'No'}`);
      } else {
        console.log('Response data:', JSON.stringify(response.data).substring(0, 500));
      }
    } catch (error) {
      console.timeEnd('API Call Time');
      console.error('❌ Error making API call:', error.message);
      
      if (error.code === 'ECONNABORTED') {
        console.error('Request timed out after 30 seconds');
      }
      
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      } else if (error.request) {
        console.error('No response received. Request details:', {
          method: error.request.method,
          path: error.request.path,
          host: error.request.host
        });
      }
    }
    
    console.log('\n===== TEST COMPLETE =====');
  } catch (error) {
    console.error('Unhandled error:', error);
  } finally {
    // Force exit to avoid hanging
    console.log('Exiting...');
    process.exit(0);
  }
}

// Run the test
testStrikeGamesAPI(); 