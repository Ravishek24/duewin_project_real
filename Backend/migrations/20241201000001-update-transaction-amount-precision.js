// Backend/migrations/20241201000001-update-transaction-amount-precision.js
const { getSequelizeInstance } = require('../config/db');

async function updateTransactionAmountPrecision() {
    try {
        console.log('🔧 Updating Transaction table amount column precision...');
        
        const sequelize = await getSequelizeInstance();
        
        // Check current column definition
        const [currentColumn] = await sequelize.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'transactions'
            AND COLUMN_NAME = 'amount'
        `);
        
        if (currentColumn.length > 0) {
            const column = currentColumn[0];
            console.log(`📊 Current amount column: ${column.COLUMN_TYPE} (precision: ${column.NUMERIC_PRECISION}, scale: ${column.NUMERIC_SCALE})`);
            
            // Check if we need to update
            if (column.NUMERIC_SCALE < 5) {
                console.log('🔄 Updating amount column to support 5 decimal places...');
                
                // Update the amount column to DECIMAL(15,5) to handle very small amounts
                await sequelize.query(`
                    ALTER TABLE transactions 
                    MODIFY COLUMN amount DECIMAL(15,5) NOT NULL COMMENT 'Transaction amount with 5 decimal precision'
                `);
                
                console.log('✅ Transaction amount column updated successfully!');
                
                // Verify the change
                const [updatedColumn] = await sequelize.query(`
                    SELECT COLUMN_NAME, COLUMN_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'transactions'
                    AND COLUMN_NAME = 'amount'
                `);
                
                if (updatedColumn.length > 0) {
                    const newColumn = updatedColumn[0];
                    console.log(`📊 Updated amount column: ${newColumn.COLUMN_TYPE} (precision: ${newColumn.NUMERIC_PRECISION}, scale: ${newColumn.NUMERIC_SCALE})`);
                }
                
            } else {
                console.log('✅ Amount column already supports 5 decimal places');
            }
        }
        
        // Also check and update previous_balance and new_balance columns if needed
        const [balanceColumns] = await sequelize.query(`
            SELECT COLUMN_NAME, COLUMN_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'transactions'
            AND COLUMN_NAME IN ('previous_balance', 'new_balance')
            ORDER BY COLUMN_NAME
        `);
        
        console.log('\n📊 Balance columns status:');
        for (const column of balanceColumns) {
            console.log(`  ${column.COLUMN_NAME}: ${column.COLUMN_TYPE} (precision: ${column.NUMERIC_PRECISION}, scale: ${column.NUMERIC_SCALE})`);
            
            if (column.NUMERIC_SCALE < 5) {
                console.log(`🔄 Updating ${column.COLUMN_NAME} column...`);
                await sequelize.query(`
                    ALTER TABLE transactions 
                    MODIFY COLUMN ${column.COLUMN_NAME} DECIMAL(15,5) NULL COMMENT 'User balance with 5 decimal precision'
                `);
                console.log(`✅ ${column.COLUMN_NAME} column updated!`);
            }
        }
        
        await sequelize.close();
        console.log('\n🎉 Transaction table precision update completed!');
        
    } catch (error) {
        console.error('❌ Error updating Transaction table precision:', error);
        throw error;
    }
}

// Run the migration
updateTransactionAmountPrecision();
