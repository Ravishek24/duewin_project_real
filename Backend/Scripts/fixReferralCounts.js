const { connectDB, getSequelizeInstance } = require('../config/db');
const { getModels } = require('../models');

/**
 * Comprehensive fix for referral counts and valid referral records
 */
const fixReferralCounts = async () => {
    let sequelize = null;
    
    try {
        console.log('🔧 Starting comprehensive referral count fix...');
        
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
        
        // Get all users who have a referring_code (potential referrers)
        const referrers = await User.findAll({
            where: {
                referring_code: {
                    [require('sequelize').Op.not]: null
                }
            },
            attributes: ['user_id', 'user_name', 'referring_code', 'direct_referral_count', 'valid_referral_count']
        });
        
        console.log(`📊 Found ${referrers.length} potential referrers`);
        
        let totalFixed = 0;
        let totalErrors = 0;
        
        for (const referrer of referrers) {
            try {
                console.log(`\n🔍 Processing referrer: ${referrer.user_name} (${referrer.user_id})`);
                
                // Find all users who used this referrer's code
                const directReferrals = await User.findAll({
                    where: { referral_code: referrer.referring_code },
                    attributes: ['user_id', 'user_name', 'phone_no', 'referral_code']
                });
                
                console.log(`   📊 Found ${directReferrals.length} direct referrals`);
                
                // Fix direct referral count
                if (directReferrals.length !== referrer.direct_referral_count) {
                    await User.update(
                        { direct_referral_count: directReferrals.length },
                        { where: { user_id: referrer.user_id } }
                    );
                    console.log(`   ✅ Fixed direct_referral_count: ${referrer.direct_referral_count} → ${directReferrals.length}`);
                }
                
                // Process each direct referral to create/update ValidReferral records
                let validReferralCount = 0;
                
                for (const referral of directReferrals) {
                    // Check if ValidReferral record exists
                    let validReferral = null;
                    if (ValidReferral) {
                        validReferral = await ValidReferral.findOne({
                            where: {
                                referrer_id: referrer.user_id,
                                referred_id: referral.user_id
                            }
                        });
                    }
                    
                    // If no ValidReferral record exists, create one
                    if (!validReferral && ValidReferral) {
                        // Calculate total recharge for this user
                        let totalRecharge = 0;
                        if (WalletRecharge) {
                            const recharges = await WalletRecharge.findAll({
                                where: { 
                                    user_id: referral.user_id,
                                    status: 'completed'
                                },
                                attributes: ['amount']
                            });
                            
                            totalRecharge = recharges.reduce((sum, r) => sum + parseFloat(r.amount), 0);
                        }
                        
                        // Create ValidReferral record
                        validReferral = await ValidReferral.create({
                            referrer_id: referrer.user_id,
                            referred_id: referral.user_id,
                            total_recharge: totalRecharge,
                            is_valid: totalRecharge >= 300,
                            created_at: new Date(),
                            updated_at: new Date()
                        });
                        
                        console.log(`   📝 Created ValidReferral record for ${referral.user_name}: ₹${totalRecharge} (valid: ${totalRecharge >= 300})`);
                    }
                    
                    // Count valid referrals
                    if (validReferral && validReferral.is_valid) {
                        validReferralCount++;
                    }
                }
                
                // Fix valid referral count
                if (validReferralCount !== referrer.valid_referral_count) {
                    await User.update(
                        { valid_referral_count: validReferralCount },
                        { where: { user_id: referrer.user_id } }
                    );
                    console.log(`   ✅ Fixed valid_referral_count: ${referrer.valid_referral_count} → ${validReferralCount}`);
                }
                
                totalFixed++;
                
            } catch (error) {
                console.error(`   ❌ Error processing referrer ${referrer.user_name}:`, error.message);
                totalErrors++;
            }
        }
        
        console.log(`\n🎉 Referral count fix completed!`);
        console.log(`✅ Fixed: ${totalFixed} referrers`);
        console.log(`❌ Errors: ${totalErrors} referrers`);
        
        return {
            success: true,
            fixed: totalFixed,
            errors: totalErrors
        };
        
    } catch (error) {
        console.error('💥 Error in referral count fix:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

// Run the fix if this script is executed directly
if (require.main === module) {
    fixReferralCounts()
        .then(result => {
            console.log('\n🎉 Fix completed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('Fix failed:', error);
            process.exit(1);
        });
}

module.exports = { fixReferralCounts }; 