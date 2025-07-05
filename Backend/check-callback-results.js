const { getModels } = require('./models');

async function checkCallbackResults() {
    console.log('🔍 Checking WowPay Callback Results');
    console.log('===================================');
    
    try {
        const models = await getModels();
        const { WalletRecharge, User } = models;
        
        if (!WalletRecharge) {
            console.log('❌ WalletRecharge model not available');
            return;
        }
        
        // Check recent WowPay transactions
        console.log('\n1. Recent WowPay Transactions:');
        console.log('------------------------------');
        
        const recentTransactions = await WalletRecharge.findAll({
            where: {
                order_id: {
                    [require('sequelize').Op.like]: '%TPOLY%'
                }
            },
            order: [['created_at', 'DESC']],
            limit: 10
        });
        
        if (recentTransactions.length === 0) {
            console.log('❌ No WowPay transactions found in database');
            console.log('💡 This suggests callbacks are not being processed or saved');
        } else {
            console.log(`✅ Found ${recentTransactions.length} WowPay transactions:`);
            console.log('');
            
            recentTransactions.forEach((tx, index) => {
                console.log(`${index + 1}. Order ID: ${tx.order_id}`);
                console.log(`   Transaction ID: ${tx.transaction_id}`);
                console.log(`   Amount: ${tx.amount}`);
                console.log(`   Status: ${tx.status}`);
                console.log(`   User ID: ${tx.user_id}`);
                console.log(`   Created: ${tx.created_at}`);
                console.log(`   Updated: ${tx.updated_at}`);
                console.log('   ---');
            });
        }
        
        // Check for your specific order
        console.log('\n2. Specific Order Check:');
        console.log('------------------------');
        
        const specificOrder = await WalletRecharge.findOne({
            where: {
                [require('sequelize').Op.or]: [
                    { order_id: { [require('sequelize').Op.like]: '%TPOLY2025062800013%' } },
                    { transaction_id: { [require('sequelize').Op.like]: '%TPOLY2025062800013%' } }
                ]
            }
        });
        
        if (specificOrder) {
            console.log('✅ Found your test order:');
            console.log('Order ID:', specificOrder.order_id);
            console.log('Transaction ID:', specificOrder.transaction_id);
            console.log('Status:', specificOrder.status);
            console.log('Amount:', specificOrder.amount);
            console.log('Created:', specificOrder.created_at);
            console.log('Updated:', specificOrder.updated_at);
            
            if (specificOrder.status === 'completed') {
                console.log('🎉 Payment completed successfully!');
                
                // Check if user wallet was updated
                if (User && specificOrder.user_id) {
                    const user = await User.findByPk(specificOrder.user_id);
                    if (user) {
                        console.log('User wallet balance:', user.wallet_balance);
                    }
                }
            } else if (specificOrder.status === 'pending') {
                console.log('⏳ Payment still pending - waiting for completion');
            } else {
                console.log(`⚠️ Payment status: ${specificOrder.status}`);
            }
        } else {
            console.log('❌ Your test order not found in database');
            console.log('💡 Check if the callback was processed correctly');
        }
        
        // Check for any failed transactions
        console.log('\n3. Failed/Timeout Transactions:');
        console.log('-------------------------------');
        
        const failedTransactions = await WalletRecharge.findAll({
            where: {
                status: ['failed', 'timeout', 'rejected']
            },
            order: [['created_at', 'DESC']],
            limit: 5
        });
        
        if (failedTransactions.length > 0) {
            console.log(`Found ${failedTransactions.length} failed transactions:`);
            failedTransactions.forEach((tx, index) => {
                console.log(`${index + 1}. ${tx.order_id} - Status: ${tx.status}`);
            });
        } else {
            console.log('✅ No failed transactions found');
        }
        
    } catch (error) {
        console.error('❌ Error checking callback results:', error);
    }
}

checkCallbackResults().catch(console.error); 