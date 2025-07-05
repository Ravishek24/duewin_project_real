// Check order status in database
require('dotenv').config();
const db = require('./config/db');
const { WalletRecharge, User } = require('./models');

async function checkOrderStatus() {
    console.log('🔍 Checking Order Status for PIPP175129961715113...\n');
    
    try {
        // Connect to database
        await db.connectDB();
        const sequelize = db.sequelize;
        
        // Check if order exists
        const order = await WalletRecharge.findOne({
            where: { order_id: 'PIPP175129961715113' },
            raw: true
        });
        
        if (order) {
            console.log('✅ Order found in database:');
            console.log('- Order ID:', order.order_id);
            console.log('- Status:', order.status);
            console.log('- Amount:', order.amount);
            console.log('- User ID:', order.user_id);
            console.log('- Created:', order.created_at);
            console.log('- Updated:', order.updated_at);
            
            // Check user wallet
            const user = await User.findByPk(order.user_id, { raw: true });
            if (user) {
                console.log('\n👤 User details:');
                console.log('- User ID:', user.user_id);
                console.log('- Username:', user.username);
                console.log('- Wallet Balance:', user.wallet_balance);
            }
            
            // Check if order was processed
            if (order.status === 'completed') {
                console.log('\n🎉 Order was successfully processed!');
                console.log('💰 User wallet should be credited with ₹', order.amount);
            } else if (order.status === 'pending') {
                console.log('\n⏳ Order is still pending');
                console.log('❓ This means the callback was received but not processed');
            } else if (order.status === 'failed') {
                console.log('\n❌ Order failed');
            }
            
        } else {
            console.log('❌ Order not found in database');
            
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
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error('Stack:', error.stack);
    } finally {
        if (db.sequelize) {
            await db.sequelize.close();
        }
    }
}

checkOrderStatus().then(() => {
    console.log('\n✅ Check completed');
    process.exit(0);
}).catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
}); 