const { connectDB, getSequelizeInstance } = require('../config/db');
const { getModels } = require('../models');

/**
 * Check and debug referral status for a specific user
 */
const checkUserReferrals = async (userId) => {
    let sequelize = null;
    
    try {
        console.log(`🔍 Checking referral status for user ${userId}...`);
        
        // Initialize database connection
        await connectDB();
        sequelize = await getSequelizeInstance();
        
        console.log('✅ Database connection established');
        
        // Initialize models properly
        const models = await getModels();
        const User = models.User;
        const ValidReferral = models.ValidReferral;
        const WalletRecharge = models.WalletRecharge;
        
        if (!User) {
            throw new Error('User model not found');
        }
        
        console.log('✅ Models initialized');
        
        // Get user details
        const user = await User.findByPk(userId);
        if (!user) {
            throw new Error(`User with ID ${userId} not found`);
        }
        
        console.log(`\n👤 User Details:`);
        console.log(`   Name: ${user.user_name}`);
        console.log(`   Phone: ${user.phone_no}`);
        console.log(`   Referring Code: ${user.referring_code}`);
        console.log(`   Referral Code: ${user.referral_code}`);
        console.log(`   Direct Referral Count: ${user.direct_referral_count}`);
        console.log(`   Valid Referral Count: ${user.valid_referral_count}`);
        
        // Find direct referrals
        const directReferrals = await User.findAll({
            where: { referral_code: user.referring_code },
            attributes: ['user_id', 'user_name', 'phone_no', 'referral_code']
        });
        
        console.log(`\n📊 Direct Referrals (${directReferrals.length}):`);
        directReferrals.forEach((ref, index) => {
            console.log(`   ${index + 1}. ${ref.user_name} (${ref.user_id}) - Phone: ${ref.phone_no}`);
        });
        
        // Check ValidReferral records
        if (ValidReferral) {
            const validReferrals = await ValidReferral.findAll({
                where: { referrer_id: userId },
                attributes: ['referred_id', 'total_recharge', 'is_valid', 'created_at', 'updated_at']
            });
            
            console.log(`\n✅ Valid Referral Records (${validReferrals.length}):`);
            validReferrals.forEach((vr, index) => {
                console.log(`   ${index + 1}. Referred User: ${vr.referred_id}`);
                console.log(`      Total Recharge: ₹${vr.total_recharge}`);
                console.log(`      Is Valid: ${vr.is_valid}`);
                console.log(`      Created: ${vr.created_at}`);
                console.log(`      Updated: ${vr.updated_at}`);
            });
            
            // Count valid referrals
            const validCount = validReferrals.filter(vr => vr.is_valid).length;
            console.log(`\n📈 Valid Referral Count: ${validCount} (should match user.valid_referral_count: ${user.valid_referral_count})`);
            
            if (validCount !== user.valid_referral_count) {
                console.log(`⚠️  MISMATCH DETECTED! Valid count should be ${validCount} but user has ${user.valid_referral_count}`);
            }
        }
        
        // Check recharge history for direct referrals
        if (directReferrals.length > 0 && WalletRecharge) {
            console.log(`\n💰 Recharge History for Direct Referrals:`);
            
            for (const referral of directReferrals) {
                const recharges = await WalletRecharge.findAll({
                    where: { 
                        user_id: referral.user_id,
                        status: 'completed'
                    },
                    attributes: ['amount', 'created_at'],
                    order: [['created_at', 'ASC']]
                });
                
                const totalRecharge = recharges.reduce((sum, r) => sum + parseFloat(r.amount), 0);
                const isEligible = totalRecharge >= 300;
                
                console.log(`   ${referral.user_name} (${referral.user_id}):`);
                console.log(`      Total Recharge: ₹${totalRecharge}`);
                console.log(`      Eligible for Valid Referral: ${isEligible ? 'YES' : 'NO'}`);
                console.log(`      Recharge Count: ${recharges.length}`);
                
                if (recharges.length > 0) {
                    console.log(`      First Recharge: ₹${recharges[0].amount} on ${recharges[0].created_at}`);
                    console.log(`      Latest Recharge: ₹${recharges[recharges.length - 1].amount} on ${recharges[recharges.length - 1].created_at}`);
                }
            }
        }
        
        return {
            success: true,
            user: {
                id: user.user_id,
                name: user.user_name,
                directReferralCount: user.direct_referral_count,
                validReferralCount: user.valid_referral_count,
                directReferrals: directReferrals.length
            }
        };
        
    } catch (error) {
        console.error('💥 Error checking user referrals:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

// Get command line arguments
const args = process.argv.slice(2);
const userId = parseInt(args[0]);

if (!userId) {
    console.log('Usage: node scripts/checkUserReferrals.js <userId>');
    console.log('Example: node scripts/checkUserReferrals.js 13');
    process.exit(1);
}

// Run the check if this script is executed directly
if (require.main === module) {
    checkUserReferrals(userId)
        .then(result => {
            console.log('\n🎉 Check completed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Check failed:', error);
            process.exit(1);
        });
}

module.exports = { checkUserReferrals }; 