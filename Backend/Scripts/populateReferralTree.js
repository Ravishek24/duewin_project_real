const { connectDB, getSequelizeInstance } = require('../config/db');
const { getModels } = require('../models');

/**
 * Populate ReferralTree for existing users
 */
const populateReferralTree = async () => {
    let sequelize = null;
    
    try {
        console.log('🌳 Starting ReferralTree population for existing users...');
        
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
                
                // Check if referral tree entry already exists
                const existingTree = await ReferralTree.findOne({
                    where: { user_id: referredUser.user_id }
                });
                
                if (existingTree) {
                    console.log(`ℹ️ Referral tree already exists for user ${referredUser.user_id}`);
                    continue;
                }
                
                // Create referral tree entry for the referred user
                await ReferralTree.create({
                    user_id: referredUser.user_id,
                    referrer_id: referrer.user_id,
                    level_1: '',
                    level_2: '',
                    level_3: '',
                    level_4: '',
                    level_5: '',
                    level_6: '',
                    created_at: new Date(),
                    updated_at: new Date()
                });
                
                console.log(`✅ Created referral tree for user ${referredUser.user_id}`);
                
                // Update referrer's tree
                let referrerTree = await ReferralTree.findOne({
                    where: { user_id: referrer.user_id }
                });
                
                if (!referrerTree) {
                    // Create referrer's tree entry
                    referrerTree = await ReferralTree.create({
                        user_id: referrer.user_id,
                        referrer_id: null,
                        level_1: referredUser.user_id.toString(),
                        level_2: '',
                        level_3: '',
                        level_4: '',
                        level_5: '',
                        level_6: '',
                        created_at: new Date(),
                        updated_at: new Date()
                    });
                    console.log(`✅ Created referral tree for referrer ${referrer.user_id}`);
                } else {
                    // Update referrer's level_1
                    const currentLevel1 = referrerTree.level_1 || '';
                    const newLevel1 = currentLevel1 ? `${currentLevel1},${referredUser.user_id}` : referredUser.user_id.toString();
                    
                    await referrerTree.update({
                        level_1: newLevel1,
                        updated_at: new Date()
                    });
                    console.log(`✅ Updated level_1 for referrer ${referrer.user_id}`);
                }
                
                // Update upline trees
                await updateUplineReferralTreesForExisting(referrer.user_id, referredUser.user_id, User, ReferralTree);
                
                processedCount++;
                
            } catch (error) {
                console.error(`❌ Error processing user ${referredUser.user_name}:`, error.message);
                errorCount++;
            }
        }
        
        console.log(`\n🎉 ReferralTree population completed!`);
        console.log(`✅ Processed: ${processedCount} users`);
        console.log(`❌ Errors: ${errorCount} users`);
        
        return {
            success: true,
            processed: processedCount,
            errors: errorCount
        };
        
    } catch (error) {
        console.error('💥 Error in ReferralTree population:', error);
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
                break;
            }
            
            // Find the upline referrer
            const uplineReferrer = await User.findOne({
                where: { referring_code: currentUser.referral_code }
            });
            
            if (!uplineReferrer) {
                break;
            }
            
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
            }
            
            // Update the appropriate level
            const levelField = `level_${level}`;
            const currentLevelData = uplineTree[levelField] || '';
            const newLevelData = currentLevelData ? `${currentLevelData},${newUserId}` : newUserId.toString();
            
            await uplineTree.update({
                [levelField]: newLevelData,
                updated_at: new Date()
            });
            
            console.log(`✅ Updated level ${level} for upline user ${uplineReferrer.user_id}`);
            
            currentUserId = uplineReferrer.user_id;
            level++;
        }
    } catch (error) {
        console.error('💥 Error updating upline trees:', error);
    }
};

// Run the population if this script is executed directly
if (require.main === module) {
    populateReferralTree()
        .then(result => {
            console.log('\n🎉 Population completed!');
            console.log('Result:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('Population failed:', error);
            process.exit(1);
        });
}

module.exports = { populateReferralTree }; 