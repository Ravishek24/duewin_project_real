const https = require('https');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

console.log('🔍 SolPay Specific Test');
console.log('=======================');

// SolPay Configuration
const solPayConfig = {
  host: process.env.SOLPAY_HOST || "https://openapi.solpay.link",
  merchantCode: process.env.SOLPAY_MERCHANT_CODE || "S820250509125213000",
  privateKey: process.env.SOLPAY_PRIVATE_KEY || "keghdfjsdgfjsdgdfjkaessfvsddkjhasdjghjksdgfkluidfhdjkghdksjgdjyvghjcbvbgyffsetqweiwptoerfgkmf",
  platformPublicKey: process.env.SOLPAY_PLATFORM_PUBLIC_KEY || "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCABwdjVHNcp+NWCOikKtBkgyubtyCloIEghVA8d5mdUCMnsfowgO5KwM3JH5NgZfzEGVNAmQAWHjtq7qrLqRHSc1aI2DF/hGZCn3clq0IQ+dJZtVkq1m58HiLb3QNRzs0elEDcBQdHJXqX1GmV3yH1v03j4UJUyGD3EdgxWHEXzwIDAQAB"
};

console.log('\n📋 SolPay Configuration:');
console.log('=======================');
console.log('Host:', solPayConfig.host);
console.log('Merchant Code:', solPayConfig.merchantCode);
console.log('Private Key:', solPayConfig.privateKey ? '***SET***' : '❌ NOT SET');
console.log('Platform Public Key:', solPayConfig.platformPublicKey ? '***SET***' : '❌ NOT SET');

// SolPay signature generation
function generateSolPaySignature(params, privateKey) {
  try {
    const filtered = Object.entries(params)
      .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'sign')
      .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
    
    const sortedKeys = Object.keys(filtered).sort();
    const strX = sortedKeys.map(key => String(filtered[key])).join('');
    
    const signer = crypto.createSign('RSA-SHA1');
    signer.update(strX, 'utf8');
    signer.end();
    
    let key = privateKey;
    if (!privateKey.includes('BEGIN')) {
      key = '-----BEGIN PRIVATE KEY-----\n' + privateKey + '\n-----END PRIVATE KEY-----';
    }
    return signer.sign(key, 'base64');
  } catch (error) {
    console.error('Error generating SolPay signature:', error);
    return null;
  }
}

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
      
      const response = await testAxios.get(solPayConfig.host);
      console.log(`✅ Success: ${response.status} - ${response.statusText}`);
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      if (error.code === 'ERR_TLS_PROTOCOL_VERSION_CONFLICT') {
        console.log(`   🔧 TLS Conflict Detected!`);
      }
    }
  }
}

// Test SolPay API with correct SSL config
async function testSolPayAPI() {
  console.log('\n🔧 Testing SolPay API with Fixed SSL Config');
  console.log('==========================================');
  
  if (!solPayConfig.merchantCode || !solPayConfig.privateKey) {
    console.log('❌ Missing SOLPAY_MERCHANT_CODE or SOLPAY_PRIVATE_KEY');
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
  
  // Test Balance Query
  console.log('\n1️⃣ Testing Balance Query:');
  try {
    const balanceParams = {
      merchantCode: solPayConfig.merchantCode,
      queryType: 'BALANCE_QUERY'
    };
    
    const signature = generateSolPaySignature(balanceParams, solPayConfig.privateKey);
    balanceParams.sign = signature;
    
    const response = await secureAxios.post(
      `${solPayConfig.host}/gateway/v1/query`,
      balanceParams,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    console.log('✅ Balance Query Response:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Balance Query Failed:', error.response?.status, error.response?.data || error.message);
    if (error.code === 'ERR_TLS_PROTOCOL_VERSION_CONFLICT') {
      console.log('🔧 TLS Conflict detected - this is the issue!');
    }
  }
  
  // Test Create Deposit Order
  console.log('\n2️⃣ Testing Create Deposit Order:');
  try {
    const depositParams = {
      merchantCode: solPayConfig.merchantCode,
      orderNum: 'TEST' + Date.now(),
      payMoney: '100.00',
      productDetail: 'Test Deposit',
      name: 'Test User',
      email: 'test@example.com',
      phone: '1234567890',
      notifyUrl: 'https://api.strikecolor1.com/api/payments/solpay/callback',
      redirectUrl: 'https://api.strikecolor1.com/api/payments/solpay/redirect',
      expiryPeriod: '1440'
    };
    
    const signature = generateSolPaySignature(depositParams, solPayConfig.privateKey);
    depositParams.sign = signature;
    
    const response = await secureAxios.post(
      `${solPayConfig.host}/gateway/v1/INR/pay`,
      depositParams,
      {
        headers: { 'Content-Type': 'application/json' }
      }
    );
    console.log('✅ Deposit Order Response:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('❌ Deposit Order Failed:', error.response?.status, error.response?.data || error.message);
    if (error.code === 'ERR_TLS_PROTOCOL_VERSION_CONFLICT') {
      console.log('🔧 TLS Conflict detected - this is the issue!');
    }
  }
}

// Test the actual SolPay service
async function testSolPayService() {
  console.log('\n🔧 Testing SolPay Service');
  console.log('=========================');
  
  try {
    // Import the SolPay service
    const {
      createSolPayDepositOrder,
      querySolPayBalance
    } = require('./services/solPayService');
    
    console.log('✅ SolPay service imported successfully');
    
    // Test balance query
    console.log('\n1️⃣ Testing Service Balance Query:');
    try {
      const result = await querySolPayBalance();
      console.log('✅ Service Balance Query Result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.log('❌ Service Balance Query Failed:', error.message);
    }
    
    // Test deposit order creation
    console.log('\n2️⃣ Testing Service Deposit Order:');
    try {
      const result = await createSolPayDepositOrder(
        123, // userId
        'TEST' + Date.now(), // orderId
        {
          amount: '100.00',
          productDetail: 'Test Deposit',
          name: 'Test User',
          email: 'test@example.com',
          phone: '1234567890'
        },
        'https://api.strikecolor1.com/api/payments/solpay/callback',
        1 // gatewayId
      );
      console.log('✅ Service Deposit Order Result:', JSON.stringify(result, null, 2));
    } catch (error) {
      console.log('❌ Service Deposit Order Failed:', error.message);
    }
    
  } catch (error) {
    console.log('❌ Failed to import SolPay service:', error.message);
  }
}

async function main() {
  console.log('🔍 Node.js Version:', process.version);
  console.log('🔍 OpenSSL Version:', process.versions.openssl);
  
  await testSSLConfigurations();
  await testSolPayAPI();
  await testSolPayService();
  
  console.log('\n💡 SolPay SSL Configuration:');
  console.log('============================');
  console.log('If you see TLS conflicts, use this configuration:');
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