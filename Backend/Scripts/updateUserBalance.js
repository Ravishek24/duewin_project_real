const axios = require('axios');

// Get the token and user ID from command line arguments
const token = process.argv[2];
const userId = process.argv[3];
const amount = process.argv[4];

if (!token || !userId || !amount) {
  console.error('Please provide all required arguments:');
  console.error('Example: node scripts/updateUserBalance.js YOUR_TOKEN_HERE USER_ID AMOUNT');
  process.exit(1);
}

async function updateUserBalance() {
  try {
    // Get the base URL
    const baseUrl = process.env.API_BASE_URL || 'https://strike.atsproduct.in';
    const apiUrl = `${baseUrl}/api/admin/users/${userId}/balance`;
    
    console.log(`Making POST request to: ${apiUrl}`);
    console.log(`With Authorization: Bearer ${token.substring(0, 15)}...`);
    
    const response = await axios.post(apiUrl, {
      amount: parseFloat(amount),
      type: 'add'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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
updateUserBalance()
  .then(() => {
    console.log('Balance update completed successfully');
  })
  .catch(error => {
    console.error('Balance update failed with error:', error.message);
    process.exit(1);
  }); 