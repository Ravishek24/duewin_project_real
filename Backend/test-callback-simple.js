// Simple test for PPayPro callback processing
require('dotenv').config();

async function testCallback() {
    console.log('🧪 Testing PPayPro Callback Processing...\n');
    
    try {
        // Test 1: Check environment variables
        console.log('1️⃣ Environment Variables:');
        console.log('PPAYPRO_MCH_NO:', process.env.PPAYPRO_MCH_NO ? 'SET' : 'NOT SET');
        console.log('PPAYPRO_APP_ID:', process.env.PPAYPRO_APP_ID ? 'SET' : 'NOT SET');
        console.log('PPAYPRO_KEY:', process.env.PPAYPRO_KEY ? 'SET' : 'NOT SET');
        
        // Test 2: Check signature generation
        console.log('\n2️⃣ Testing signature generation...');
        const { generatePpayProSignature } = require('./services/ppayProService');
        
        const callbackData = {
            payOrderId: 'P1939717303078371329',
            mchOrderNo: 'PIPP175129961715113',
            amount: '100000',
            state: '2',
            currency: 'INR',
            createdAt: '1751299618097',
            successTime: '1751299618097'
        };
        
        const signature = generatePpayProSignature(callbackData);
        console.log('Generated signature:', signature);
        console.log('Expected signature: E1420259C03173B51C0F8869ACE0F5C7');
        console.log('Match:', signature === 'E1420259C03173B51C0F8869ACE0F5C7' ? '✅' : '❌');
        
        // Test 3: Check if order exists in database
        console.log('\n3️⃣ Testing database connection...');
        const db = require('./config/db');
        await db.connectDB();
        console.log('✅ Database connected');
        
        // Test 4: Check models
        console.log('\n4️⃣ Testing models...');
        const { User, WalletRecharge } = require('./models');
        console.log('User model:', typeof User);
        console.log('WalletRecharge model:', typeof WalletRecharge);
        
        // Test 5: Look for the specific order
        console.log('\n5️⃣ Looking for order PIPP175129961715113...');
        const order = await WalletRecharge.findOne({ 
            where: { order_id: 'PIPP175129961715113' },
            raw: true
        });
        
        if (order) {
            console.log('✅ Order found:');
            console.log('- Order ID:', order.order_id);
            console.log('- Status:', order.status);
            console.log('- Amount:', order.amount);
            console.log('- User ID:', order.user_id);
        } else {
            console.log('❌ Order not found');
            
            // Check for any PIPP orders
            const allPippOrders = await WalletRecharge.findAll({
                where: { order_id: { [db.Op.like]: 'PIPP%' } },
                limit: 3,
                raw: true
            });
            console.log('Found PIPP orders:', allPippOrders.length);
            allPippOrders.forEach((o, i) => {
                console.log(`${i + 1}. ${o.order_id} - ${o.status} - ₹${o.amount}`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        if (typeof db !== 'undefined' && db.sequelize) {
            await db.sequelize.close();
        }
    }
}

testCallback().then(() => {
    console.log('\n✅ Test completed');
    process.exit(0);
}).catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
}); 