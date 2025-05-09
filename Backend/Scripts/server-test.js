/**
 * Simple test script to test wallet and payment APIs on the server.
 * Copy this file to the server and run with:
 * node server-test.js
 */

const axios = require('axios');

// The auth token from your login
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNzQ2ODAwNjA4LCJleHAiOjE3NDY4ODcwMDh9.1bc3pZgqCPc_i92C76wDme8q0rb-AEFQWZI9JUGZy6A';

// Use localhost when running on the server
const baseUrl = 'http://localhost:8000';
// For local tests, use the public URL
// const baseUrl = 'https://strike.atsproduct.in';

/**
 * Test the wallet balance API
 */
async function testWalletBalance() {
  try {
    console.log('Testing wallet balance API...');
    const response = await axios.get(`${baseUrl}/api/wallet/balance`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching wallet balance:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Test the payment creation API
 */
async function testPayment() {
  try {
    console.log('\nTesting payment creation API...');
    
    // Payment request data
    const paymentData = {
      amount: 100,
      pay_type: 'UPI',
      gateway: 'OKPAY'
    };
    
    console.log('Request data:', paymentData);
    
    const response = await axios.post(`${baseUrl}/api/payments/payin`, paymentData, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response data:', response.data);
    
    if (response.data.paymentUrl) {
      console.log('\n✅ Success! Payment URL generated.');
      console.log('To complete the payment, open this URL:');
      console.log(response.data.paymentUrl);
    }
    
    return response.data;
  } catch (error) {
    console.error('Error creating payment:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Check active payment gateways
 */
async function checkPaymentGateways() {
  try {
    console.log('\nChecking active payment gateways...');
    const response = await axios.get(`${baseUrl}/api/payment-gateways/active`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    console.log('Response status:', response.status);
    console.log('Active gateways:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error checking payment gateways:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
    return { success: false, error: error.message };
  }
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('===============================================');
  console.log('Starting API Tests');
  console.log('===============================================');
  
  try {
    // Test wallet balance
    await testWalletBalance();
    
    // Check active payment gateways
    await checkPaymentGateways();
    
    // Test payment creation
    await testPayment();
    
    console.log('\n===============================================');
    console.log('All tests completed');
    console.log('===============================================');
  } catch (error) {
    console.error('\nUnhandled error during tests:', error.message);
  }
}

// Run all tests when script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
} else {
  // Export for use in other modules
  module.exports = {
    testWalletBalance,
    testPayment,
    checkPaymentGateways,
    runAllTests
  };
} 