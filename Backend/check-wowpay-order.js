const { Sequelize } = require('sequelize');
require('dotenv').config();

console.log('🔍 Checking WowPay Order in Database');
console.log('====================================');

// Database configuration - using correct env variable names
const sequelize = new Sequelize(
    process.env.DB_NAME || 'duewin_db',
    process.env.DB_USER || 'root',
    process.env.DB_PASS || '',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: false
    }
);

// Order ID from the callback
const orderId = 'PIWO175112611525513';

async function checkOrder() {
    try {
        console.log('🔗 Connecting to database...');
        console.log('Database Config:', {
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 3306,
            database: process.env.DB_NAME || 'duewin_db',
            user: process.env.DB_USER || 'root',
            hasPassword: !!process.env.DB_PASS
        });
        
        await sequelize.authenticate();
        console.log('✅ Database connected successfully');
        
        console.log('\n🔍 Searching for order:', orderId);
        
        // Check in wallet_recharges table
        const [rechargeResults] = await sequelize.query(`
            SELECT * FROM wallet_recharges 
            WHERE order_id = :orderId
        `, {
            replacements: { orderId },
            type: Sequelize.QueryTypes.SELECT
        });
        
        console.log('\n💰 Wallet Recharges:');
        if (rechargeResults.length > 0) {
            rechargeResults.forEach((order, index) => {
                console.log(`\n${index + 1}. Order Details:`);
                console.log(`   ID: ${order.id}`);
                console.log(`   User ID: ${order.user_id}`);
                console.log(`   Amount: ${order.amount}`);
                console.log(`   Status: ${order.status}`);
                console.log(`   Created: ${order.created_at}`);
                console.log(`   Updated: ${order.updated_at}`);
                console.log(`   Payment Gateway ID: ${order.payment_gateway_id}`);
            });
        } else {
            console.log('❌ No wallet recharge found with this order ID');
        }
        
        // Check in transactions table
        const [transactionResults] = await sequelize.query(`
            SELECT * FROM transactions 
            WHERE reference_id = :orderId OR order_id = :orderId
        `, {
            replacements: { orderId },
            type: Sequelize.QueryTypes.SELECT
        });
        
        console.log('\n💳 Transactions:');
        if (transactionResults.length > 0) {
            transactionResults.forEach((txn, index) => {
                console.log(`\n${index + 1}. Transaction Details:`);
                console.log(`   ID: ${txn.id}`);
                console.log(`   Type: ${txn.type}`);
                console.log(`   Amount: ${txn.amount}`);
                console.log(`   Status: ${txn.status}`);
                console.log(`   Reference ID: ${txn.reference_id}`);
                console.log(`   Order ID: ${txn.order_id}`);
                console.log(`   Created: ${txn.created_at}`);
            });
        } else {
            console.log('❌ No transactions found with this order ID');
        }
        
        // Check in seamless_transactions table
        const [seamlessResults] = await sequelize.query(`
            SELECT * FROM seamless_transactions 
            WHERE order_id = :orderId OR external_order_id = :orderId
        `, {
            replacements: { orderId },
            type: Sequelize.QueryTypes.SELECT
        });
        
        console.log('\n🔄 Seamless Transactions:');
        if (seamlessResults.length > 0) {
            seamlessResults.forEach((txn, index) => {
                console.log(`\n${index + 1}. Seamless Transaction Details:`);
                console.log(`   ID: ${txn.id}`);
                console.log(`   Order ID: ${txn.order_id}`);
                console.log(`   External Order ID: ${txn.external_order_id}`);
                console.log(`   Amount: ${txn.amount}`);
                console.log(`   Status: ${txn.status}`);
                console.log(`   Created: ${txn.created_at}`);
            });
        } else {
            console.log('❌ No seamless transactions found with this order ID');
        }
        
        // Check in spribe_transactions table
        const [spribeResults] = await sequelize.query(`
            SELECT * FROM spribe_transactions 
            WHERE order_id = :orderId OR external_order_id = :orderId
        `, {
            replacements: { orderId },
            type: Sequelize.QueryTypes.SELECT
        });
        
        console.log('\n🎮 Spribe Transactions:');
        if (spribeResults.length > 0) {
            spribeResults.forEach((txn, index) => {
                console.log(`\n${index + 1}. Spribe Transaction Details:`);
                console.log(`   ID: ${txn.id}`);
                console.log(`   Order ID: ${txn.order_id}`);
                console.log(`   External Order ID: ${txn.external_order_id}`);
                console.log(`   Amount: ${txn.amount}`);
                console.log(`   Status: ${txn.status}`);
                console.log(`   Created: ${txn.created_at}`);
            });
        } else {
            console.log('❌ No spribe transactions found with this order ID');
        }
        
        console.log('\n📊 Summary:');
        console.log('===========');
        console.log(`Order ID: ${orderId}`);
        console.log(`Wallet Recharges: ${rechargeResults.length}`);
        console.log(`Transactions: ${transactionResults.length}`);
        console.log(`Seamless Transactions: ${seamlessResults.length}`);
        console.log(`Spribe Transactions: ${spribeResults.length}`);
        
        if (rechargeResults.length === 0 && transactionResults.length === 0 && 
            seamlessResults.length === 0 && spribeResults.length === 0) {
            console.log('\n⚠️  WARNING: Order not found in any table!');
            console.log('This could mean:');
            console.log('1. The order was never created in your system');
            console.log('2. The order ID format is different');
            console.log('3. The order is in a different table');
            console.log('4. This is a test/duplicate callback');
        }
        
    } catch (error) {
        console.error('❌ Database error:', error.message);
        console.log('\n💡 Troubleshooting:');
        console.log('1. Check if database is running');
        console.log('2. Verify environment variables are set correctly');
        console.log('3. Check database credentials');
        console.log('4. Ensure database exists');
    } finally {
        await sequelize.close();
        console.log('\n🔌 Database connection closed');
    }
}

checkOrder().catch(console.error); 