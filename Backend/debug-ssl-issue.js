const https = require('https');
const axios = require('axios');
require('dotenv').config();

console.log('🔍 SSL/TLS Connection Debug');
console.log('===========================');

// Test different payment gateway URLs
const testUrls = [
  'https://admin.tpaycloud.com', // L Pay
  'https://api.strikecolor1.com', // Your API
  'https://httpbin.org/get' // Test URL
];

async function testSSLConnection(url) {
  console.log(`\n🔗 Testing: ${url}`);
  
  try {
    // Test with axios
    const response = await axios.get(url, {
      timeout: 10000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false, // Temporarily disable SSL verification for testing
        secureProtocol: 'TLSv1_2_method'
      })
    });
    
    console.log(`✅ Success: ${response.status} - ${response.statusText}`);
    return true;
    
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('   - Connection refused (server not running)');
    } else if (error.code === 'ENOTFOUND') {
      console.log('   - DNS resolution failed');
    } else if (error.code === 'CERT_HAS_EXPIRED') {
      console.log('   - SSL certificate expired');
    } else if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
      console.log('   - SSL certificate verification failed');
    } else if (error.message.includes('DECODER routines::unsupported')) {
      console.log('   - SSL/TLS protocol issue');
    }
    
    return false;
  }
}

async function testPaymentGatewayConfig() {
  console.log('\n🔧 Payment Gateway Configuration Test');
  console.log('=====================================');
  
  // Check environment variables
  console.log('Environment Variables:');
  console.log('- NODE_ENV:', process.env.NODE_ENV);
  console.log('- API_BASE_URL:', process.env.API_BASE_URL);
  console.log('- LPAY_BASE_URL:', process.env.LPAY_BASE_URL);
  console.log('- SOLPAY_BASE_URL:', process.env.SOLPAY_BASE_URL);
  
  // Check Node.js version
  console.log('\nNode.js Version:', process.version);
  
  // Check SSL/TLS support
  console.log('\nSSL/TLS Support:');
  console.log('- OpenSSL version:', process.versions.openssl);
  
  // Test URLs
  console.log('\n🌐 Testing URL Connections:');
  for (const url of testUrls) {
    await testSSLConnection(url);
  }
}

async function testWithDifferentSSLConfig() {
  console.log('\n🔧 Testing with Different SSL Configurations');
  console.log('============================================');
  
  const testUrl = 'https://admin.tpaycloud.com';
  
  // Test 1: Default axios
  console.log('\n1️⃣ Testing with default axios:');
  try {
    const response = await axios.get(testUrl, { timeout: 5000 });
    console.log('✅ Default axios works');
  } catch (error) {
    console.log('❌ Default axios failed:', error.message);
  }
  
  // Test 2: With custom SSL agent
  console.log('\n2️⃣ Testing with custom SSL agent:');
  try {
    const response = await axios.get(testUrl, {
      timeout: 5000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
        secureProtocol: 'TLSv1_2_method'
      })
    });
    console.log('✅ Custom SSL agent works');
  } catch (error) {
    console.log('❌ Custom SSL agent failed:', error.message);
  }
  
  // Test 3: With different TLS version
  console.log('\n3️⃣ Testing with TLS 1.3:');
  try {
    const response = await axios.get(testUrl, {
      timeout: 5000,
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3'
      })
    });
    console.log('✅ TLS 1.3 works');
  } catch (error) {
    console.log('❌ TLS 1.3 failed:', error.message);
  }
}

async function main() {
  await testPaymentGatewayConfig();
  await testWithDifferentSSLConfig();
  
  console.log('\n💡 Troubleshooting Tips:');
  console.log('========================');
  console.log('1. Update Node.js to latest LTS version');
  console.log('2. Check if payment gateway URL is accessible');
  console.log('3. Try using a different SSL configuration');
  console.log('4. Check if you\'re behind a corporate firewall/proxy');
  console.log('5. Verify the payment gateway is not blocking your IP');
}

main().catch(console.error); 