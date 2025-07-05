const axios = require('axios');

// Test if PPayPro callback routes are accessible
async function testRoutes() {
    console.log('🔍 Testing PPayPro callback routes...\n');
    
    const baseUrl = 'https://api.strikecolor1.com';
    
    // Test deposit callback route
    try {
        console.log('1️⃣ Testing deposit callback route...');
        const depositResponse = await axios.post(`${baseUrl}/api/payments/ppaypro/payin-callback`, {
            test: 'data'
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        console.log('✅ Deposit callback route accessible');
        console.log('Response:', depositResponse.status, depositResponse.data);
    } catch (error) {
        console.log('❌ Deposit callback route error:', error.response?.status, error.response?.data);
    }
    
    console.log('\n');
    
    // Test withdrawal callback route
    try {
        console.log('2️⃣ Testing withdrawal callback route...');
        const withdrawalResponse = await axios.post(`${baseUrl}/api/payments/ppaypro/payout-callback`, {
            test: 'data'
        }, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        console.log('✅ Withdrawal callback route accessible');
        console.log('Response:', withdrawalResponse.status, withdrawalResponse.data);
    } catch (error) {
        console.log('❌ Withdrawal callback route error:', error.response?.status, error.response?.data);
    }
    
    console.log('\n✅ Route testing completed!');
}

// Run the test
testRoutes().catch(console.error); 