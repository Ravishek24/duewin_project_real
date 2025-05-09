const axios = require('axios');

// Get the token from command line arguments
const token = process.argv[2];

if (!token) {
  console.error('Please provide a token as an argument:');
  console.error('Example: node scripts/testWalletBalance.js YOUR_TOKEN_HERE');
  process.exit(1);
}

async function getWalletBalance() {
  try {
    // Get the base URL
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:8000';
    const apiUrl = `${baseUrl}/api/wallet/balance`;
    
    console.log(`Making GET request to: ${apiUrl}`);
    console.log(`With Authorization: Bearer ${token.substring(0, 15)}...`);
    
    const response = await axios.get(apiUrl, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('Error during API call:');
    
    if (error.response) {
      // Server responded with error status
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      // Request was made but no response received
      console.error('No response received from server');
    } else {
      // Error before sending request
      console.error('Error preparing request:', error.message);
    }
    
    throw error;
  }
}

// Execute the function
getWalletBalance()
  .then(() => {
    console.log('Test completed successfully');
  })
  .catch(error => {
    console.error('Test failed with error:', error.message);
    process.exit(1);
  }); 