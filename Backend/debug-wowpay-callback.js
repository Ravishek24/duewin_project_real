const crypto = require('crypto');

console.log('🔍 WowPay Callback Data Analysis');
console.log('================================');

// The callback data you received
const callbackData = {
    "merchant_no": "ruNkLnM3bncNAzd7",
    "out_trade_sn": "PIWO175112611525513",
    "title": null,
    "amount": "1000.00",
    "attach": null,
    "return_url": null,
    "notify_url": "https://api.strikecolor1.com/api/payments/wowpay/payin-callback",
    "sign_type": "MD5",
    "user_name": null,
    "bank_card_no": null
};

console.log('\n📥 Received Callback Data:');
console.log(JSON.stringify(callbackData, null, 2));

console.log('\n🔍 Analysis:');
console.log('===========');

// Check what fields are present
const presentFields = Object.keys(callbackData).filter(key => callbackData[key] !== null && callbackData[key] !== undefined);
const missingFields = ['trade_status', 'order_sn', 'sign'];

console.log('✅ Present fields:', presentFields);
console.log('❌ Missing fields:', missingFields);

// Check if this looks like a status update callback or just a notification
if (callbackData.amount && callbackData.out_trade_sn) {
    console.log('\n💡 This appears to be a payment notification callback');
    console.log('   - Contains order details (out_trade_sn, amount)');
    console.log('   - Missing trade_status (payment status)');
    console.log('   - Missing sign (signature for verification)');
} else {
    console.log('\n💡 This appears to be a status update callback');
}

// Test signature generation with available fields
console.log('\n🔐 Signature Test:');
console.log('=================');

const wowPayConfig = {
    mchId: 'ruNkLnM3bncNAzd7',
    key: 'yyooneljwI3hEHurYvrna14zGcEElWUS',
    signType: 'MD5'
};

function generateWowPaySignature(params, secretKey = wowPayConfig.key) {
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

// Generate signature for the received data
const calculatedSignature = generateWowPaySignature(callbackData);
console.log('Calculated signature:', calculatedSignature);

// Test different callback scenarios
console.log('\n🧪 Testing Different Callback Scenarios:');
console.log('========================================');

// Scenario 1: Status update callback (what we expect)
const statusCallback = {
    ...callbackData,
    "trade_status": "success",
    "order_sn": "TPOLY2025062800013",
    "sign": calculatedSignature
};

console.log('\n1. Status Update Callback (Expected):');
console.log(JSON.stringify(statusCallback, null, 2));

// Scenario 2: Payment notification (what you received)
const notificationCallback = {
    ...callbackData,
    "sign": calculatedSignature
};

console.log('\n2. Payment Notification Callback (Received):');
console.log(JSON.stringify(notificationCallback, null, 2));

// Scenario 3: Failed payment
const failedCallback = {
    ...callbackData,
    "trade_status": "failed",
    "order_sn": "TPOLY2025062800013",
    "sign": generateWowPaySignature({...callbackData, "trade_status": "failed", "order_sn": "TPOLY2025062800013"})
};

console.log('\n3. Failed Payment Callback:');
console.log(JSON.stringify(failedCallback, null, 2));

console.log('\n🎯 Recommendations:');
console.log('===================');
console.log('1. The callback you received appears to be a payment notification, not a status update');
console.log('2. WowPay should send a separate callback with trade_status when payment is completed');
console.log('3. Your callback handler expects trade_status field - this needs to be handled');
console.log('4. The signature verification will fail because sign field is missing');

console.log('\n🔧 Suggested Fix:');
console.log('================');
console.log('Update your callback handler to:');
console.log('1. Handle callbacks without trade_status (payment notifications)');
console.log('2. Handle callbacks with trade_status (status updates)');
console.log('3. Make signature verification optional for notification callbacks');
console.log('4. Query payment status separately if needed');

console.log('\n📞 Next Steps:');
console.log('==============');
console.log('1. Contact WowPay support to confirm callback format');
console.log('2. Ask if they send separate status update callbacks');
console.log('3. Check if you need to query payment status manually');
console.log('4. Update your callback handler to handle both notification and status callbacks'); 