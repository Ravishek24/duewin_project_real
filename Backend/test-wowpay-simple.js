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

async function testWowPayAPIOnly() {
    try {
        console.log('🧪 Testing WowPay API (Without Database)');
        console.log('=========================================');
        
        const payload = {
            merchant_no: wowPayConfig.merchant_no,
            out_trade_sn: `SIMPLE_${Date.now()}`,
            amount: '1000.00',
            title: 'Simple Test Payment',
            notify_url: 'https://api.strikecolor1.com/api/payments/wowpay/payin-callback',
            return_url: 'https://api.strikecolor1.com/success',
            attach: 'simple_test',
            sign_type: wowPayConfig.sign_type
        };

        payload.sign = generateMD5Signature(payload, wowPayConfig.key);

        console.log('📤 Request payload:');
        console.log(JSON.stringify(payload, null, 2));

        const response = await axios.post(`${wowPayConfig.host}/gw-api/deposit/create`, payload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });

        console.log('\n📥 Response Details:');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));

        console.log('\n🔍 Response Analysis:');
        console.log('response.data.code:', response.data.code, '(type:', typeof response.data.code, ')');
        console.log('response.data.message:', response.data.message);
        console.log('response.data.data:', response.data.data);

        // Test success conditions
        const isSuccess100String = response.data && response.data.code === '100';
        const isSuccess100Number = response.data && response.data.code === 100;
        const hasData = response.data && response.data.data;
        const hasTradeUrl = response.data && response.data.data && response.data.data.trade_url;

        console.log('\n🧪 Condition Tests:');
        console.log('Code === "100" (string):', isSuccess100String);
        console.log('Code === 100 (number):', isSuccess100Number);
        console.log('Has data field:', hasData);
        console.log('Has trade_url:', hasTradeUrl);

        if (isSuccess100String || isSuccess100Number) {
            console.log('\n✅ SUCCESS: WowPay API call successful');
            
            if (hasTradeUrl) {
                console.log('🔗 Payment URL:', response.data.data.trade_url);
                console.log('📋 System Order ID:', response.data.data.order_sn);
            } else {
                console.log('⚠️ No payment URL in response - might be IP whitelist issue resolved but no payment channel available');
            }
        } else {
            console.log('\n❌ FAILED:', response.data?.message || 'Unknown error');
            console.log('📟 Error code:', response.data?.code);
        }

        // Determine next steps
        if (response.data?.code === -1 && response.data?.message?.includes('ip白名单')) {
            console.log('\n💡 Next Step: Get IP whitelisted in WowPay merchant portal');
        } else if ((isSuccess100String || isSuccess100Number) && !hasTradeUrl) {
            console.log('\n💡 Next Step: Contact WowPay support to activate payment channels');
        } else if (isSuccess100String || isSuccess100Number) {
            console.log('\n💡 Ready for production - database integration should work');
        }

    } catch (error) {
        console.log('\n❌ ERROR:', error.message);
        if (error.response) {
            console.log('Response status:', error.response.status);
            console.log('Response data:', error.response.data);
        }
    }
}

testWowPayAPIOnly().catch(console.error); 