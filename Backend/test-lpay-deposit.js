// Test L Pay deposit creation
require('dotenv').config();
const { createLPayCollectionOrder } = require('./services/lPayService');

async function testLPayDeposit() {
    console.log('🧪 Testing L Pay Deposit Creation...\n');
    
    try {
        // Test parameters
        const userId = 13; // Replace with actual user ID
        const orderId = `LPAY${Date.now()}${userId}`;
        const amount = 500; // ₹500
        const notifyUrl = 'https://api.strikecolor1.com/api/payments/lpay/payin-callback';
        const gatewayId = 8; // Replace with actual L Pay gateway ID
        
        console.log('📋 Test Parameters:');
        console.log('- User ID:', userId);
        console.log('- Order ID:', orderId);
        console.log('- Amount: ₹', amount);
        console.log('- Callback URL:', notifyUrl);
        console.log('- Gateway ID:', gatewayId);
        console.log('');
        
        // Create deposit order
        const result = await createLPayCollectionOrder(userId, orderId, amount, notifyUrl, gatewayId);
        
        if (result.success) {
            console.log('✅ L Pay deposit order created successfully!');
            console.log('Payment URL:', result.paymentUrl);
            console.log('Transaction ID:', result.transactionId);
            console.log('Order ID:', result.orderId);
        } else {
            console.log('❌ Failed to create L Pay deposit order:');
            console.log('Error:', result.message);
            if (result.errorCode) {
                console.log('Error Code:', result.errorCode);
            }
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test
testLPayDeposit().then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
}).catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
}); 