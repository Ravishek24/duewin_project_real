// Backend/test-transaction-schema.js
const { getSequelizeInstance } = require('./config/db');

async function testTransactionSchema() {
    try {
        console.log('🔍 Testing Transaction table schema...');
        
        const sequelize = await getSequelizeInstance();
        
        // Check if Transaction table exists and get its structure
        const [results] = await sequelize.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'transactions'
            ORDER BY ORDINAL_POSITION
        `);
        
        console.log('📊 Transaction table structure:');
        results.forEach(col => {
            console.log(`  ${col.COLUMN_NAME}: ${col.COLUMN_TYPE} (${col.IS_NULLABLE === 'YES' ? 'nullable' : 'not null'}) - ${col.COLUMN_COMMENT || 'no comment'}`);
        });
        
        // Check the ENUM values for the 'type' column
        const [enumResults] = await sequelize.query(`
            SELECT COLUMN_TYPE
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'transactions'
            AND COLUMN_NAME = 'type'
        `);
        
        if (enumResults.length > 0) {
            console.log('\n🔍 Type column ENUM values:');
            console.log(`  ${enumResults[0].COLUMN_TYPE}`);
            
            // Check if 'self_rebate' is in the ENUM
            if (enumResults[0].COLUMN_TYPE.includes('self_rebate')) {
                console.log('✅ "self_rebate" type is supported in the database');
            } else {
                console.log('❌ "self_rebate" type is NOT supported in the database');
                console.log('⚠️  This explains why Transaction.create() is failing silently!');
            }
        }
        
        // Check if there are any existing self_rebate transactions
        const [existingRebates] = await sequelize.query(`
            SELECT COUNT(*) as count
            FROM transactions 
            WHERE type = 'self_rebate'
        `);
        
        console.log(`\n📊 Existing self_rebate transactions: ${existingRebates[0].count}`);
        
        // Check SelfRebate table
        const [selfRebateCount] = await sequelize.query(`
            SELECT COUNT(*) as count
            FROM self_rebates
        `);
        
        console.log(`📊 Total SelfRebate records: ${selfRebateCount[0].count}`);
        
        // Check recent SelfRebate records
        const [recentRebates] = await sequelize.query(`
            SELECT user_id, bet_amount, rebate_rate, rebate_amount, game_type, created_at
            FROM self_rebates
            ORDER BY created_at DESC
            LIMIT 5
        `);
        
        console.log('\n📊 Recent SelfRebate records:');
        recentRebates.forEach(rebate => {
            console.log(`  User ${rebate.user_id}: ${rebate.bet_amount} × ${rebate.rebate_rate} = ${rebate.rebate_amount} (${rebate.game_type}) - ${rebate.created_at}`);
        });
        
        await sequelize.close();
        
    } catch (error) {
        console.error('❌ Error testing Transaction schema:', error);
    }
}

// Run the test
testTransactionSchema();
