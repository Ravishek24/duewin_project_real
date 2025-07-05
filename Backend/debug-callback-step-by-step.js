// Debug PPayPro callback processing step by step
require('dotenv').config();
const db = require('./config/db');
const models = require('./models');

async function debugCallbackStepByStep() {
    console.log('🔍 Debugging PPayPro Callback Processing Step by Step...\n');
    
    try {
        // Step 1: Connect to database and initialize models
        console.log('1️⃣ Connecting to database and initializing models...');
        await db.connectDB();
        await models.initializeModels();
        const sequelize = db.sequelize;
        const { WalletRecharge, User } = models;
        console.log('✅ Database connected and models initialized');
        
        // Step 2: Test callback data
        console.log('\n2️⃣ Testing callback data...');
        const callbackData = {
            payOrderId: 'P1939717303078371329',
            mchOrderNo: 'PIPP175129961715113',
            amount: '100000',
            state: '2',
            currency: 'INR',
            createdAt: '1751299618097',
            successTime: '1751299618097',
            sign: 'E1420259C03173B51C0F8869ACE0F5C7'
        };
        console.log('Callback data:', JSON.stringify(callbackData, null, 2));
        
        // Step 3: Test signature verification
        console.log('\n3️⃣ Testing signature verification...');
        const { generatePpayProSignature } = require('./services/ppayProService');
        const receivedSign = callbackData.sign;
        const calculatedSign = generatePpayProSignature(callbackData);
        console.log('Received signature:', receivedSign);
        console.log('Calculated signature:', calculatedSign);
        console.log('Signatures match:', receivedSign === calculatedSign ? '✅' : '❌');
        
        if (receivedSign !== calculatedSign) {
            console.log('❌ Signature verification failed - this would cause callback to fail');
            return;
        }
        
        // Step 4: Test order lookup
        console.log('\n4️⃣ Testing order lookup...');
        const orderId = callbackData.mchOrderNo;
        console.log('Looking for order:', orderId);
        
        const order = await WalletRecharge.findOne({ 
            where: { order_id: orderId },
            raw: true
        });
        
        if (order) {
            console.log('✅ Order found:');
            console.log('- Order ID:', order.order_id);
            console.log('- Status:', order.status);
            console.log('- Amount:', order.amount);
            console.log('- User ID:', order.user_id);
            console.log('- Created:', order.created_at);
            console.log('- Updated:', order.updated_at);
        } else {
            console.log('❌ Order not found - this would cause callback to fail');
            console.log('This explains why the callback returns "fail"');
            
            // Check for similar orders
            console.log('\n🔍 Checking for similar orders...');
            const similarOrders = await WalletRecharge.findAll({
                where: { order_id: { [sequelize.Op.like]: 'PIPP%' } },
                limit: 5,
                raw: true,
                order: [['created_at', 'DESC']]
            });
            
            console.log('Recent PIPP orders:', similarOrders.length);
            similarOrders.forEach((o, i) => {
                console.log(`${i + 1}. ${o.order_id} - ${o.status} - ₹${o.amount} - ${o.created_at}`);
            });
            
            return;
        }
        
        // Step 5: Test callback processing
        console.log('\n5️⃣ Testing callback processing...');
        const { processPpayProDepositCallback } = require('./services/ppayProService');
        const result = await processPpayProDepositCallback(callbackData);
        console.log('Processing result:', result);
        
        if (result.success) {
            console.log('✅ Callback processing successful');
        } else {
            console.log('❌ Callback processing failed:', result.message);
        }
        
        // Step 6: Check final order status
        console.log('\n6️⃣ Checking final order status...');
        const updatedOrder = await WalletRecharge.findOne({ 
            where: { order_id: orderId },
            raw: true
        });
        
        if (updatedOrder) {
            console.log('Updated order status:', updatedOrder.status);
            console.log('Updated at:', updatedOrder.updated_at);
            
            // Check user wallet if completed
            if (updatedOrder.status === 'completed') {
                console.log('\n7️⃣ Checking user wallet...');
                const user = await User.findByPk(updatedOrder.user_id, { raw: true });
                if (user) {
                    console.log('User wallet balance:', user.wallet_balance);
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error during debugging:', error);
        console.error('Stack trace:', error.stack);
    } finally {
        if (db.sequelize) {
            await db.sequelize.close();
        }
    }
}

// Run the debug function
debugCallbackStepByStep().then(() => {
    console.log('\n✅ Debug completed');
    process.exit(0);
}).catch((error) => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
}); 