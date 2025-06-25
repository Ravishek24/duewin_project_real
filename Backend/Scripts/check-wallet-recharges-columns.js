const { sequelize } = require('../config/db');

const checkWalletRechargesColumns = async () => {
    try {
        console.log('🔍 Checking wallet_recharges table columns...');
        
        // Get table structure
        const [columns] = await sequelize.query("DESCRIBE wallet_recharges");
        
        console.log('\n📋 wallet_recharges table columns:');
        console.log('=====================================');
        
        columns.forEach(column => {
            console.log(`${column.Field} - ${column.Type} ${column.Null === 'YES' ? '(NULL)' : '(NOT NULL)'} ${column.Key === 'PRI' ? '(PRIMARY)' : ''}`);
        });
        
        // Check if order_id column exists
        const orderIdColumn = columns.find(col => col.Field === 'order_id');
        const transactionIdColumn = columns.find(col => col.Field === 'transaction_id');
        
        console.log('\n🔍 Order-related columns:');
        console.log('========================');
        console.log(`order_id exists: ${orderIdColumn ? '✅ YES' : '❌ NO'}`);
        console.log(`transaction_id exists: ${transactionIdColumn ? '✅ YES' : '❌ NO'}`);
        
        if (orderIdColumn) {
            console.log(`order_id type: ${orderIdColumn.Type}`);
        }
        
        if (transactionIdColumn) {
            console.log(`transaction_id type: ${transactionIdColumn.Type}`);
        }
        
        // Check for any other order-related columns
        const orderRelatedColumns = columns.filter(col => 
            col.Field.toLowerCase().includes('order') || 
            col.Field.toLowerCase().includes('id')
        );
        
        console.log('\n🔍 All ID/Order related columns:');
        console.log('================================');
        orderRelatedColumns.forEach(col => {
            console.log(`${col.Field} - ${col.Type}`);
        });
        
        // Check sample data
        console.log('\n📊 Sample data (first 3 records):');
        console.log('==================================');
        const [sampleData] = await sequelize.query("SELECT * FROM wallet_recharges LIMIT 3");
        
        if (sampleData.length > 0) {
            sampleData.forEach((record, index) => {
                console.log(`\nRecord ${index + 1}:`);
                Object.keys(record).forEach(key => {
                    console.log(`  ${key}: ${record[key]}`);
                });
            });
        } else {
            console.log('No records found in wallet_recharges table');
        }
        
    } catch (error) {
        console.error('❌ Error checking wallet_recharges columns:', error);
    } finally {
        await sequelize.close();
    }
};

// Run the check
checkWalletRechargesColumns(); 