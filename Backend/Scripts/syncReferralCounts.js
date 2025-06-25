const { connectDB, getSequelizeInstance, Op } = require('../config/db');
const { getModels } = require('../models');

/**
 * Sync direct_referral_count field for all users based on actual referrals
 */
const syncReferralCounts = async () => {
    let sequelize = null;
    
    try {
        console.log('🔄 Starting referral count sync...');
        
        // Initialize database connection
        await connectDB();
        sequelize = await getSequelizeInstance();
        
        console.log('✅ Database connection established');
        
        // Initialize models properly
        const models = await getModels();
        const User = models.User;
        
        if (!User) {
            throw new Error('User model not found');
        }
        
        console.log('✅ Models initialized');
        
        // Get all users who have a referring_code (potential referrers)
        const referrers = await User.findAll({
            where: {
                referring_code: {
                    [Op.not]: null
                }
            },
            attributes: ['user_id', 'user_name', 'referring_code', 'direct_referral_count']
        });
        
        console.log(`📊 Found ${referrers.length} potential referrers`);
        
        let updatedCount = 0;
        let errorCount = 0;
        
        for (const referrer of referrers) {
            try {
                // Count actual referrals for this user
                const actualReferralCount = await User.count({
                    where: {
                        referral_code: referrer.referring_code
                    }
                });
                
                // Update if count is different
                if (actualReferralCount !== referrer.direct_referral_count) {
                    await User.update(
                        { direct_referral_count: actualReferralCount },
                        { where: { user_id: referrer.user_id } }
                    );
                    
                    console.log(`✅ Updated user ${referrer.user_name} (${referrer.user_id}): ${referrer.direct_referral_count} → ${actualReferralCount}`);
                    updatedCount++;
                } else {
                    console.log(`ℹ️  User ${referrer.user_name} (${referrer.user_id}): count already correct (${actualReferralCount})`);
                }
            } catch (error) {
                console.error(`❌ Error updating user ${referrer.user_name}:`, error.message);
                errorCount++;
            }
        }
        
        console.log(`\n🎉 Sync completed!`);
        console.log(`✅ Updated: ${updatedCount} users`);
        console.log(`❌ Errors: ${errorCount} users`);
        
        return {
            success: true,
            updated: updatedCount,
            errors: errorCount
        };
        
    } catch (error) {
        console.error('💥 Error in referral count sync:', error);
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
    syncReferralCounts()
        .then(result => {
            console.log('Sync result:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('Sync failed:', error);
            process.exit(1);
        });
}

module.exports = { syncReferralCounts }; 