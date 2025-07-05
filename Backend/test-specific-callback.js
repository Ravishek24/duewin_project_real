const axios = require('axios');

// Test callback for the specific order you just created
async function testSpecificCallback() {
    console.log('🧪 Testing PPayPro Callback for Order: PIPP175129961715113\n');
    
    const callbackData = {
        payOrderId: 'P1939717303078371329',
        mchOrderNo: 'PIPP175129961715113',
        amount: '100000',
        state: '2', // Success
        currency: 'INR',
        createdAt: '1751299618097',
        successTime: '1751299618097',
        sign: 'E1420259C03173B51C0F8869ACE0F5C7'
    };
    
    console.log('📤 Sending callback with exact data:');
    console.log(JSON.stringify(callbackData, null, 2));
    
    try {
        const response = await axios.post('https://api.strikecolor1.com/api/payments/ppaypro/payin-callback', 
            callbackData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                transformRequest: [function (data) {
                    return Object.keys(data)
                        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(data[key]))
                        .join('&');
                }]
            }
        );
        
        console.log('\n✅ Callback Response:');
        console.log(`Status: ${response.status}`);
        console.log(`Data: ${response.data}`);
        
        if (response.data === 'success') {
            console.log('\n🎉 SUCCESS! Callback processed successfully!');
            console.log('💰 User wallet should be credited with ₹1,000');
        } else {
            console.log('\n⚠️ Callback processed but returned:', response.data);
        }
        
    } catch (error) {
        console.error('\n❌ Callback Error:', error.response?.status, error.response?.data);
        if (error.response?.data) {
            console.error('Full error response:', error.response.data);
        }
    }
}

// Test failed callback
async function testFailedCallback() {
    console.log('\n🧪 Testing Failed Callback for Order: PIPP175129961715113\n');
    
    const callbackData = {
        payOrderId: 'P1939717303078371329',
        mchOrderNo: 'PIPP175129961715113',
        amount: '100000',
        state: '3', // Failed
        currency: 'INR',
        createdAt: '1751299618097',
        successTime: '1751299618097',
        sign: 'E1420259C03173B51C0F8869ACE0F5C7'
    };
    
    console.log('📤 Sending failed callback:');
    console.log(JSON.stringify(callbackData, null, 2));
    
    try {
        const response = await axios.post('https://api.strikecolor1.com/api/payments/ppaypro/payin-callback', 
            callbackData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                transformRequest: [function (data) {
                    return Object.keys(data)
                        .map(key => encodeURIComponent(key) + '=' + encodeURIComponent(data[key]))
                        .join('&');
                }]
            }
        );
        
        console.log('\n✅ Failed Callback Response:');
        console.log(`Status: ${response.status}`);
        console.log(`Data: ${response.data}`);
        
    } catch (error) {
        console.error('\n❌ Failed Callback Error:', error.response?.status, error.response?.data);
    }
}

// Main function
async function main() {
    console.log('🚀 Testing PPayPro Callback for Specific Order\n');
    console.log('Order Details:');
    console.log('- Order ID: PIPP175129961715113');
    console.log('- PPayPro Order ID: P1939717303078371329');
    console.log('- Amount: ₹1,000 (100,000 paisa)');
    console.log('- User ID: 13\n');
    
    await testSpecificCallback();
    await testFailedCallback();
    
    console.log('\n✅ All tests completed!');
    console.log('\n📝 Note: Check the callback logs to see if the callbacks were received:');
    console.log('node check-ppaypro-logs.js');
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    testSpecificCallback,
    testFailedCallback
}; 