const axios = require('axios');
const crypto = require('crypto');

const wowPayConfig = {
    merchant_no: 'ruNkLnM3bncNAzd7',
    key: 'yyooneljwI3hEHurYvrna14zGcEElWUS',
    host: 'https://test.wowpay.biz',
    sign_type: 'MD5'
};

function generateMD5Signature(params, secretKey) {
    const sortedParams = {};
    Object.keys(params)
        .filter(key => key !== 'sign')
        .sort()
        .forEach(key => {
            if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
                sortedParams[key] = params[key];
            }
        });

    const queryString = Object.keys(sortedParams)
        .map(key => `${key}=${sortedParams[key]}`)
        .join('&');
    
    const stringToSign = queryString + '&key=' + secretKey;
    return crypto.createHash('md5').update(stringToSign).digest('hex').toUpperCase();
}

async function debugWowPayResponse() {
    try {
        console.log('🔍 Debugging WowPay Response Structure');
        console.log('======================================');
        
        const payload = {
            merchant_no: wowPayConfig.merchant_no,
            out_trade_sn: `DEBUG_${Date.now()}`,
            amount: '100.00',
            title: 'Debug Test',
            notify_url: 'https://api.strikecolor1.com/api/payments/wowpay/payin-callback',
            return_url: 'https://api.strikecolor1.com/success',
            attach: 'debug_test',
            sign_type: wowPayConfig.sign_type
        };

        payload.sign = generateMD5Signature(payload, wowPayConfig.key);

        console.log('📤 Request payload:');
        console.log(JSON.stringify(payload, null, 2));

        const response = await axios.post(`${wowPayConfig.host}/gw-api/deposit/create`, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        console.log('\n📥 Raw Response Details:');
        console.log('Status:', response.status);
        console.log('Headers:', response.headers);
        console.log('Data:', JSON.stringify(response.data, null, 2));

        console.log('\n🔍 Response Analysis:');
        console.log('response.data:', response.data);
        console.log('response.data.code:', response.data.code);
        console.log('typeof response.data.code:', typeof response.data.code);
        console.log('response.data.message:', response.data.message);
        console.log('response.data.data:', response.data.data);

        console.log('\n🧪 Condition Tests:');
        console.log('response.data exists:', !!response.data);
        console.log('response.data.code === "100":', response.data.code === '100');
        console.log('response.data.code === 100:', response.data.code === 100);
        console.log('response.data.data exists:', !!response.data.data);

        // Test both conditions
        const condition1 = response.data && response.data.code === '100' && response.data.data;
        const condition2 = response.data && response.data.code === 100 && response.data.data;
        const condition3 = response.data && (response.data.code === '100' || response.data.code === 100) && response.data.data;

        console.log('\nCondition Results:');
        console.log('String "100":', condition1);
        console.log('Number 100:', condition2);
        console.log('Either (recommended):', condition3);

    } catch (error) {
        console.log('\n❌ ERROR:', error.message);
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response data:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

debugWowPayResponse().catch(console.error); 