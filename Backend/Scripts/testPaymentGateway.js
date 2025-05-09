const axios = require('axios');
const { sequelize } = require('../config/db');

// Utility to check database connection
async function checkDbConnection() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection: OK');
    return true;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    return false;
  }
}

// Utility to check if payment gateway configs exist
async function checkPaymentGatewayConfig() {
  try {
    const [results] = await sequelize.query('SELECT * FROM payment_gateways WHERE is_active = true');
    
    if (results.length === 0) {
      console.log('❌ No active payment gateways found in database');
      return false;
    }
    
    console.log('✅ Active payment gateways found:', results.length);
    console.log('Gateway details:');
    results.forEach(gateway => {
      console.log(`- ${gateway.gateway_name} (${gateway.gateway_code}): ${gateway.is_active ? 'Active' : 'Inactive'}`);
    });
    
    return true;
  } catch (error) {
    console.error('❌ Error checking payment gateway config:', error.message);
    return false;
  }
}

// Function to make a test payment
async function makeTestPayment(token, amount = 100) {
  try {
    console.log(`\nAttempting to create payment order for amount: ${amount}`);
    
    // Get host for local testing
    const host = process.env.API_BASE_URL || 'http://localhost:8000';
    const apiUrl = `${host}/api/payments/payin`;
    
    console.log(`POST request to: ${apiUrl}`);
    console.log('Headers: Authorization Bearer token');
    console.log(`Request body: { amount: ${amount}, pay_type: "UPI", gateway: "OKPAY" }`);
    
    const response = await axios.post(apiUrl, {
      amount: amount,
      pay_type: 'UPI',
      gateway: 'OKPAY'
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Payment API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Payment creation error:');
    
    if (error.response) {
      // Server responded with error
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
      console.error('Headers:', error.response.headers);
    } else if (error.request) {
      // Request made but no response
      console.error('No response received from server');
      console.error('Request:', error.request);
    } else {
      // Error setting up request
      console.error('Error setting up request:', error.message);
    }
    
    if (error.config) {
      console.log('\nRequest configuration:');
      console.log(`URL: ${error.config.url}`);
      console.log(`Method: ${error.config.method}`);
      console.log('Headers:', error.config.headers);
      console.log('Data:', error.config.data);
    }
    
    return { success: false, error: error.message };
  }
}

// Main function to run the tests
async function runTests() {
  try {
    console.log('Starting payment gateway tests...');
    
    // Check DB connection
    const dbConnected = await checkDbConnection();
    if (!dbConnected) {
      console.error('Cannot proceed with tests due to database issues');
      return false;
    }
    
    // Check payment gateway config
    const gatewaysConfigured = await checkPaymentGatewayConfig();
    if (!gatewaysConfigured) {
      console.log('Payment gateways not properly configured. Configuring test gateway...');
      
      // Insert a test gateway if needed
      try {
        await sequelize.query(`
          INSERT INTO payment_gateways (
            gateway_name, gateway_code, is_active, 
            config_data, created_at, updated_at
          ) VALUES (
            'OKPay Test', 'OKPAY', true, 
            '{"mchId":"test123", "secretKey":"test456", "host":"https://api.example.com"}',
            NOW(), NOW()
          ) ON CONFLICT (gateway_code) 
          DO UPDATE SET is_active = true, config_data = '{"mchId":"test123", "secretKey":"test456", "host":"https://api.example.com"}'
        `);
        
        console.log('✅ Test payment gateway configured');
      } catch (error) {
        console.error('❌ Error configuring test gateway:', error.message);
        return false;
      }
    }
    
    // Get a test token (you need to provide this from login)
    const testToken = process.argv[2];
    if (!testToken) {
      console.error('❌ No test token provided. Please run with token as argument:');
      console.error('Example: node scripts/testPaymentGateway.js YOUR_TOKEN_HERE');
      return false;
    }
    
    // Make test payment
    const paymentResult = await makeTestPayment(testToken);
    
    if (paymentResult.success) {
      console.log('\n✅ Payment test successful!');
      console.log(`Payment URL: ${paymentResult.paymentUrl}`);
      console.log(`Transaction ID: ${paymentResult.transactionId}`);
      console.log(`Order ID: ${paymentResult.orderId}`);
    } else {
      console.error('\n❌ Payment test failed.');
    }
    
    // Close DB connection
    await sequelize.close();
    return paymentResult.success;
  } catch (error) {
    console.error('Unexpected error during tests:', error);
    try {
      await sequelize.close();
    } catch (e) {
      // Ignore
    }
    return false;
  }
}

// Run if called directly
if (require.main === module) {
  runTests()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
} else {
  // Export for use in other modules
  module.exports = { runTests, checkDbConnection, checkPaymentGatewayConfig, makeTestPayment }; 