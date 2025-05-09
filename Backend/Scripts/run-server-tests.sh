#!/bin/bash

# Configuration
SERVER_USER="ubuntu"
SERVER_HOST="strike.atsproduct.in"
AUTH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNzQ2ODAwNjA4LCJleHAiOjE3NDY4ODcwMDh9.1bc3pZgqCPc_i92C76wDme8q0rb-AEFQWZI9JUGZy6A"

echo "=== Running tests on $SERVER_HOST ==="

# Create a simple test script for wallet balance
echo "Creating wallet balance test script on server..."
ssh $SERVER_USER@$SERVER_HOST "cat > ~/test-wallet.js << 'EOL'
const axios = require('axios');

const token = '$AUTH_TOKEN';
const baseUrl = 'http://localhost:8000';

async function testWalletBalance() {
  try {
    console.log('Testing wallet balance API...');
    const response = await axios.get(\`\${baseUrl}/api/wallet/balance\`, {
      headers: { Authorization: \`Bearer \${token}\` }
    });
    console.log('Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
    return { success: false, error: error.message };
  }
}

async function testPayment() {
  try {
    console.log('\\nTesting payment creation API...');
    const response = await axios.post(\`\${baseUrl}/api/payments/payin\`, {
      amount: 100,
      pay_type: 'UPI',
      gateway: 'OKPAY'
    }, {
      headers: {
        Authorization: \`Bearer \${token}\`,
        'Content-Type': 'application/json'
      }
    });
    console.log('Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
    return { success: false, error: error.message };
  }
}

// Run tests
async function runTests() {
  await testWalletBalance();
  await testPayment();
}

runTests().catch(console.error);
EOL"

echo "=== Running tests ==="
ssh $SERVER_USER@$SERVER_HOST "cd ~ && node test-wallet.js"

echo "=== Testing completed ===" 