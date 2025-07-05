const axios = require('axios');
const crypto = require('crypto');

// PPayPro Configuration (replace with your actual values)
const ppayProConfig = {
    mchNo: 'your_merchant_number', // From PPayPro dashboard
    appId: 'your_app_id', // From PPayPro dashboard
    key: 'your_private_key', // From PPayPro dashboard
    host: 'https://pay.ppaypros.com'
};

// Generate PPayPro signature
function generatePpayProSignature(params, privateKey = ppayProConfig.key) {
    // 1. Filter out undefined/null/empty values and 'sign' key
    const filtered = Object.entries(params)
        .filter(([k, v]) => v !== undefined && v !== null && v !== '' && k !== 'sign')
        .reduce((acc, [k, v]) => { acc[k] = v; return acc; }, {});
    
    // 2. Sort keys by ASCII order
    const sortedKeys = Object.keys(filtered).sort();
    
    // 3. Join as key=value&key=value
    const joined = sortedKeys.map(key => `${key}=${filtered[key]}`).join('&');
    
    // 4. Append &key=PRIVATE_KEY
    const stringToSign = `${joined}&key=${privateKey}`;
    
    // 5. MD5 hash, uppercase
    return crypto.createHash('md5').update(stringToSign).digest('hex').toUpperCase();
}

// Step 1: Create a deposit order with PPayPro
async function createDepositOrder() {
    console.log('🚀 Step 1: Creating Deposit Order with PPayPro...\n');
    
    // Your order details
    const userId = 123;
    const amountRupees = 100; // 100 rupees
    const amountPaisa = amountRupees * 100; // Convert to paisa
    const orderId = `ORDER_${Date.now()}_${userId}`; // Your order ID
    
    // PPayPro deposit request payload
    const depositPayload = {
        mchNo: ppayProConfig.mchNo,
        appId: ppayProConfig.appId,
        mchOrderNo: orderId, // Your order ID
        amount: amountPaisa, // Amount in paisa
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        customerPhone: '9876543210',
        wayCode: 'UPI', // Payment method
        notifyUrl: 'https://api.strikecolor1.com/api/payments/ppaypro/payin-callback',
        returnUrl: 'https://yourwebsite.com/payment-success'
    };
    
    // Generate signature
    depositPayload.sign = generatePpayProSignature(depositPayload);
    
    console.log('📤 Deposit Request Payload:');
    console.log(JSON.stringify(depositPayload, null, 2));
    
    try {
        // Call PPayPro API to create order
        const response = await axios.post(`${ppayProConfig.host}/api/pay/pay`, depositPayload, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        console.log('✅ PPayPro Response:');
        console.log(JSON.stringify(response.data, null, 2));
        
        if (response.data && response.data.code === 0 && response.data.data) {
            const payOrderId = response.data.data.payOrderId; // PPayPro's order ID
            console.log(`\n🎯 Key Information:`);
            console.log(`- Your Order ID (mchOrderNo): ${orderId}`);
            console.log(`- PPayPro Order ID (payOrderId): ${payOrderId}`);
            console.log(`- Amount (paisa): ${amountPaisa}`);
            console.log(`- Payment URL: ${response.data.data.payData}`);
            
            return {
                mchOrderNo: orderId,
                payOrderId: payOrderId,
                amount: amountPaisa,
                amountRupees: amountRupees
            };
        } else {
            console.error('❌ Failed to create order:', response.data);
            return null;
        }
        
    } catch (error) {
        console.error('❌ Error creating order:', error.response?.data || error.message);
        return null;
    }
}

// Step 2: Simulate PPayPro callback (what PPayPro sends to your server)
async function simulatePPayProCallback(orderDetails) {
    console.log('\n🔄 Step 2: Simulating PPayPro Callback...\n');
    
    if (!orderDetails) {
        console.log('❌ No order details available for callback');
        return;
    }
    
    // This is what PPayPro sends to your callback URL
    const callbackData = {
        payOrderId: orderDetails.payOrderId, // PPayPro's order ID
        mchOrderNo: orderDetails.mchOrderNo, // Your order ID
        amount: orderDetails.amount.toString(), // Amount in paisa
        state: '2', // 2 = Success, 3 = Failed
        currency: 'INR',
        createdAt: Date.now(),
        successTime: Date.now()
    };
    
    // Generate signature for callback
    callbackData.sign = generatePpayProSignature(callbackData);
    
    console.log('📥 PPayPro Callback Payload (what PPayPro sends):');
    console.log(JSON.stringify(callbackData, null, 2));
    
    console.log('\n📋 Callback Details Breakdown:');
    console.log(`- payOrderId: ${callbackData.payOrderId} (from PPayPro response)`);
    console.log(`- mchOrderNo: ${callbackData.mchOrderNo} (your order ID)`);
    console.log(`- amount: ${callbackData.amount} (in paisa)`);
    console.log(`- state: ${callbackData.state} (2=Success, 3=Failed)`);
    console.log(`- currency: ${callbackData.currency}`);
    console.log(`- sign: ${callbackData.sign} (MD5 signature)`);
    
    // Send callback to your server
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
        
    } catch (error) {
        console.error('\n❌ Callback Error:', error.response?.status, error.response?.data);
    }
}

// Step 3: Manual callback creation (for testing)
function createManualCallback() {
    console.log('\n🛠️ Step 3: Manual Callback Creation (for testing)...\n');
    
    // Example values (replace with your actual data)
    const manualCallback = {
        payOrderId: 'PPAY123456789', // From PPayPro response
        mchOrderNo: 'ORDER_1751299000000_123', // Your order ID
        amount: '10000', // 100 rupees in paisa
        state: '2', // Success
        currency: 'INR'
    };
    
    // Generate signature
    manualCallback.sign = generatePpayProSignature(manualCallback);
    
    console.log('📝 Manual Callback Payload:');
    console.log(JSON.stringify(manualCallback, null, 2));
    
    console.log('\n📋 How to get each field:');
    console.log('1. payOrderId: Get from PPayPro API response when creating order');
    console.log('2. mchOrderNo: Your own order ID (generate when creating order)');
    console.log('3. amount: Convert rupees to paisa (₹100 = 10000 paisa)');
    console.log('4. state: 2=Success, 3=Failed (from PPayPro)');
    console.log('5. currency: Usually INR for India');
    console.log('6. sign: MD5 hash of all fields + your private key');
    
    return manualCallback;
}

// Main function
async function runCompleteExample() {
    console.log('🚀 PPayPro Complete Example\n');
    console.log('This example shows the complete flow:\n');
    console.log('1. Create deposit order with PPayPro');
    console.log('2. Get payOrderId from PPayPro response');
    console.log('3. Simulate callback with proper details');
    console.log('4. Manual callback creation for testing\n');
    
    // Step 1: Create order (comment out if you don\'t have real credentials)
    // const orderDetails = await createDepositOrder();
    
    // Step 2: Simulate callback (comment out if no order details)
    // await simulatePPayProCallback(orderDetails);
    
    // Step 3: Manual callback for testing
    const manualCallback = createManualCallback();
    
    console.log('\n✅ Example completed!');
    console.log('\n📝 To use with real data:');
    console.log('1. Replace config values with your actual PPayPro credentials');
    console.log('2. Uncomment the createDepositOrder() call');
    console.log('3. Use the returned payOrderId in your callbacks');
}

// Run if called directly
if (require.main === module) {
    runCompleteExample().catch(console.error);
}

module.exports = {
    generatePpayProSignature,
    createDepositOrder,
    simulatePPayProCallback,
    createManualCallback
}; 