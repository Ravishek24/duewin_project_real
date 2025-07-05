const { initializeModels } = require('./models');
const { getSequelizeInstance } = require('./config/db');

// Check callback processing result
async function checkCallbackResult() {
    console.log('🔍 Checking PPayPro Callback Processing Result...\n');
    
    const orderId = 'PIPP175129961715113';
    const payOrderId = 'P1939717303078371329';
    
    try {
        // Initialize database and models
        console.log('🔄 Initializing database and models...');
        const sequelize = await getSequelizeInstance();
        const models = await initializeModels();
        
        const { WalletRecharge, User } = models;
        
        console.log('✅ Database and models initialized successfully\n');
        
        console.log('📋 Checking Order Details...');
        console.log(`- Order ID: ${orderId}`);
        console.log(`- PPayPro Order ID: ${payOrderId}\n`);
        
        // Find the order in database
        const order = await WalletRecharge.findOne({ 
            where: { order_id: orderId } 
        });
        
        if (!order) {
            console.log('❌ Order not found in database');
            console.log('This could mean:');
            console.log('1. Order was not created properly');
            console.log('2. Database connection issue');
            console.log('3. Order ID mismatch');
            return;
        }
        
        console.log('✅ Order found in database:');
        console.log(`  - Order ID: ${order.order_id}`);
        console.log(`  - Transaction ID: ${order.transaction_id}`);
        console.log(`  - User ID: ${order.user_id}`);
        console.log(`  - Amount: ₹${order.amount}`);
        console.log(`  - Payment Gateway ID: ${order.payment_gateway_id}`);
        console.log(`  - Status: ${order.status}`);
        console.log(`  - Created: ${order.created_at}`);
        console.log(`  - Updated: ${order.updated_at}`);
        
        // Check user wallet
        const user = await User.findByPk(order.user_id);
        if (user) {
            console.log('\n💰 User Wallet Details:');
            console.log(`  - User ID: ${user.user_id}`);
            console.log(`  - Username: ${user.user_name}`);
            console.log(`  - Current Balance: ₹${user.wallet_balance}`);
            console.log(`  - Phone: ${user.phone}`);
        } else {
            console.log('\n❌ User not found');
        }
        
        // Analyze the results
        console.log('\n📊 Callback Processing Analysis:');
        console.log('='.repeat(50));
        
        if (order.status === 'completed') {
            console.log('✅ SUCCESS: Order status is "completed"');
            console.log('✅ SUCCESS: Callback was processed successfully');
            console.log('✅ SUCCESS: User wallet should be credited');
            
            if (user) {
                const expectedBalance = parseFloat(user.wallet_balance);
                const orderAmount = parseFloat(order.amount);
                console.log(`💰 Expected wallet balance: ₹${expectedBalance}`);
                console.log(`💰 Order amount: ₹${orderAmount}`);
                
                if (expectedBalance >= orderAmount) {
                    console.log('✅ SUCCESS: Wallet balance looks correct');
                } else {
                    console.log('⚠️ WARNING: Wallet balance might not be updated');
                }
            }
            
        } else if (order.status === 'pending') {
            console.log('⚠️ WARNING: Order status is still "pending"');
            console.log('This could mean:');
            console.log('1. Callback signature verification failed');
            console.log('2. Callback processing error');
            console.log('3. Database update failed');
            
        } else if (order.status === 'failed') {
            console.log('❌ FAILED: Order status is "failed"');
            console.log('This means the callback indicated a failed payment');
            
        } else {
            console.log(`⚠️ UNKNOWN: Order status is "${order.status}"`);
        }
        
        // Check recent orders for this user
        console.log('\n📋 Recent Orders for User:');
        const recentOrders = await WalletRecharge.findAll({
            where: { user_id: order.user_id },
            order: [['created_at', 'DESC']],
            limit: 5
        });
        
        recentOrders.forEach((recentOrder, index) => {
            console.log(`  ${index + 1}. ${recentOrder.order_id} - ₹${recentOrder.amount} - ${recentOrder.status}`);
        });
        
    } catch (error) {
        console.error('❌ Error checking callback result:', error.message);
        console.error('Stack trace:', error.stack);
    }
}

// Check all PPayPro orders
async function checkAllPPayProOrders() {
    console.log('\n📋 Checking All PPayPro Orders...\n');
    
    try {
        const { WalletRecharge } = await initializeModels();
        
        const orders = await WalletRecharge.findAll({
            where: { payment_gateway_id: 7 }, // Fixed: using correct column name
            order: [['created_at', 'DESC']],
            limit: 10
        });
        
        console.log(`Found ${orders.length} PPayPro orders:\n`);
        
        orders.forEach((order, index) => {
            console.log(`${index + 1}. Order: ${order.order_id}`);
            console.log(`   - Amount: ₹${order.amount}`);
            console.log(`   - Status: ${order.status}`);
            console.log(`   - Payment Gateway ID: ${order.payment_gateway_id}`);
            console.log(`   - Created: ${order.created_at}`);
            console.log(`   - Updated: ${order.updated_at}`);
            console.log('');
        });
        
    } catch (error) {
        console.error('❌ Error checking PPayPro orders:', error.message);
    }
}

// Main function
async function main() {
    console.log('🚀 PPayPro Callback Result Checker\n');
    
    await checkCallbackResult();
    await checkAllPPayProOrders();
    
    console.log('\n✅ Analysis completed!');
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    checkCallbackResult,
    checkAllPPayProOrders
}; 