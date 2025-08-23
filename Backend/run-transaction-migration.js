#!/usr/bin/env node

/**
 * Script to run the transaction migration and verify first_deposit_bonus type
 * Run with: node run-transaction-migration.js
 */

const { getSequelizeInstance } = require('./config/db');
const Transaction = require('./models/Transaction');

async function runTransactionMigration() {
    console.log('🚀 Running Transaction Migration...\n');
    
    try {
        // Get sequelize instance
        const sequelize = await getSequelizeInstance();
        if (!sequelize) {
            throw new Error('Database connection failed');
        }

        // Initialize Transaction model
        Transaction.init(sequelize);
        
        console.log('✅ Transaction model initialized');
        
        // Check current transaction types
        console.log('\n📊 Checking current transaction types...');
        
        // Get table info to see current ENUM values
        const [results] = await sequelize.query(`
            SELECT COLUMN_TYPE 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_SCHEMA = DATABASE() 
            AND TABLE_NAME = 'transactions' 
            AND COLUMN_NAME = 'type'
        `);
        
        if (results.length > 0) {
            const columnType = results[0].COLUMN_TYPE;
            console.log('Current type column definition:', columnType);
            
            // Extract ENUM values
            const enumMatch = columnType.match(/enum\((.*)\)/i);
            if (enumMatch) {
                const enumValues = enumMatch[1].split(',').map(v => v.trim().replace(/'/g, ''));
                console.log('Current ENUM values:', enumValues);
                
                // Check if first_deposit_bonus exists
                if (enumValues.includes('first_deposit_bonus')) {
                    console.log('✅ first_deposit_bonus type already exists');
                } else {
                    console.log('❌ first_deposit_bonus type is missing');
                    console.log('🔧 Need to run migration to add missing types');
                }
            }
        }
        
        // Test creating a first_deposit_bonus transaction
        console.log('\n🧪 Testing first_deposit_bonus transaction creation...');
        
        try {
            const testTransaction = await Transaction.create({
                user_id: 999, // Test user ID
                type: 'first_deposit_bonus',
                amount: 60.00,
                status: 'completed',
                description: 'Test first deposit bonus transaction',
                reference_id: `test_first_bonus_${Date.now()}`,
                metadata: {
                    bonus_type: 'first_deposit',
                    deposit_amount: 500,
                    bonus_tier: { amount: 500, bonus: 60 },
                    usage_restriction: 'house_games_only',
                    allowed_games: ['wingo', '5d', 'k3', 'trx_wix']
                },
                previous_balance: 0.00,
                new_balance: 60.00
            });
            
            console.log('✅ Test transaction created successfully:', testTransaction.id);
            
            // Clean up test transaction
            await testTransaction.destroy();
            console.log('🧹 Test transaction cleaned up');
            
        } catch (error) {
            if (error.message.includes('first_deposit_bonus')) {
                console.log('❌ first_deposit_bonus type not supported in database');
                console.log('🔧 Need to run migration first');
            } else {
                console.log('❌ Other error creating transaction:', error.message);
            }
        }
        
        // Check if we can query by first_deposit_bonus type
        console.log('\n🔍 Testing query by first_deposit_bonus type...');
        
        try {
            const count = await Transaction.count({
                where: { type: 'first_deposit_bonus' }
            });
            console.log(`✅ Query successful. Found ${count} first_deposit_bonus transactions`);
        } catch (error) {
            console.log('❌ Query failed:', error.message);
        }
        
        console.log('\n🎉 Transaction migration verification completed!');
        
    } catch (error) {
        console.error('❌ Migration verification failed:', error);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

// Run the migration verification
runTransactionMigration();
