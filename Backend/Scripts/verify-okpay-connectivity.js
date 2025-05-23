/**
 * Script to verify connectivity to OKPAY payment gateway
 */
const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
require('dotenv').config();

// Get OKPAY configuration from environment or use defaults
const OKPAY_CONFIG = {
  mchId: process.env.OKPAY_MCH_ID || '1000',
  key: process.env.OKPAY_KEY || 'eb6080dbc8dc429ab86a1cd1c337975d',
  host: process.env.OKPAY_HOST || 'sandbox.wpay.one',
  currency: 'INR',
};

console.log('OKPAY Configuration:', {
  mchId: OKPAY_CONFIG.mchId,
  key: '******' + OKPAY_CONFIG.key.slice(-6), // Show only last 6 chars for security
  host: OKPAY_CONFIG.host,
  currency: OKPAY_CONFIG.currency
});

// Calculate signature for OKPAY requests
function calculateSignature(params) {
  // Filter out empty values and sign parameter
  const filteredParams = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null && value !== '' && value !== 'sign')
    .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

  // Sort parameters by key (ASCII order)
  const sortedKeys = Object.keys(filteredParams).sort();
  
  // Create URL parameter string
  const stringA = sortedKeys.map(key => `${key}=${filteredParams[key]}`).join('&');
  
  // Append key
  const stringSignTemp = `${stringA}&key=${OKPAY_CONFIG.key}`;
  
  // Calculate MD5 hash and convert to lowercase
  return crypto.createHash('md5').update(stringSignTemp).digest('hex').toLowerCase();
}

// Check connectivity to payment gateway host
async function checkHostConnectivity() {
  console.log(`\n1. Testing connectivity to ${OKPAY_CONFIG.host}...`);
  
  try {
    const response = await axios.get(`https://${OKPAY_CONFIG.host}`, {
      timeout: 5000,
      httpsAgent: new https.Agent({  
        rejectUnauthorized: false // Only for testing, don't use in production
      })
    });
    
    console.log(`✅ Host is reachable. Status: ${response.status}`);
    return true;
  } catch (error) {
    if (error.response) {
      // The request was made and server responded with status code outside of 2xx range
      console.log(`✅ Host is reachable. Status: ${error.response.status}`);
      return true;
    } else if (error.request) {
      // The request was made but no response was received
      console.error(`❌ Host is unreachable: No response received`);
      return false;
    } else {
      // Something happened in setting up the request
      console.error(`❌ Host is unreachable: ${error.message}`);
      return false;
    }
  }
}

// Test API ping/health endpoint if available
async function testApiEndpoint() {
  console.log(`\n2. Testing API endpoint connectivity...`);
  
  try {
    // Most gateways have a ping or health check endpoint, adjust if needed
    const apiUrl = `https://${OKPAY_CONFIG.host}/ping`;
    const response = await axios.get(apiUrl, {
      timeout: 5000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false // Only for testing
      })
    });
    
    console.log(`✅ API endpoint is reachable. Status: ${response.status}`);
    return true;
  } catch (error) {
    // For many payment gateways, a 401/403 is still a "success" as it means the endpoint exists
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.log(`✅ API endpoint exists (auth required). Status: ${error.response.status}`);
      return true;
    } else if (error.response) {
      console.log(`✅ API endpoint exists. Status: ${error.response.status}`);
      return true;
    } else {
      console.error(`❌ API endpoint is unreachable: ${error.message}`);
      return false;
    }
  }
}

