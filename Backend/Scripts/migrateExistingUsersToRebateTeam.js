// scripts/migrateExistingUsersToRebateTeam.js
const { getModels } = require('../models');
const unifiedRedis = require('../config/unifiedRedisManager');

async function migrateExistingUsersToRebateTeam() {
    try {
        console.log('🔄 Starting migration of existing users to RebateTeam table...');
        
        // Initialize Redis
        await unifiedRedis.initialize();
        
        // Get models
        const models = await getModels();
        
        // Get all users who don't have RebateTeam entries
        const usersWithoutRebateTeam = await models.User.findAll({
            include: [{
                model: models.RebateTeam,
                as: 'rebateteam',
                required: false
            }],
            where: {
                '$rebateteam.id$': null
            },
            attributes: ['user_id', 'user_name', 'referring_code', 'referral_code']
        });
        
        console.log(`📊 Found ${usersWithoutRebateTeam.length} users without RebateTeam entries`);
        
        if (usersWithoutRebateTeam.length === 0) {
            console.log('✅ All users already have RebateTeam entries');
            return;
        }
        
        let createdCount = 0;
        let errorCount = 0;
        
        // Process users in batches
        const batchSize = 50;
        for (let i = 0; i < usersWithoutRebateTeam.length; i += batchSize) {
            const batch = usersWithoutRebateTeam.slice(i, i + batchSize);
            
            console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(usersWithoutRebateTeam.length / batchSize)}`);
            
            for (const user of batch) {
                try {
                    // Create RebateTeam entry
                    await models.RebateTeam.create({
                        user_id: user.user_id,
                        current_rebet_level: 0,
                        current_team_number: 0,
                        current_deposit: 0.00,
                        level_1_count: 0,
                        level_2_count: 0,
                        level_3_count: 0,
                        level_4_count: 0,
                        level_5_count: 0,
                        level_6_count: 0,
                        last_updated: new Date()
                    });
                    
                    createdCount++;
                    
                    if (createdCount % 100 === 0) {
                        console.log(`✅ Created ${createdCount} RebateTeam entries so far...`);
                    }
                    
                } catch (error) {
                    console.error(`❌ Error creating RebateTeam for user ${user.user_id}:`, error.message);
                    errorCount++;
                }
            }
            
            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        console.log('\n🎉 Migration completed!');
        console.log(`✅ Created: ${createdCount} RebateTeam entries`);
        console.log(`❌ Errors: ${errorCount} users`);
        
        // Update team data for users with referrals
        console.log('\n🔄 Updating team data for users with referrals...');
        await updateTeamDataForExistingUsers(models);
        
    } catch (error) {
        console.error('💥 Error in migration:', error);
    } finally {
        await unifiedRedis.close();
        process.exit(0);
    }
}

async function updateTeamDataForExistingUsers(models) {
    try {
        // Get all users with referral trees
        const usersWithReferralTrees = await models.ReferralTree.findAll({
            include: [{
                model: models.User,
                as: 'user',
                attributes: ['user_id', 'user_name']
            }]
        });
        
        console.log(`📊 Found ${usersWithReferralTrees.length} users with referral trees`);
        
        let updatedCount = 0;
        
        for (const referralTree of usersWithReferralTrees) {
            try {
                const userId = referralTree.user_id;
                
                // Calculate team counts by level
                const levelCounts = {};
                let totalTeamMembers = 0;
                
                for (let level = 1; level <= 6; level++) {
                    const levelField = `level_${level}`;
                    const levelData = referralTree[levelField];
                    
                    if (levelData && levelData.trim()) {
                        const userIds = levelData.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                        levelCounts[level] = userIds.length;
                        totalTeamMembers += userIds.length;
                    } else {
                        levelCounts[level] = 0;
                    }
                }
                
                // Get total deposits from team members
                const teamUserIds = [];
                for (let level = 1; level <= 6; level++) {
                    const levelField = `level_${level}`;
                    const levelData = referralTree[levelField];
                    
                    if (levelData && levelData.trim()) {
                        const userIds = levelData.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                        teamUserIds.push(...userIds);
                    }
                }
                
                let totalDeposits = 0;
                if (teamUserIds.length > 0) {
                    const deposits = await models.WalletRecharge.findAll({
                        where: {
                            user_id: teamUserIds,
                            status: 'completed'
                        },
                        attributes: [
                            'user_id',
                            [models.User.sequelize.fn('SUM', models.User.sequelize.col('amount')), 'total_deposit']
                        ],
                        group: ['user_id']
                    });
                    
                    totalDeposits = deposits.reduce((sum, deposit) => sum + parseFloat(deposit.dataValues.total_deposit || 0), 0);
                }
                
                // Update RebateTeam data
                await models.RebateTeam.update({
                    current_team_number: totalTeamMembers,
                    current_deposit: totalDeposits,
                    level_1_count: levelCounts[1] || 0,
                    level_2_count: levelCounts[2] || 0,
                    level_3_count: levelCounts[3] || 0,
                    level_4_count: levelCounts[4] || 0,
                    level_5_count: levelCounts[5] || 0,
                    level_6_count: levelCounts[6] || 0,
                    last_updated: new Date()
                }, {
                    where: { user_id: userId }
                });
                
                updatedCount++;
                
                if (updatedCount % 50 === 0) {
                    console.log(`✅ Updated team data for ${updatedCount} users...`);
                }
                
            } catch (error) {
                console.error(`❌ Error updating team data for user ${referralTree.user_id}:`, error.message);
            }
        }
        
        console.log(`✅ Updated team data for ${updatedCount} users`);
        
    } catch (error) {
        console.error('❌ Error updating team data:', error);
    }
}

// Run the migration
migrateExistingUsersToRebateTeam(); 