const { connectDB, getSequelizeInstance } = require('../config/db');
const { getModels } = require('../models');

/**
 * Update multi-level hierarchy for existing referral trees
 */
const updateMultiLevelReferralTree = async () => {
    let sequelize = null;
    
    try {
        console.log('🌳 Starting multi-level referral tree update...');
        
        // Initialize database connection
        await connectDB();
        sequelize = await getSequelizeInstance();
        
        console.log('✅ Database connection established');
        
        // Initialize models properly
        const models = await getModels();
        const User = models.User;
        const ReferralTree = models.ReferralTree;
        
        if (!User) {
            throw new Error('User model not found');
        }
        
        if (!ReferralTree) {
            throw new Error('ReferralTree model not found');
        }
        
        console.log('✅ Models initialized');
        
        // Get all users who have referral codes (referred users)
        const referredUsers = await User.findAll({
            where: {
                referral_code: {
                    [require('sequelize').Op.not]: null
                }
            },
            attributes: ['user_id', 'user_name', 'referral_code'],
            order: [['user_id', 'ASC']]
        });
        
        console.log(`📊 Found ${referredUsers.length} users with referral codes`);
        
        let processedCount = 0;
        let errorCount = 0;
        
        for (const referredUser of referredUsers) {
            try {
                console.log(`\n🔍 Processing user: ${referredUser.user_name} (${referredUser.user_id})`);
                
                // Find the referrer
                const referrer = await User.findOne({
                    where: { referring_code: referredUser.referral_code },
                    attributes: ['user_id', 'user_name']
                });
                
                if (!referrer) {
                    console.log(`⚠️ No referrer found for code: ${referredUser.referral_code}`);
                    continue;
                }
                
                console.log(`👤 Referrer: ${referrer.user_name} (${referrer.user_id})`);
                
                // Force update upline trees for this user
                await updateUplineReferralTreesForExisting(referrer.user_id, referredUser.user_id, User, ReferralTree);
                
                processedCount++;
                
            } catch (error) {
                console.error(`❌ Error processing user ${referredUser.user_name}:`, error.message);
                errorCount++;
            }
        }
        
        console.log(`\n🎉 Multi-level referral tree update completed!`);
        console.log(`✅ Processed: ${processedCount} users`);
        console.log(`❌ Errors: ${errorCount} users`);
        
        return {
            success: true,
            processed: processedCount,
            errors: errorCount
        };
        
    } catch (error) {
        console.error('💥 Error in multi-level referral tree update:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

/**
 * Update upline referral trees for existing users
 */
const updateUplineReferralTreesForExisting = async (directReferrerId, newUserId, User, ReferralTree) => {
    try {
        console.log(`🔄 Updating upline trees for existing user ${newUserId}`);
        
        let currentUserId = directReferrerId;
        let level = 2;
        
        while (currentUserId && level <= 6) {
            // Find the current user's referrer
            const currentUser = await User.findByPk(currentUserId);
            if (!currentUser || !currentUser.referral_code) {
                console.log(`🏁 Reached top of referral chain at level ${level - 1}`);
                break;
            }
            
            // Find the upline referrer
            const uplineReferrer = await User.findOne({
                where: { referring_code: currentUser.referral_code }
            });
            
            if (!uplineReferrer) {
                console.log(`🏁 No upline referrer found at level ${level - 1}`);
                break;
            }
            
            console.log(`👤 Upline referrer at level ${level}: ${uplineReferrer.user_name} (${uplineReferrer.user_id})`);
            
            // Get or create upline referrer's tree
            let uplineTree = await ReferralTree.findOne({
                where: { user_id: uplineReferrer.user_id }
            });
            
            if (!uplineTree) {
                uplineTree = await ReferralTree.create({
                    user_id: uplineReferrer.user_id,
                    referrer_id: null,
                    level_1: '',
                    level_2: '',
                    level_3: '',
                    level_4: '',
                    level_5: '',
                    level_6: '',
                    created_at: new Date(),
                    updated_at: new Date()
                });
                console.log(`✅ Created new referral tree for upline user ${uplineReferrer.user_id}`);
            }
            
            // Update the appropriate level
            const levelField = `level_${level}`;
            const currentLevelData = uplineTree[levelField] || '';
            
            // Check if user is already in this level
            if (currentLevelData.includes(newUserId.toString())) {
                console.log(`ℹ️ User ${newUserId} already exists in level ${level} for upline user ${uplineReferrer.user_id}`);
            } else {
                const newLevelData = currentLevelData ? `${currentLevelData},${newUserId}` : newUserId.toString();
                
                await uplineTree.update({
                    [levelField]: newLevelData,
                    updated_at: new Date()
                });
                
                console.log(`✅ Updated level ${level} for upline user ${uplineReferrer.user_id}: ${newLevelData}`);
            }
            
            currentUserId = uplineReferrer.user_id;
            level++;
        }
        
        console.log(`✅ Completed upline updates for user ${newUserId} up to level ${level - 1}`);
    } catch (error) {
        console.error('💥 Error updating upline trees:', error);
        throw error;
    }
};

// Run the update if this script is executed directly
if (require.main === module) {
    updateMultiLevelReferralTree()
        .then(result => {
            console.log('\n🎉 Multi-level update completed!');
            console.log('Result:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('Multi-level update failed:', error);
            process.exit(1);
        });
}

module.exports = { updateMultiLevelReferralTree }; 