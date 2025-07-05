// Test script for 101pay callbacks
const axios = require('axios');

// Configuration
const API_BASE_URL = 'https://api.strikecolor1.com'; // Replace with your API URL

// Note: Callbacks don't require authentication tokens
// They are called by 101pay servers directly

// Test successful payment callback
async function testSuccessfulCallback() {
    try {
        console.log('🧪 Testing 101pay Successful Payment Callback...\n');
        
        const callbackPayload = {
            merchantOrderNo: "PI10175139101341413",
            orderNo: "C2025070123001381682979",
            currency: "inr",
            amount: 1000,
            status: "success",
            fee: 48,
            proof: "payment_proof_12345",
            upi: "upi@testbank",
            createdTime: "2025-07-01T17:26:27.000Z",
            updatedTime: "2025-07-01T17:30:00.000Z"
        };
        
        console.log('📤 Sending successful callback...');
        console.log('Payload:', JSON.stringify(callbackPayload, null, 2));
        
        const response = await axios.post(`${API_BASE_URL}/api/payments/101pay/payin-callback`, callbackPayload, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('\n✅ Callback Response:');
        console.log('Status:', response.status);
        console.log('Response:', response.data);
        
    } catch (error) {
        console.error('\n❌ Callback Error:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Test failed payment callback
async function testFailedCallback() {
    try {
        console.log('\n🧪 Testing 101pay Failed Payment Callback...\n');
        
        const callbackPayload = {
            merchantOrderNo: "PI10175138917646813",
            orderNo: "C2025070122293680827322",
            currency: "inr",
            amount: 1000,
            status: "failure",
            fee: 0,
            createdTime: "2025-07-01T16:51:51.000Z",
            updatedTime: "2025-07-01T16:52:30.000Z"
        };
        
        console.log('📤 Sending failed callback...');
        console.log('Payload:', JSON.stringify(callbackPayload, null, 2));
        
        const response = await axios.post(`${API_BASE_URL}/api/payments/101pay/payin-callback`, callbackPayload, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('\n✅ Callback Response:');
        console.log('Status:', response.status);
        console.log('Response:', response.data);
        
    } catch (error) {
        console.error('\n❌ Callback Error:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Test pending payment callback
async function testPendingCallback() {
    try {
        console.log('\n🧪 Testing 101pay Pending Payment Callback...\n');
        
        const callbackPayload = {
            merchantOrderNo: "PI10175138917646813",
            orderNo: "C2025070122293680827322",
            currency: "inr",
            amount: 1000,
            status: "pending",
            fee: 0,
            createdTime: "2025-07-01T16:51:51.000Z",
            updatedTime: "2025-07-01T16:52:30.000Z"
        };
        
        console.log('📤 Sending pending callback...');
        console.log('Payload:', JSON.stringify(callbackPayload, null, 2));
        
        const response = await axios.post(`${API_BASE_URL}/api/payments/101pay/payin-callback`, callbackPayload, {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('\n✅ Callback Response:');
        console.log('Status:', response.status);
        console.log('Response:', response.data);
        
    } catch (error) {
        console.error('\n❌ Callback Error:');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Error:', error.message);
        }
    }
}

// Main test function
async function runCallbackTests() {
    console.log('🚀 Starting 101pay Callback Tests\n');
    console.log('=' .repeat(50));
    
    // Test successful callback
    await testSuccessfulCallback();
    
    console.log('\n' + '=' .repeat(50));
    
    // Test failed callback
    await testFailedCallback();
    
    console.log('\n' + '=' .repeat(50));
    
    // Test pending callback
    await testPendingCallback();
    
    console.log('\n' + '=' .repeat(50));
    console.log('✅ All callback tests completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
    runCallbackTests().catch(console.error);
}

module.exports = {
    testSuccessfulCallback,
    testFailedCallback,
    testPendingCallback
}; 