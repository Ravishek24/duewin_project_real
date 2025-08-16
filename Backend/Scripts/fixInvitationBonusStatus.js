// scripts/fixInvitationBonusStatus.js
// Fix existing invitation bonus records that have 'pending' status but should be 'paid'

const { getSequelizeInstance } = require('../config/db');

const fixInvitationBonusStatus = async () => {
    try {
        console.log('🔧 Starting to fix invitation bonus status...');
        
        const sequelize = await getSequelizeInstance();
        if (!sequelize) {
            throw new Error('Database connection not available');
        }

        // Update ReferralCommission records where there's a corresponding Transaction
        const updateResult = await sequelize.query(`
            UPDATE referral_commissions rc
            SET status = 'paid', updated_at = NOW()
            WHERE rc.type = 'direct_bonus' 
            AND rc.status = 'pending'
            AND EXISTS (
                SELECT 1 FROM transactions t 
                WHERE t.type = 'direct_bonus' 
                AND t.metadata->>'commission_id' = rc.id::text
                AND t.status = 'completed'
            )
        `, {
            type: sequelize.QueryTypes.UPDATE
        });

        console.log('✅ Updated ReferralCommission records:', updateResult[1], 'rows affected');

        // Count remaining pending records
        const pendingCount = await sequelize.query(`
            SELECT COUNT(*) as count
            FROM referral_commissions 
            WHERE type = 'direct_bonus' AND status = 'pending'
        `, {
            type: sequelize.QueryTypes.SELECT
        });

        console.log('📊 Remaining pending records:', pendingCount[0].count);

        // Show summary of all direct_bonus records
        const summary = await sequelize.query(`
            SELECT 
                status,
                COUNT(*) as count,
                SUM(CAST(amount AS DECIMAL(10,2))) as total_amount
            FROM referral_commissions 
            WHERE type = 'direct_bonus'
            GROUP BY status
            ORDER BY status
        `, {
            type: sequelize.QueryTypes.SELECT
        });

        console.log('📈 Summary of direct_bonus records:');
        summary.forEach(row => {
            console.log(`  ${row.status}: ${row.count} records, ₹${row.total_amount}`);
        });

        console.log('🎉 Invitation bonus status fix completed!');
        
    } catch (error) {
        console.error('💥 Error fixing invitation bonus status:', error);
    } finally {
        process.exit(0);
    }
};

// Run the script
fixInvitationBonusStatus();
