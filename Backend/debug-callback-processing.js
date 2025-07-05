// Load environment variables and initialize database
require('dotenv').config();
const db = require('./config/db');
const { User, WalletRecharge } = require('./models');
const { processPpayProDepositCallback } = require('./services/ppayProService');

async function debugCallbackProcessing() {
    console.log('🔍 Debugging PPayPro Callback Processing...\n');
    
    try {
        // 1. Test database connection
        console.log('1️⃣ Testing database connection...');
        await db.connectDB();
        const sequelize = db.sequelize;
        console.log('✅ Database connection successful');
        
        // 2. Test model initialization
        console.log('\n2️⃣ Testing model initialization...');
        console.log('User model:', typeof User);
        console.log('WalletRecharge model:', typeof WalletRecharge);
        console.log('✅ Models initialized');
        
        // 3. Test callback data
        console.log('\n3️⃣ Testing callback data...');
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
        
        // 4. Test signature verification
        console.log('\n4️⃣ Testing signature verification...');
        const { generatePpayProSignature } = require('./services/ppayProService');
        const receivedSign = callbackData.sign;
        const calculatedSign = generatePpayProSignature(callbackData);
        console.log('Received signature:', receivedSign);
        console.log('Calculated signature:', calculatedSign);
        console.log('Signatures match:', receivedSign === calculatedSign ? '✅' : '❌');
        
        // 5. Test order lookup
        console.log('\n5️⃣ Testing order lookup...');
        const orderId = callbackData.mchOrderNo;
        console.log('Looking for order:', orderId);
        
        const order = await WalletRecharge.findOne({ 
            where: { order_id: orderId },
            raw: true // Get plain object
        });
        
        if (order) {
            console.log('✅ Order found:');
            console.log(JSON.stringify(order, null, 2));
        } else {
            console.log('❌ Order not found');
            
            // Let's check what orders exist
            console.log('\n🔍 Checking existing orders...');
            const allOrders = await WalletRecharge.findAll({
                where: { order_id: { [sequelize.Op.like]: 'PIPP%' } },
                limit: 5,
                raw: true
            });
            console.log('Recent PIPP orders:', allOrders.length);
            allOrders.forEach((o, i) => {
                console.log(`${i + 1}. ${o.order_id} - ${o.status} - ₹${o.amount}`);
            });
        }
        
        // 6. Test full callback processing
        console.log('\n6️⃣ Testing full callback processing...');
        const result = await processPpayProDepositCallback(callbackData);
        console.log('Processing result:', result);
        
        // 7. Check final order status
        if (order) {
            console.log('\n7️⃣ Checking final order status...');
            const updatedOrder = await WalletRecharge.findOne({ 
                where: { order_id: orderId },
                raw: true
            });
            console.log('Updated order:', JSON.stringify(updatedOrder, null, 2));
            
            // Check user wallet
            if (updatedOrder && updatedOrder.status === 'completed') {
                console.log('\n8️⃣ Checking user wallet...');
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
debugCallbackProcessing().then(() => {
    console.log('\n✅ Debug completed');
    process.exit(0);
}).catch((error) => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
}); 