/**
 * API test script
 */
const axios = require('axios');

// Create a test token - same as used in check-jwt.js
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNzQ2ODAwNjA4LCJleHAiOjE3NDY4ODcwMDh9.1bc3pZgqCPc_i92C76wDme8q0rb-AEFQWZI9JUGZy6A';

// Base URL for the API
const baseURL = 'http://localhost:8000/api';

// API client with authorization
const apiClient = axios.create({
  baseURL,
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Test the wallet balance API
async function testWalletBalance() {
  console.log('Testing wallet balance API...');
  try {
    const response = await apiClient.get('/wallet/balance');
    console.log('Response status:', response.status);
    console.log('Wallet balance data:', response.data);
    return true;
  } catch (error) {
    console.error('Error fetching wallet balance:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

// Test the payment gateways API
async function testPaymentGateways() {
  console.log('\nChecking active payment gateways...');
  try {
    const response = await apiClient.get('/payment/gateways');
    console.log('Response status:', response.status);
    console.log('Active gateways:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching payment gateways:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
    return null;
  }
}

// Test the payment creation API
async function testPaymentCreation() {
  console.log('\nTesting payment creation API...');
  const requestData = {
    amount: 100,
    pay_type: 'UPI',
    gateway: 'OKPAY'
  };
  
  console.log('Request data:', requestData);
  
  try {
    const response = await apiClient.post('/payment/payin', requestData);
    console.log('Response status:', response.status);
    console.log('Payment creation data:', response.data);
    return true;
  } catch (error) {
    console.error('Error creating payment:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

// Run the tests
async function runTests() {
  console.log('===============================================');
  console.log('Starting API Tests');
  console.log('===============================================');
  
  await testWalletBalance();
  await testPaymentGateways();
  await testPaymentCreation();
  
  console.log('\n===============================================');
  console.log('All tests completed');
  console.log('===============================================');
}

runTests(); 