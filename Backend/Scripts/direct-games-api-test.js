/**
 * Direct Strike API Endpoint Test
 * A minimalist test script that directly calls the API without any dependencies other than axios
 * 
 * Usage: node scripts/direct-games-api-test.js [token]
 */

const axios = require('axios');

// Get token from command line args
const token = process.argv[2];
if (!token) {
  console.error('Please provide an auth token');
  console.error('Usage: node scripts/direct-games-api-test.js YOUR_AUTH_TOKEN');
  process.exit(1);
}

console.log('===== DIRECT API CALL TEST =====');
console.log('Using token:', token.substring(0, 10) + '...');

// Make the API call directly
const apiURL = 'https://strike.atsproduct.in/api/seamless/games';
console.log(`\nCalling: ${apiURL}`);
console.log('Timeout: 30 seconds');

// Set up event handler to catch SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\nTest interrupted by user');
  process.exit(0);
});

// Force exit after 60 seconds
const exitTimeout = setTimeout(() => {
  console.log('\n⚠️ Test force-terminated after 60 seconds timeout');
  process.exit(1);
}, 60000);

// Make the request
console.time('API Call Duration');
axios({
  method: 'get',
  url: apiURL,
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000, // 30 seconds
  validateStatus: status => true // Accept any status code
})
.then(response => {
  console.timeEnd('API Call Duration');
  clearTimeout(exitTimeout);
  
  console.log(`\nResponse Status: ${response.status} ${response.statusText}`);
  
  if (response.status >= 200 && response.status < 300) {
    console.log('✅ API call successful!');
    
    const contentLength = JSON.stringify(response.data).length;
    console.log(`Response size: ${contentLength} bytes`);
    
    if (response.data && response.data.games) {
      console.log(`Games received: ${response.data.games.length}`);
      
      if (response.data.games.length > 0) {
        console.log('\nFirst game object:');
        console.log(JSON.stringify(response.data.games[0], null, 2));
      }
    } else {
      console.log('No games array found in response');
      console.log('Response data (truncated):');
      console.log(JSON.stringify(response.data).substring(0, 500) + '...');
    }
  } else {
    console.log('❌ API call returned error status');
    console.log('Response data:', response.data);
  }
})
.catch(error => {
  console.timeEnd('API Call Duration');
  clearTimeout(exitTimeout);
  
  console.error('❌ Error making API call:', error.message);
  
  if (error.code === 'ECONNABORTED') {
    console.error('Request timed out after 30 seconds');
  }
  
  if (error.response) {
    console.error('Status:', error.response.status);
    console.error('Data:', error.response.data);
  } else if (error.request) {
    console.error('No response received from server');
  }
})
.finally(() => {
  console.log('\n===== TEST COMPLETE =====');
}); 