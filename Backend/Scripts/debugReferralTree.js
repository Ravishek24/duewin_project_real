const { connectDB, getSequelizeInstance } = require('../config/db');
const { getModels } = require('../models');

/**
 * Debug referral tree structure and identify issues
 */
const debugReferralTree = async (targetUserId = 13) => {
    let sequelize = null;
    
    try {
        console.log(`🔍 Debugging referral tree for user ${targetUserId}...`);
        
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
        
        // Get target user details
        const targetUser = await User.findByPk(targetUserId);
        if (!targetUser) {
            throw new Error(`User ${targetUserId} not found`);
        }
        
        console.log(`\n👤 Target User: ${targetUser.user_name} (${targetUser.user_id})`);
        console.log(`   Referring Code: ${targetUser.referring_code}`);
        console.log(`   Referral Code: ${targetUser.referral_code}`);
        
        // Check if target user has a referral tree entry
        const targetTree = await ReferralTree.findOne({
            where: { user_id: targetUserId }
        });
        
        if (!targetTree) {
            console.log(`❌ No referral tree entry found for user ${targetUserId}`);
            return;
        }
        
        // Get direct referrals (level 1) - moved here to fix scope issue
        const directReferrals = await User.findAll({
            where: { referral_code: targetUser.referring_code },
            attributes: ['user_id', 'user_name', 'referral_code']
        });
        
        console.log(`\n🌳 Referral Tree Entry for User ${targetUserId}:`);
        console.log(`   Level 1: ${targetTree.level_1 || 'EMPTY'}`);
        console.log(`   Level 2: ${targetTree.level_2 || 'EMPTY'}`);
        console.log(`   Level 3: ${targetTree.level_3 || 'EMPTY'}`);
        console.log(`   Level 4: ${targetTree.level_4 || 'EMPTY'}`);
        console.log(`   Level 5: ${targetTree.level_5 || 'EMPTY'}`);
        console.log(`   Level 6: ${targetTree.level_6 || 'EMPTY'}`);
        
        // Analyze ReferralTree data
        console.log(`\n🔍 Analyzing ReferralTree Data:`);
        const level1Ids = targetTree.level_1 ? targetTree.level_1.split(',').map(id => parseInt(id.trim())) : [];
        const level2Ids = targetTree.level_2 ? targetTree.level_2.split(',').map(id => parseInt(id.trim())) : [];
        
        console.log(`   Level 1 IDs in tree: [${level1Ids.join(', ')}]`);
        console.log(`   Level 2 IDs in tree: [${level2Ids.join(', ')}]`);
        
        // Check for missing users in level 1
        const directReferralIds = directReferrals.map(ref => ref.user_id);
        const missingInLevel1 = directReferralIds.filter(id => !level1Ids.includes(id));
        const extraInLevel1 = level1Ids.filter(id => !directReferralIds.includes(id));
        
        if (missingInLevel1.length > 0) {
            console.log(`   ❌ Missing in Level 1: [${missingInLevel1.join(', ')}]`);
        }
        if (extraInLevel1.length > 0) {
            console.log(`   ⚠️ Extra in Level 1: [${extraInLevel1.join(', ')}]`);
        }
        if (missingInLevel1.length === 0 && extraInLevel1.length === 0) {
            console.log(`   ✅ Level 1 data is correct`);
        }
        
        // Analyze the referral chain
        console.log(`\n🔗 Analyzing Referral Chain:`);
        
        console.log(`\n📊 Direct Referrals (Level 1): ${directReferrals.length}`);
        directReferrals.forEach((ref, index) => {
            console.log(`   ${index + 1}. ${ref.user_name} (${ref.user_id}) - Code: ${ref.referral_code}`);
        });
        
        // Check each direct referral for their own referrals (level 2)
        console.log(`\n🔍 Checking Level 2 Referrals:`);
        let totalLevel2 = 0;
        
        for (const directRef of directReferrals) {
            // Check if user has a referring_code
            if (!directRef.referring_code) {
                console.log(`   ${directRef.user_name} (${directRef.user_id}) has no referring_code`);
                continue;
            }
            
            const level2Referrals = await User.findAll({
                where: { referral_code: directRef.referring_code },
                attributes: ['user_id', 'user_name', 'referral_code']
            });
            
            if (level2Referrals.length > 0) {
                console.log(`   ${directRef.user_name} (${directRef.user_id}) has ${level2Referrals.length} referrals:`);
                level2Referrals.forEach((ref, index) => {
                    console.log(`     ${index + 1}. ${ref.user_name} (${ref.user_id}) - Code: ${ref.referral_code}`);
                });
                totalLevel2 += level2Referrals.length;
            } else {
                console.log(`   ${directRef.user_name} (${directRef.user_id}) has 0 referrals`);
            }
        }
        
        console.log(`\n📈 Summary:`);
        console.log(`   Level 1 (Direct): ${directReferrals.length} users`);
        console.log(`   Level 2 (Indirect): ${totalLevel2} users`);
        console.log(`   Total Team: ${directReferrals.length + totalLevel2} users`);
        
        // Check what the API should return
        console.log(`\n🎯 Expected API Response:`);
        console.log(`   teamReferrals: {`);
        console.log(`     level1: ${directReferrals.length} users`);
        console.log(`     level2: ${totalLevel2} users`);
        console.log(`     level3: 0 users`);
        console.log(`     level4: 0 users`);
        console.log(`     level5: 0 users`);
        console.log(`     level6: 0 users`);
        console.log(`   }`);
        console.log(`   total: ${directReferrals.length + totalLevel2}`);
        
        // Test the getTeamReferrals function
        console.log(`\n🧪 Testing getTeamReferrals function:`);
        const { getTeamReferrals } = require('../services/referralService');
        const apiResult = await getTeamReferrals(targetUserId);
        
        console.log(`   API Result:`, JSON.stringify(apiResult, null, 2));
        
        // Compare expected vs actual
        const expectedTotal = directReferrals.length + totalLevel2;
        const actualTotal = apiResult.success ? apiResult.total : 0;
        
        console.log(`\n📊 Comparison:`);
        console.log(`   Expected Total: ${expectedTotal}`);
        console.log(`   Actual Total: ${actualTotal}`);
        console.log(`   Match: ${expectedTotal === actualTotal ? '✅ YES' : '❌ NO'}`);
        
        if (expectedTotal !== actualTotal) {
            console.log(`\n🔧 Debugging API Function:`);
            console.log(`   The getTeamReferrals function is not returning the expected results.`);
            console.log(`   This could be due to:`);
            console.log(`   1. ReferralTree data not being read correctly`);
            console.log(`   2. Date filtering issues`);
            console.log(`   3. Model association problems`);
        }
        
        return {
            success: true,
            expectedTotal,
            actualTotal,
            match: expectedTotal === actualTotal,
            directReferrals: directReferrals.length,
            level2Referrals: totalLevel2,
            missingInLevel1,
            level1Ids,
            level2Ids
        };
        
    } catch (error) {
        console.error('💥 Error debugging referral tree:', error);
        return {
            success: false,
            message: error.message
        };
    }
};

// Get command line arguments
const args = process.argv.slice(2);
const userId = parseInt(args[0]) || 13;

// Run the debug if this script is executed directly
if (require.main === module) {
    debugReferralTree(userId)
        .then(result => {
            console.log('\n🎉 Debug completed!');
            console.log('Result:', result);
            process.exit(0);
        })
        .catch(error => {
            console.error('Debug failed:', error);
            process.exit(1);
        });
}

module.exports = { debugReferralTree };