const { connectDB, getSequelizeInstance, Op } = require('../config/db');
const { getModels } = require('../models');

/**
 * Sync valid_referral_count field for all users based on ValidReferral table
 */
const syncValidReferralCounts = async () => {
    let sequelize = null;
    
    try {
        console.log('🔄 Starting valid referral count sync...');
        
        // Initialize database connection
        await connectDB();
        sequelize = await getSequelizeInstance();
        
        console.log('✅ Database connection established');
        
        // Initialize models properly
        const models = await getModels();
        const User = models.User;
        const ValidReferral = models.ValidReferral;
        
        if (!User) {
            throw new Error('User model not found');
        }
        
        if (!ValidReferral) {
            console.log('⚠️ ValidReferral model not found, skipping valid referral sync');
            return {
                success: true,
                message: 'ValidReferral model not available',
                updated: 0,
                errors: 0
            };
        }
        
        console.log('✅ Models initialized');
        
        // Get all users who have a referring_code (potential referrers)
        const referrers = await User.findAll({
            where: {
                referring_code: {
                    [Op.not]: null
                }
            },
            attributes: ['user_id', 'user_name', 'referring_code', 'valid_referral_count']
        });
        
        console.log(`📊 Found ${referrers.length} potential referrers`);
        
        let updatedCount = 0;
        let errorCount = 0;
        
        for (const referrer of referrers) {
            try {
                // Count valid referrals for this user (where is_valid = true)
                const validReferralCount = await ValidReferral.count({
                    where: {
                        referrer_id: referrer.user_id,
                        is_valid: true
                    }
                });
                
                // Update if count is different
                if (validReferralCount !== referrer.valid_referral_count) {
                    await User.update(
                        { valid_referral_count: validReferralCount },
                        { where: { user_id: referrer.user_id } }
                    );
                    
                    console.log(`✅ Updated user ${referrer.user_name} (${referrer.user_id}): valid_referral_count ${referrer.valid_referral_count} → ${validReferralCount}`);
                    updatedCount++;
                } else {
                    console.log(`ℹ️  User ${referrer.user_name} (${referrer.user_id}): valid_referral_count already correct (${validReferralCount})`);
                }
            } catch (error) {
                console.error(`❌ Error updating user ${referrer.user_name}:`, error.message);
                errorCount++;
            }
        }
        
        console.log(`\n🎉 Valid referral count sync completed!`);
        console.log(`✅ Updated: ${updatedCount} users`);
        console.log(`❌ Errors: ${errorCount} users`);
        
        return {
            success: true,
            updated: updatedCount,
            errors: errorCount
        };
        
    } catch (error) {
        console.error('💥 Error in valid referral count sync:', error);
        return {
            success: false,
            message: error.message
        };
    } finally {
        // Close database connection
        if (sequelize) {
            try {
                await sequelize.close();
                console.log('🔌 Database connection closed');
            } catch (closeError) {
                console.warn('⚠️ Error closing database connection:', closeError.message);
            }
        }
    }
};

// Run the sync if this script is executed directly
if (require.main === module) {
    syncValidReferralCounts()
        .then(result => {
            console.log('Sync result:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('Sync failed:', error);
            process.exit(1);
        });
}

module.exports = { syncValidReferralCounts }; 