// Test a basic API request to validate credentials
async function testApiCredentials() {
  console.log(`\n3. Testing API credentials...`);
  
  // Create a test order ID
  const testOrderId = `TEST${Date.now()}`;
  
  // Prepare parameters for OKPAY API
  const params = {
    mchId: OKPAY_CONFIG.mchId,
    currency: OKPAY_CONFIG.currency,
    out_trade_no: testOrderId,
    pay_type: 'UPI',
    money: 100, // Test amount
    notify_url: 'https://example.com/callback',
    returnUrl: 'https://example.com/return',
    attach: 'Test transaction'
  };

  // Calculate signature
  params.sign = calculateSignature(params);

  console.log('Test request parameters:', {
    ...params,
    sign: params.sign.substring(0, 8) + '...' // Show only first 8 chars for brevity
  });

  try {
    // Make API request to OKPAY
    const apiUrl = `https://${OKPAY_CONFIG.host}/v1/Collect`;
    const response = await axios.post(apiUrl, new URLSearchParams(params).toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false // Only for testing
      })
    });

    console.log('✅ API credentials valid. Response:', response.data);
    return true;
  } catch (error) {
    console.error('❌ API credentials test failed:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

// Test payment URL access
async function testPaymentUrl(url) {
  if (!url) {
    console.log('\n4. No payment URL to test.');
    return false;
  }
  
  console.log(`\n4. Testing payment URL accessibility: ${url}`);
  
  try {
    const response = await axios.get(url, {
      timeout: 10000,
      maxRedirects: 5,
      validateStatus: function (status) {
        return status < 500; // Accept any status code less than 500
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false // Only for testing
      })
    });
    
    console.log(`✅ Payment URL is accessible. Status: ${response.status}`);
    return true;
  } catch (error) {
    console.error(`❌ Payment URL is not accessible: ${error.message}`);
    return false;
  }
}

// Run all tests
async function runDiagnostics() {
  console.log('Starting OKPAY connectivity diagnostics...\n');
  
  // Step 1: Check host connectivity
  const hostConnectivity = await checkHostConnectivity();
  
  // Step 2: Test API endpoint
  const apiEndpoint = hostConnectivity ? await testApiEndpoint() : false;
  
  // Step 3: Test API credentials
  const apiCredentials = apiEndpoint ? await testApiCredentials() : false;
  
  // Step 4: Test payment URL (if provided)
  const paymentUrlToTest = process.argv[2];
  const paymentUrlAccessible = paymentUrlToTest ? 
    await testPaymentUrl(paymentUrlToTest) : 
    'Not tested (no URL provided)';
  
  // Summary
  console.log('\n=== DIAGNOSTIC SUMMARY ===');
  console.log(`Host Connectivity: ${hostConnectivity ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`API Endpoint: ${apiEndpoint ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`API Credentials: ${apiCredentials ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Payment URL: ${paymentUrlAccessible === true ? '✅ PASS' : 
               paymentUrlAccessible === false ? '❌ FAIL' : 
               paymentUrlAccessible}`);
  
  // Recommendations
  console.log('\n=== RECOMMENDATIONS ===');
  if (!hostConnectivity) {
    console.log('• The payment gateway server is unreachable. Possible reasons:');
    console.log('  - Network connectivity issues');
    console.log('  - Server is down for maintenance');
    console.log('  - Incorrect host configuration');
    console.log('  - Try checking if sandbox.wpay.one is accessible in your browser');
  } else if (!apiEndpoint) {
    console.log('• The API endpoint is unreachable. Possible reasons:');
    console.log('  - Gateway API paths may have changed');
    console.log('  - Gateway might be experiencing issues');
    console.log('  - Contact the payment gateway support for assistance');
  } else if (!apiCredentials) {
    console.log('• API credential verification failed. Possible reasons:');
    console.log('  - Incorrect merchant ID or key');
    console.log('  - Account is inactive or restricted');
    console.log('  - Double-check your .env configuration for OKPAY_MCH_ID and OKPAY_KEY');
  } else if (paymentUrlAccessible === false) {
    console.log('• Payment URL is inaccessible. Possible reasons:');
    console.log('  - URL has expired or is one-time use');
    console.log('  - Gateway is experiencing issues');
    console.log('  - Network connectivity issues');
    console.log('  - Try opening the URL in an incognito browser window');
  } else if (hostConnectivity && apiEndpoint && apiCredentials && paymentUrlAccessible !== false) {
    console.log('✅ All tests passed. The payment gateway appears to be properly configured.');
    console.log('• If you\'re still experiencing issues with payments:');
    console.log('  - Check callback URL configuration');
    console.log('  - Ensure your IP is whitelisted if required by the gateway');
    console.log('  - Review transaction limits and restrictions');
  }
}

// Execute the diagnostics
runDiagnostics(); 