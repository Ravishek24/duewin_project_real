// scripts/debugValidReferrals.js
// Debug script to check ValidReferral table data

const { getSequelizeInstance } = require('../config/db');

const debugValidReferrals = async () => {
    try {
        console.log('🔍 Debugging ValidReferral table...');
        
        const sequelize = await getSequelizeInstance();
        if (!sequelize) {
            throw new Error('Database connection not available');
        }

        // Check ValidReferral table structure
        console.log('\n📋 ValidReferral table structure:');
        const tableInfo = await sequelize.query(`
            DESCRIBE valid_referrals
        `, {
            type: sequelize.QueryTypes.DESCRIBE
        });
        console.log(tableInfo);

        // Check sample data
        console.log('\n📊 Sample ValidReferral records:');
        const sampleRecords = await sequelize.query(`
            SELECT * FROM valid_referrals 
            WHERE is_valid = true 
            LIMIT 5
        `, {
            type: sequelize.QueryTypes.SELECT
        });
        
        if (sampleRecords.length > 0) {
            sampleRecords.forEach((record, index) => {
                console.log(`\n--- Record ${index + 1} ---`);
                console.log('ID:', record.id);
                console.log('Referrer ID:', record.referrer_id);
                console.log('Referred ID:', record.referred_id);
                console.log('Total Recharge:', record.total_recharge);
                console.log('Is Valid:', record.is_valid);
                console.log('Created At:', record.created_at);
                console.log('Updated At:', record.updated_at);
            });
        } else {
            console.log('❌ No valid referrals found in ValidReferral table');
        }

        // Check User table for referred users
        if (sampleRecords.length > 0) {
            console.log('\n👥 Checking referred users in User table:');
            for (const record of sampleRecords) {
                const user = await sequelize.query(`
                    SELECT user_id, user_name, email, phone_no, created_at, 
                           actual_deposit_amount, total_bet_amount
                    FROM users 
                    WHERE user_id = ?
                `, {
                    type: sequelize.QueryTypes.SELECT,
                    replacements: [record.referred_id]
                });

                if (user.length > 0) {
                    console.log(`\n✅ User ${record.referred_id}:`, user[0]);
                } else {
                    console.log(`❌ User ${record.referred_id} not found in users table`);
                }
            }
        }

        // Check WalletRecharge table
        if (sampleRecords.length > 0) {
            console.log('\n💰 Checking WalletRecharge table:');
            for (const record of sampleRecords) {
                const recharges = await sequelize.query(`
                    SELECT amount, created_at, status
                    FROM wallet_recharges 
                    WHERE user_id = ? AND status = 'completed'
                    ORDER BY created_at ASC
                `, {
                    type: sequelize.QueryTypes.SELECT,
                    replacements: [record.referred_id]
                });

                console.log(`\n💳 User ${record.referred_id} recharges:`, recharges.length, 'records');
                if (recharges.length > 0) {
                    recharges.slice(0, 3).forEach((recharge, index) => {
                        console.log(`  ${index + 1}. ₹${recharge.amount} at ${recharge.created_at}`);
                    });
                }
            }
        }

    } catch (error) {
        console.error('💥 Error debugging valid referrals:', error);
    } finally {
        process.exit(0);
    }
};

// Run the debug
debugValidReferrals();
