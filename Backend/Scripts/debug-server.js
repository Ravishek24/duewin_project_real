/**
 * Debug script for server side issues
 * Run with: node debug-server.js
 */

const axios = require('axios');
const { sequelize } = require('../config/db');
const paymentConfig = require('../config/paymentConfig');
const User = require('../models/User');
const PaymentGateway = require('../models/PaymentGateway');

// The auth token from your login
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNzQ2ODAwNjA4LCJleHAiOjE3NDY4ODcwMDh9.1bc3pZgqCPc_i92C76wDme8q0rb-AEFQWZI9JUGZy6A';

// Use localhost when running on the server
const baseUrl = 'http://localhost:8000';

// Debug database connection and user
async function debugDatabase() {
  console.log('\n=== DEBUGGING DATABASE ===');
  
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection: OK');
    
    // Check for test user
    const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    console.log('Decoded token:', decodedToken);
    
    const userId = decodedToken.id;
    console.log(`Looking for user with ID: ${userId}`);
    
    const user = await User.findByPk(userId);
    if (user) {
      console.log('✅ User found:', {
        user_id: user.user_id,
        email: user.email,
        user_name: user.user_name,
        wallet_balance: user.wallet_balance
      });
    } else {
      console.log('❌ User not found in database');
      
      // Check if the users table exists
      try {
        const [results] = await sequelize.query('SELECT COUNT(*) as count FROM users');
        console.log('Total users in database:', results[0].count);
      } catch (error) {
        console.error('❌ Error checking users table:', error.message);
      }
    }
    
    // Check payment gateways
    console.log('\nChecking payment gateways:');
    const gateways = await PaymentGateway.findAll({ where: { is_active: true } });
    
    if (gateways.length > 0) {
      console.log(`✅ Found ${gateways.length} active payment gateways:`);
      gateways.forEach(gateway => {
        console.log(`- ${gateway.name} (${gateway.code})`);
      });
    } else {
      console.log('❌ No active payment gateways found');
      
      // Insert a test gateway
      console.log('Attempting to create a test gateway...');
      try {
        await PaymentGateway.create({
          name: 'OKPAY Test',
          code: 'OKPAY',
          description: 'Test payment gateway',
          is_active: true,
          supports_deposit: true,
          supports_withdrawal: true,
          min_deposit: 100.00,
          max_deposit: 10000.00,
          min_withdrawal: 500.00,
          max_withdrawal: 5000.00,
          display_order: 1
        });
        console.log('✅ Test gateway created');
      } catch (error) {
        console.error('❌ Error creating test gateway:', error.message);
      }
    }
    
    // Check payment config
    console.log('\nPayment configuration:');
    console.log(paymentConfig);
    
  } catch (error) {
    console.error('❌ Database error:', error.message);
  }
}

// Debug wallet balance API
async function debugWalletAPI() {
  console.log('\n=== DEBUGGING WALLET API ===');
  
  try {
    console.log('Testing wallet balance API with direct database query...');
    
    // Decode token to get user ID
    const decodedToken = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
    const userId = decodedToken.id;
    
    // Get user wallet balance directly from database
    const user = await User.findByPk(userId);
    if (user) {
      console.log('User wallet balance from DB:', user.wallet_balance);
    } else {
      console.log('❌ User not found in database');
      return;
    }
    
    // Now try the API
    console.log('\nTesting wallet balance API...');
    console.log(`GET ${baseUrl}/api/wallet/balance`);
    console.log(`Authorization: Bearer ${token.substring(0, 15)}...`);
    
    try {
      const response = await axios.get(`${baseUrl}/api/wallet/balance`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ API Response:', response.data);
    } catch (error) {
      console.error('❌ API Error:');
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
        
        // Check if route is registered
        console.log('\nChecking if wallet routes are registered...');
        try {
          const routesResponse = await axios.get(`${baseUrl}/api/routes`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const routes = routesResponse.data;
          const walletRoutes = routes.filter(r => r.path.includes('wallet'));
          console.log('Wallet routes:', walletRoutes);
        } catch (routeError) {
          console.error('❌ Cannot check routes:', routeError.message);
        }
      } else {
        console.error('Error:', error.message);
      }
    }
  } catch (error) {
    console.error('❌ Error in wallet API debug:', error.message);
  }
}

// Debug payment API
async function debugPaymentAPI() {
  console.log('\n=== DEBUGGING PAYMENT API ===');
  
  try {
    // Check OKPAY gateway in DB
    const okpayGateway = await PaymentGateway.findOne({ where: { code: 'OKPAY' } });
    if (okpayGateway) {
      console.log('✅ OKPAY gateway found in database:', {
        id: okpayGateway.gateway_id,
        name: okpayGateway.name,
        active: okpayGateway.is_active
      });
    } else {
      console.log('❌ OKPAY gateway not found in database');
    }
    
    // Test payment creation
    console.log('\nTesting payment creation API...');
    console.log(`POST ${baseUrl}/api/payments/payin`);
    console.log('Headers: Authorization, Content-Type: application/json');
    console.log('Body: { amount: 100, pay_type: "UPI", gateway: "OKPAY" }');
    
    try {
      const response = await axios.post(`${baseUrl}/api/payments/payin`, {
        amount: 100,
        pay_type: 'UPI',
        gateway: 'OKPAY'
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('✅ API Response:', response.data);
      
      if (response.data.paymentUrl) {
        console.log('\n✅ Success! Payment URL generated.');
        console.log('To complete the payment, open this URL:');
        console.log(response.data.paymentUrl);
      }
    } catch (error) {
      console.error('❌ API Error:');
      if (error.response) {
        console.error('Status:', error.response.status);
        console.error('Data:', error.response.data);
      } else {
        console.error('Error:', error.message);
      }
      
      // Try to diagnose why payment creation is failing
      console.log('\nDiagnosing payment creation failure...');
      console.log('Payment config:', paymentConfig);
      
      // Check if token is valid
      try {
        console.log('\nVerifying token...');
        const userResponse = await axios.get(`${baseUrl}/api/users/profile`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        console.log('✅ Token is valid, user profile:', userResponse.data);
      } catch (tokenError) {
        console.error('❌ Token validation error:', tokenError.message);
      }
    }
  } catch (error) {
    console.error('❌ Error in payment API debug:', error.message);
  }
}

// Function to run all debug tests
async function runDebug() {
  console.log('===============================================');
  console.log('STARTING SERVER DEBUG');
  console.log('===============================================');
  
  try {
    await debugDatabase();
    await debugWalletAPI();
    await debugPaymentAPI();
    
    console.log('\n===============================================');
    console.log('DEBUG COMPLETE');
    console.log('===============================================');
  } catch (error) {
    console.error('\n❌ Unhandled error during debug:', error.message);
  } finally {
    // Close database connection
    await sequelize.close();
  }
}

// Run debug process
if (require.main === module) {
  runDebug().catch(console.error);
} 