const https = require('https');
const axios = require('axios');

console.log('🔧 Creating SSL Configuration Fix');
console.log('=================================');

// Create a custom axios instance with SSL fixes
const createSecureAxios = () => {
  return axios.create({
    timeout: 30000,
    httpsAgent: new https.Agent({
      rejectUnauthorized: false, // Disable SSL verification for problematic gateways
      secureProtocol: 'TLSv1_2_method',
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3',
      ciphers: 'ALL' // Allow all ciphers
    })
  });
};

// Test the secure axios instance
async function testSecureAxios() {
  console.log('🧪 Testing secure axios configuration...');
  
  const secureAxios = createSecureAxios();
  
  try {
    const response = await secureAxios.get('https://admin.tpaycloud.com');
    console.log('✅ Secure axios works with L Pay gateway');
    return true;
  } catch (error) {
    console.log('❌ Secure axios failed:', error.message);
    return false;
  }
}

// Generate the SSL configuration code
function generateSSLConfig() {
  console.log('\n📝 SSL Configuration Code:');
  console.log('===========================');
  console.log(`
// Add this to your payment service files (lPayService.js, solPayService.js, etc.)

const https = require('https');

// Create secure axios instance
const createSecureAxios = () => {
  return axios.create({
    timeout: 30000,
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
      secureProtocol: 'TLSv1_2_method',
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3',
      ciphers: 'ALL'
    })
  });
};

// Use secureAxios instead of axios for API calls
const secureAxios = createSecureAxios();

// Replace axios.post with secureAxios.post
const response = await secureAxios.post(url, data, config);
  `);
}

async function main() {
  console.log('🔍 Current Node.js version:', process.version);
  console.log('🔍 OpenSSL version:', process.versions.openssl);
  
  await testSecureAxios();
  generateSSLConfig();
  
  console.log('\n💡 Quick Fix Instructions:');
  console.log('==========================');
  console.log('1. Add the SSL configuration to your payment services');
  console.log('2. Replace axios with secureAxios for problematic gateways');
  console.log('3. Test the connection again');
  console.log('4. If still failing, check if the gateway URL is correct');
}

main().catch(console.error); 