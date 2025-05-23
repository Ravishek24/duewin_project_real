// test-wallet-balance.js
const axios = require('axios');

// Configuration
const API_BASE_URL = 'https://strike.atsproduct.in/api'; // Change to your server URL
const AUTH_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNzQ2ODAwNjA4LCJleHAiOjE3NDY4ODcwMDh9.1bc3pZgqCPc_i92C76wDme8q0rb-AEFQWZI9JUGZy6A';

// API Client with Authorization
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${AUTH_TOKEN}`,
    'Content-Type': 'application/json'
  }
});

// Test wallet balance API
async function testWalletBalance() {
  try {
    console.log('Testing Wallet Balance API...');
    const response = await api.get('/wallet/balance');
    
    console.log('Response Status:', response.status);
    console.log('Response Data:', JSON.stringify(response.data, null, 2));
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('Error fetching wallet balance:');
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    
    return {
      success: false,
      error: error.response ? error.response.data : error.message
    };
  }
}

// Run the test
testWalletBalance()
  .then(result => {
    console.log('\nTest completed with result:', result.success ? 'SUCCESS' : 'FAILED');
    process.exit(result.success ? 0 : 1);
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });