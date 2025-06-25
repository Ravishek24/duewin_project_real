const { connectDB, getSequelizeInstance } = require('../config/db');
const { getModels } = require('../models');

/**
 * Manually update referral count for testing
 */
const manualUpdateReferralCount = async (userId, newCount) => {
    let sequelize = null;
    
    try {
        console.log(`🔄 Manually updating referral count for user ${userId} to ${newCount}...`);
        
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
        
        // Get current user data
        const user = await User.findByPk(userId);
        if (!user) {
            throw new Error(`User with ID ${userId} not found`);
        }
        
        console.log(`👤 Current user: ${user.user_name}`);
        console.log(`📊 Current direct_referral_count: ${user.direct_referral_count}`);
        console.log(`✅ Current valid_referral_count: ${user.valid_referral_count}`);
        
        // Update the referral count
        await User.update(
            { direct_referral_count: newCount },
            { where: { user_id: userId } }
        );
        
        console.log(`✅ Updated direct_referral_count from ${user.direct_referral_count} to ${newCount}`);
        
        // Verify the update
        const updatedUser = await User.findByPk(userId);
        console.log(`📊 New direct_referral_count: ${updatedUser.direct_referral_count}`);
        
        return {
            success: true,
            message: `Referral count updated successfully`,
            oldCount: user.direct_referral_count,
            newCount: updatedUser.direct_referral_count
        };
        
    } catch (error) {
        console.error('💥 Error updating referral count:', error);
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

// Get command line arguments
const args = process.argv.slice(2);
const userId = parseInt(args[0]);
const newCount = parseInt(args[1]);

if (!userId || !newCount) {
    console.log('Usage: node scripts/manualUpdateReferralCount.js <userId> <newCount>');
    console.log('Example: node scripts/manualUpdateReferralCount.js 13 5');
    process.exit(1);
}

// Run the update if this script is executed directly
if (require.main === module) {
    manualUpdateReferralCount(userId, newCount)
        .then(result => {
            console.log('Update result:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('Update failed:', error);
            process.exit(1);
        });
}

module.exports = { manualUpdateReferralCount }; 