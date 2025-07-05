const https = require('https');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

console.log('🔧 Fixing TLS Protocol Version Conflict');
console.log('======================================');

// L Pay Configuration
const lPayConfig = {
  baseUrl: process.env.LPAY_BASE_URL || 'https://admin.tpaycloud.com',
  memberCode: process.env.LPAY_MEMBER_CODE,
  secretKey: process.env.LPAY_SECRET_KEY,
  defaultCollectionChannel: process.env.LPAY_DEFAULT_COLLECTION_CHANNEL || 'paystack001'
};

console.log('\n📋 L Pay Configuration:');
console.log('======================');
console.log('Base URL:', lPayConfig.baseUrl);
console.log('Member Code:', lPayConfig.memberCode);
console.log('Secret Key:', lPayConfig.secretKey ? '***SET***' : '❌ NOT SET');

// Test different SSL configurations
async function testSSLConfigurations() {
  console.log('\n🧪 Testing Different SSL Configurations');
  console.log('========================================');
  
  const configs = [
    {
      name: '1️⃣ Default axios (no SSL config)',
      config: {}
    },
    {
      name: '2️⃣ Only rejectUnauthorized: false',
      config: {
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        })
      }
    },
    {
      name: '3️⃣ With secureProtocol only',
      config: {
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
          secureProtocol: 'TLSv1_2_method'
        })
      }
    },
    {
      name: '4️⃣ With minVersion/maxVersion only',
      config: {
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
          minVersion: 'TLSv1.2',
          maxVersion: 'TLSv1.3'
        })
      }
    },
    {
      name: '5️⃣ With ciphers only',
      config: {
        httpsAgent: new https.Agent({
          rejectUnauthorized: false,
          ciphers: 'ALL'
        })
      }
    }
  ];
  
  for (const config of configs) {
    console.log(`\n${config.name}:`);
    try {
      const testAxios = axios.create({
        timeout: 10000,
        ...config.config
      });
      
      const response = await testAxios.get(lPayConfig.baseUrl);
      console.log(`✅ Success: ${response.status} - ${response.statusText}`);
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }
}

// Test L Pay API with correct SSL config
async function testLPayAPI() {
  console.log('\n🔧 Testing L Pay API with Fixed SSL Config');
  console.log('==========================================');
  
  if (!lPayConfig.memberCode || !lPayConfig.secretKey) {
    console.log('❌ Missing LPAY_MEMBER_CODE or LPAY_SECRET_KEY');
    return;
  }
  
  // Create axios with correct SSL config (no conflicts)
  const secureAxios = axios.create({
    timeout: 30000,
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
      secureProtocol: 'TLSv1_2_method' // Use only this, not minVersion/maxVersion
    })
  });
  
  // Signature generation function
  function generateLPaySignature(params, secretKey) {
    try {
      const sortedParams = {};
      Object.keys(params)
        .sort()
        .forEach(key => {
          if (
            params[key] !== undefined &&
            params[key] !== '' &&
            params[key] !== null &&
            key !== 'sign' &&
            key !== 'attach'
          ) {
            sortedParams[key] = params[key];
          }
        });

      let queryString = '';
      Object.entries(sortedParams).forEach(([key, value], index) => {
        if (index > 0) queryString += '&';
        queryString += `${key}=${value}`;
      });
      queryString += `&key=${secretKey}`;
      
      return crypto
        .createHash('md5')
        .update(queryString)
        .digest('hex')
        .toUpperCase();
    } catch (error) {
      console.error('Error generating signature:', error);
      return null;
    }
  }
  
  // Test Bank List (usually doesn't require signature)
  console.log('\n1️⃣ Testing Bank List:');
  try {
    const bankListParams = { memberCode: lPayConfig.memberCode };
    const response = await secureAxios.get(
      `${lPayConfig.baseUrl}/v1/outorder/bankList`,
      { params: bankListParams }
    );
    console.log('✅ Bank List Response:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Bank List Failed:', error.response?.status, error.response?.data || error.message);
  }
  
  // Test Merchant Balance
  console.log('\n2️⃣ Testing Merchant Balance:');
  try {
    const balanceParams = { memberCode: lPayConfig.memberCode };
    const signature = generateLPaySignature(balanceParams, lPayConfig.secretKey);
    const response = await secureAxios.get(
      `${lPayConfig.baseUrl}/v1/member/amount`,
      {
        params: balanceParams,
        headers: { 'sign': signature }
      }
    );
    console.log('✅ Balance Response:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Balance Failed:', error.response?.status, error.response?.data || error.message);
  }
  
  // Test Create Deposit Order
  console.log('\n3️⃣ Testing Create Deposit Order:');
  try {
    const depositParams = {
      orderNo: 'TEST' + Date.now(),
      memberCode: lPayConfig.memberCode,
      passageInCode: lPayConfig.defaultCollectionChannel,
      orderAmount: '100.00',
      notifyurl: 'https://api.strikecolor1.com/api/payments/lpay/payin-callback',
      callbackurl: 'https://api.strikecolor1.com/api/payments/lpay/payin-callback',
      productName: 'Test Recharge',
      datetime: Date.now().toString(),
      attach: 'userId:123'
    };
    
    const signature = generateLPaySignature(depositParams, lPayConfig.secretKey);
    const response = await secureAxios.post(
      `${lPayConfig.baseUrl}/v1/inorder/addInOrder`,
      depositParams,
      {
        headers: {
          'Content-Type': 'application/json',
          'sign': signature
        }
      }
    );
    console.log('✅ Deposit Order Response:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Deposit Order Failed:', error.response?.status, error.response?.data || error.message);
  }
}

async function main() {
  console.log('🔍 Node.js Version:', process.version);
  console.log('🔍 OpenSSL Version:', process.versions.openssl);
  
  await testSSLConfigurations();
  await testLPayAPI();
  
  console.log('\n💡 Fixed SSL Configuration:');
  console.log('============================');
  console.log('Use this configuration in your payment services:');
  console.log(`
const secureAxios = axios.create({
  timeout: 30000,
  httpsAgent: new https.Agent({
    rejectUnauthorized: false,
    secureProtocol: 'TLSv1_2_method'  // Use only this, not minVersion/maxVersion
  })
});
  `);
}

main().catch(console.error); 