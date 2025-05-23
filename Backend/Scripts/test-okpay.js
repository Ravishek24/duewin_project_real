/**
 * Test script for OKPAY integration
 */
const axios = require('axios');

// Create a test token with user_id=1
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

// Test the payment gateways list
async function testPaymentGateways() {
  console.log('\nChecking Active Payment Gateways...');
  try {
    const response = await apiClient.get('/payment-gateways/active');
    console.log('Response Status:', response.status);
    console.log('Active Gateways:', response.data);
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

// Test OKPAY deposit
async function testOkPayDeposit() {
  console.log('\nTesting OKPAY Payment Gateway (Deposit)...');
  const requestData = {
    amount: 100,
    pay_type: 'UPI',
    gateway: 'OKPAY'
  };
  
  console.log('Request Data:', requestData);
  
  try {
    const response = await apiClient.post('/payments/payin', requestData);
    console.log('Response Status:', response.status);
    console.log('Payment Data:', response.data);
    
    if (response.data.paymentUrl) {
      console.log('\nPayment URL:', response.data.paymentUrl);
      console.log('(Open this URL in a browser to complete the payment)');
    }
    
    return true;
  } catch (error) {
    console.error('Error creating OKPAY deposit:');
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
  const gatewaysResult = await testPaymentGateways();
  
  // Only proceed with OKPAY test if we found active gateways
  let okpayResult = false;
  if (gatewaysResult && gatewaysResult.success) {
    okpayResult = await testOkPayDeposit();
  }
  
  console.log('\nTests completed. OKPAY deposit test:', okpayResult ? 'SUCCESS' : 'FAILED');
}

runTests();