// Test script for 101pay UTR deposit functionality
const axios = require('axios');

// Configuration
const API_BASE_URL = 'https://api.strikecolor1.com'; // Replace with your API URL
const TEST_TOKEN = 'your_test_token_here'; // Replace with actual test token

// Test UTR Deposit
async function testUTRDeposit() {
    try {
        console.log('🧪 Testing 101pay UTR Deposit...\n');
        
        const payload = {
            amount: 1000,
            utr: "UTR123456789", // Replace with actual UTR number
            channel: "qq00099"   // Replace with your valid channel code
        };
        
        console.log('📤 Sending UTR deposit request...');
        console.log('Payload:', JSON.stringify(payload, null, 2));
        
        const response = await axios.post(`${API_BASE_URL}/api/payments/utr-deposit`, payload, {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('\n✅ UTR Deposit Response:');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('\n❌ UTR Deposit Error:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Test Standard Deposit (for comparison)
async function testStandardDeposit() {
    try {
        console.log('\n🧪 Testing 101pay Standard Deposit...\n');
        
        const payload = {
            amount: 1000,
            gateway: "101PAY",
            channel: "qq00099",
            pay_type: "UPI"
        };
        
        console.log('📤 Sending standard deposit request...');
        console.log('Payload:', JSON.stringify(payload, null, 2));
        
        const response = await axios.post(`${API_BASE_URL}/api/payments/payin`, payload, {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        
        console.log('\n✅ Standard Deposit Response:');
        console.log('Status:', response.status);
        console.log('Data:', JSON.stringify(response.data, null, 2));
        
    } catch (error) {
        console.error('\n❌ Standard Deposit Error:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Test Query UTR (using 101pay service directly)
async function testQueryUTR() {
    try {
        console.log('\n🧪 Testing 101pay UTR Query...\n');
        
        const { queryDepositByUTR } = require('./services/pay101Service');
        
        const utr = "UTR123456789"; // Replace with actual UTR number
        
        console.log('📤 Querying UTR:', utr);
        
        const result = await queryDepositByUTR({ utr });
        
        console.log('\n✅ UTR Query Response:');
        console.log('Success:', result.success);
        console.log('Data:', JSON.stringify(result.data, null, 2));
        
    } catch (error) {
        console.error('\n❌ UTR Query Error:');
        console.error('Error:', error.message);
    }
}

// Main test function
async function runTests() {
    console.log('🚀 Starting 101pay Payment Methods Tests\n');
    console.log('=' .repeat(50));
    
    // Test standard deposit first
    await testStandardDeposit();
    
    console.log('\n' + '=' .repeat(50));
    
    // Test UTR query
    await testQueryUTR();
    
    console.log('\n' + '=' .repeat(50));
    
    // Test UTR deposit
    await testUTRDeposit();
    
    console.log('\n' + '=' .repeat(50));
    console.log('✅ All tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().catch(console.error);
}

module.exports = {
    testUTRDeposit,
    testStandardDeposit,
    testQueryUTR
}; 