const https = require('https');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

console.log('🔍 L Pay Configuration Test');
console.log('===========================');

// L Pay Configuration
const lPayConfig = {
  baseUrl: process.env.LPAY_BASE_URL || 'https://admin.tpaycloud.com',
  memberCode: process.env.LPAY_MEMBER_CODE,
  secretKey: process.env.LPAY_SECRET_KEY,
  defaultCollectionChannel: process.env.LPAY_DEFAULT_COLLECTION_CHANNEL || 'paystack001',
  defaultTransferChannel: process.env.LPAY_DEFAULT_TRANSFER_CHANNEL || 'moonpay001',
  defaultBankCode: process.env.LPAY_DEFAULT_BANK_CODE || 'IDPT0001'
};

console.log('\n📋 L Pay Configuration:');
console.log('======================');
console.log('Base URL:', lPayConfig.baseUrl);
console.log('Member Code:', lPayConfig.memberCode);
console.log('Secret Key:', lPayConfig.secretKey ? '***SET***' : '❌ NOT SET');
console.log('Default Collection Channel:', lPayConfig.defaultCollectionChannel);
console.log('Default Transfer Channel:', lPayConfig.defaultTransferChannel);
console.log('Default Bank Code:', lPayConfig.defaultBankCode);

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

const secureAxios = createSecureAxios();

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

async function testLPayEndpoints() {
  console.log('\n🧪 Testing L Pay API Endpoints');
  console.log('==============================');
  
  if (!lPayConfig.memberCode || !lPayConfig.secretKey) {
    console.log('❌ Missing LPAY_MEMBER_CODE or LPAY_SECRET_KEY in environment variables');
    return;
  }
  
  // Test 1: Get Bank List (usually doesn't require signature)
  console.log('\n1️⃣ Testing Bank List Endpoint:');
  try {
    const bankListParams = { memberCode: lPayConfig.memberCode };
    const response = await secureAxios.get(
      `${lPayConfig.baseUrl}/v1/outorder/bankList`,
      { params: bankListParams }
    );
    console.log('✅ Bank List Response:', response.status);
    console.log('Data:', response.data);
  } catch (error) {
    console.log('❌ Bank List Failed:', error.response?.status, error.response?.data || error.message);
  }
  
  // Test 2: Query Merchant Balance
  console.log('\n2️⃣ Testing Merchant Balance Endpoint:');
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
    console.log('Data:', response.data);
  } catch (error) {
    console.log('❌ Balance Failed:', error.response?.status, error.response?.data || error.message);
  }
  
  // Test 3: Create Deposit Order
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
    console.log('Data:', response.data);
  } catch (error) {
    console.log('❌ Deposit Order Failed:', error.response?.status, error.response?.data || error.message);
  }
}

async function testAlternativeURLs() {
  console.log('\n🌐 Testing Alternative L Pay URLs');
  console.log('==================================');
  
  const alternativeUrls = [
    'https://admin.tpaycloud.com',
    'https://api.tpaycloud.com',
    'https://tpaycloud.com',
    'https://www.tpaycloud.com'
  ];
  
  for (const url of alternativeUrls) {
    console.log(`\n🔗 Testing: ${url}`);
    try {
      const response = await secureAxios.get(url, { timeout: 5000 });
      console.log(`✅ ${response.status} - ${response.statusText}`);
    } catch (error) {
      console.log(`❌ ${error.response?.status || error.code} - ${error.message}`);
    }
  }
}

async function main() {
  console.log('🔍 Node.js Version:', process.version);
  console.log('🔍 OpenSSL Version:', process.versions.openssl);
  
  await testLPayEndpoints();
  await testAlternativeURLs();
  
  console.log('\n💡 Troubleshooting for 403 Error:');
  console.log('==================================');
  console.log('1. Check if LPAY_MEMBER_CODE and LPAY_SECRET_KEY are correct');
  console.log('2. Verify your IP is whitelisted in L Pay merchant portal');
  console.log('3. Check if the base URL is correct');
  console.log('4. Contact L Pay support to verify your account status');
  console.log('5. Check if there are any API rate limits');
}

main().catch(console.error); 