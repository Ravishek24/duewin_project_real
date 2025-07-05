const axios = require('axios');
const crypto = require('crypto');

const wowPayConfig = {
    merchant_no: 'ruNkLnM3bncNAzd7',
    key: 'yyooneljwI3hEHurYvrna14zGcEElWUS',
    host: 'https://test.wowpay.biz',
    sign_type: 'MD5'
};

function generateMD5Signature(params, secretKey) {
    // Sort parameters alphabetically (excluding sign)
    const sortedParams = {};
    Object.keys(params)
        .filter(key => key !== 'sign')
        .sort()
        .forEach(key => {
            if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
                sortedParams[key] = params[key];
            }
        });

    // Create query string
    const queryString = Object.keys(sortedParams)
        .map(key => `${key}=${sortedParams[key]}`)
        .join('&');
    
    // Add secret key
    const stringToSign = queryString + '&key=' + secretKey;
    
    console.log('String to sign:', stringToSign);
    
    // Generate MD5 hash
    return crypto.createHash('md5').update(stringToSign).digest('hex').toUpperCase();
}

async function testWowPayWithStrikeColor() {
    try {
        console.log('🧪 Testing WowPay with api.strikecolor1.com');
        console.log('=============================================');
        
        const payload = {
            merchant_no: wowPayConfig.merchant_no,
            out_trade_sn: `TEST_SC_${Date.now()}`,
            amount: '100.00',
            title: 'Strike Color Test Payment',
            notify_url: 'https://api.strikecolor1.com/api/payments/wowpay/payin-callback',
            return_url: 'https://api.strikecolor1.com/success',
            attach: 'strikecolor_test',
            sign_type: wowPayConfig.sign_type
        };

        // Generate signature
        payload.sign = generateMD5Signature(payload, wowPayConfig.key);

        console.log('📤 Request payload:');
        console.log(JSON.stringify(payload, null, 2));

        const response = await axios.post(`${wowPayConfig.host}/gw-api/deposit/create`, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        console.log('\n📥 Response:');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));

        if (response.data && response.data.code === '100') {
            console.log('\n✅ SUCCESS: Payment order created');
            console.log('🔗 Payment URL:', response.data.data?.trade_url);
            console.log('📋 System Order ID:', response.data.data?.order_sn);
        } else {
            console.log('\n❌ FAILED:', response.data?.message || 'Unknown error');
            console.log('📟 Error code:', response.data?.code);
            
            // Provide specific guidance for common errors
            if (response.data?.code === '-1' && response.data?.message?.includes('ip白名单')) {
                console.log('\n💡 IP Whitelist Issue:');
                console.log('- Add your server IP to WowPay merchant portal');
                console.log('- Contact WowPay support to whitelist api.strikecolor1.com server IP');
            }
        }

    } catch (error) {
        console.log('\n❌ ERROR:', error.message);
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response data:', error.response.data);
        }
        
        if (error.code === 'ENOTFOUND') {
            console.log('💡 DNS resolution failed - check network connectivity');
        }
    }
}

// Also test the callback URL format
function testCallbackUrlFormat() {
    console.log('\n🔗 Callback URL Information:');
    console.log('=============================================');
    console.log('Deposit callback: https://api.strikecolor1.com/api/payments/wowpay/payin-callback');
    console.log('Withdrawal callback: https://api.strikecolor1.com/api/payments/wowpay/payout-callback');
    console.log('Return URL: https://api.strikecolor1.com/success');
    console.log('\n📝 Make sure these URLs are:');
    console.log('- Accessible from WowPay servers');
    console.log('- Added to IP whitelist if required');
    console.log('- Using HTTPS (recommended for production)');
}

async function runTest() {
    testCallbackUrlFormat();
    await testWowPayWithStrikeColor();
}

runTest().catch(console.error); 