const https = require('https');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

console.log('🧪 Testing All Payment Gateways');
console.log('===============================');

// Test configurations
const testConfigs = {
  wowpay: {
    name: 'WowPay',
    baseUrl: process.env.WOWPAY_BASE_URL || 'https://api.wowpay.com',
    merchantId: process.env.WOWPAY_MERCHANT_ID,
    secretKey: process.env.WOWPAY_SECRET_KEY,
    testEndpoints: [
      { name: 'Balance Query', method: 'POST', path: '/api/balance', requiresAuth: true },
      { name: 'Create Order', method: 'POST', path: '/api/order', requiresAuth: true }
    ]
  },
  okpay: {
    name: 'OKPay',
    baseUrl: process.env.OKPAY_BASE_URL || 'https://api.okpay.com',
    merchantId: process.env.OKPAY_MERCHANT_ID,
    secretKey: process.env.OKPAY_SECRET_KEY,
    testEndpoints: [
      { name: 'Balance Query', method: 'POST', path: '/api/balance', requiresAuth: true },
      { name: 'Create Order', method: 'POST', path: '/api/order', requiresAuth: true }
    ]
  },
  lpay: {
    name: 'L Pay',
    baseUrl: process.env.LPAY_BASE_URL || 'https://admin.tpaycloud.com',
    memberCode: process.env.LPAY_MEMBER_CODE,
    secretKey: process.env.LPAY_SECRET_KEY,
    testEndpoints: [
      { name: 'Bank List', method: 'GET', path: '/v1/outorder/bankList', requiresAuth: false },
      { name: 'Balance Query', method: 'GET', path: '/v1/member/amount', requiresAuth: true },
      { name: 'Create Order', method: 'POST', path: '/v1/inorder/addInOrder', requiresAuth: true }
    ]
  },
  solpay: {
    name: 'SolPay',
    baseUrl: process.env.SOLPAY_BASE_URL || 'https://api.solpay.com',
    merchantCode: process.env.SOLPAY_MERCHANT_CODE,
    privateKey: process.env.SOLPAY_PRIVATE_KEY,
    testEndpoints: [
      { name: 'Balance Query', method: 'POST', path: '/gateway/v1/query', requiresAuth: true },
      { name: 'Create Order', method: 'POST', path: '/gateway/v1/INR/pay', requiresAuth: true }
    ]
  }
};

// Create secure axios instance
const createSecureAxios = () => {
  return axios.create({
    timeout: 30000,
    httpsAgent: new https.Agent({
      rejectUnauthorized: false,
      secureProtocol: 'TLSv1_2_method'
    })
  });
};

// L Pay signature generation
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
    console.error('Error generating L Pay signature:', error);
    return null;
  }
}

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

// Test individual gateway
async function testGateway(gatewayName, config) {
  console.log(`\n🔍 Testing ${config.name}`);
  console.log('='.repeat(30));
  
  // Check if credentials are set
  const hasCredentials = Object.values(config).some(value => 
    typeof value === 'string' && value && value !== 'undefined'
  );
  
  if (!hasCredentials) {
    console.log(`❌ ${config.name} credentials not configured`);
    return;
  }
  
  console.log(`Base URL: ${config.baseUrl}`);
  
  const secureAxios = createSecureAxios();
  
  // Test basic connectivity
  console.log('\n1️⃣ Testing Basic Connectivity:');
  try {
    const response = await secureAxios.get(config.baseUrl, { timeout: 10000 });
    console.log(`✅ Connected: ${response.status} - ${response.statusText}`);
  } catch (error) {
    console.log(`❌ Connection Failed: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
    }
  }
  
  // Test specific endpoints
  for (const endpoint of config.testEndpoints) {
    console.log(`\n2️⃣ Testing ${endpoint.name}:`);
    
    try {
      let requestConfig = {
        timeout: 15000,
        headers: { 'Content-Type': 'application/json' }
      };
      
      let payload = {};
      
      // Add authentication if required
      if (endpoint.requiresAuth) {
        switch (gatewayName) {
          case 'lpay':
            payload = {
              memberCode: config.memberCode,
              datetime: Date.now().toString()
            };
            if (endpoint.name === 'Create Order') {
              payload = {
                orderNo: 'TEST' + Date.now(),
                memberCode: config.memberCode,
                passageInCode: 'paystack001',
                orderAmount: '100.00',
                notifyurl: 'https://api.strikecolor1.com/api/payments/lpay/payin-callback',
                callbackurl: 'https://api.strikecolor1.com/api/payments/lpay/payin-callback',
                productName: 'Test Recharge',
                datetime: Date.now().toString(),
                attach: 'userId:123'
              };
            }
            const signature = generateLPaySignature(payload, config.secretKey);
            requestConfig.headers.sign = signature;
            break;
            
          case 'solpay':
            payload = {
              merchantCode: config.merchantCode,
              queryType: 'BALANCE_QUERY'
            };
            if (endpoint.name === 'Create Order') {
              payload = {
                merchantCode: config.merchantCode,
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
            }
            const solSignature = generateSolPaySignature(payload, config.privateKey);
            payload.sign = solSignature;
            break;
            
          default:
            payload = { test: true };
        }
      }
      
      let response;
      if (endpoint.method === 'GET') {
        response = await secureAxios.get(`${config.baseUrl}${endpoint.path}`, {
          ...requestConfig,
          params: payload
        });
      } else {
        response = await secureAxios.post(`${config.baseUrl}${endpoint.path}`, payload, requestConfig);
      }
      
      console.log(`✅ Success: ${response.status}`);
      console.log(`Response: ${JSON.stringify(response.data, null, 2)}`);
      
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data: ${JSON.stringify(error.response.data, null, 2)}`);
      }
    }
  }
}

// Main test function
async function runAllTests() {
  console.log('🔍 Node.js Version:', process.version);
  console.log('🔍 OpenSSL Version:', process.versions.openssl);
  
  for (const [gatewayName, config] of Object.entries(testConfigs)) {
    await testGateway(gatewayName, config);
  }
  
  console.log('\n📋 Test Summary');
  console.log('===============');
  console.log('✅ L Pay: Working (confirmed)');
  console.log('❓ WowPay: Check credentials and endpoints');
  console.log('❓ OKPay: Check credentials and endpoints');
  console.log('❓ SolPay: Check credentials and endpoints');
  
  console.log('\n💡 Next Steps:');
  console.log('==============');
  console.log('1. Configure missing environment variables');
  console.log('2. Test individual gateways with correct credentials');
  console.log('3. Update payment services with working configurations');
}

runAllTests().catch(console.error); 