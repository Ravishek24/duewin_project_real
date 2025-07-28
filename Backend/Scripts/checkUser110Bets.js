// scripts/checkUser110Bets.js
const { getModels } = require('../models');
const unifiedRedis = require('../config/unifiedRedisManager');

async function checkUser110Bets() {
    try {
        console.log('🔍 Checking User 110 Team Bets...');
        await unifiedRedis.initialize();
        const models = await getModels();

        const userId = 110;

        // Get user 110's referral tree
        const referralTree = await models.ReferralTree.findOne({
            where: { user_id: userId }
        });

        if (!referralTree) {
            console.log('❌ User 110 has no referral tree');
            return;
        }

        console.log(`\n👤 User 110 Referral Tree:`);
        for (let level = 1; level <= 6; level++) {
            const levelField = `level_${level}`;
            const levelData = referralTree[levelField];
            
            if (levelData && levelData.trim()) {
                const userIds = levelData.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                console.log(`   Level ${level}: ${userIds.length} users - [${userIds.join(', ')}]`);
            }
        }

        // Get all team member IDs
        const allTeamUserIds = [];
        for (let level = 1; level <= 6; level++) {
            const levelField = `level_${level}`;
            const levelData = referralTree[levelField];
            
            if (levelData && levelData.trim()) {
                const userIds = levelData.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                allTeamUserIds.push(...userIds);
            }
        }

        console.log(`\n👥 Total team members: ${allTeamUserIds.length}`);
        console.log(`Team user IDs: [${allTeamUserIds.join(', ')}]`);

        if (allTeamUserIds.length === 0) {
            console.log('❌ No team members found');
            return;
        }

        // Check recent bets (last 7 days) for team members
        console.log(`\n🎲 Checking recent bets for team members (last 7 days):`);
        
        const gameTables = [
            'bet_record_wingos',
            'bet_record_5ds', 
            'bet_record_k3s',
            'bet_record_trx_wix'
        ];

        for (const tableName of gameTables) {
            try {
                console.log(`\n📊 ${tableName}:`);
                
                // Check recent bets
                const recentBets = await models.User.sequelize.query(`
                    SELECT user_id, DATE(created_at) as bet_date, status, SUM(bet_amount) as total_bet_amount, COUNT(*) as bet_count
                    FROM ${tableName}
                    WHERE user_id IN (:userIds)
                    AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                    GROUP BY user_id, DATE(created_at), status
                    ORDER BY user_id, bet_date DESC
                `, {
                    replacements: { userIds: allTeamUserIds },
                    type: models.User.sequelize.QueryTypes.SELECT
                });

                if (recentBets.length > 0) {
                    console.log(`   Recent bets found:`);
                    for (const bet of recentBets) {
                        console.log(`      User ${bet.user_id} - ${bet.bet_date} - ${bet.status}: ₹${parseFloat(bet.total_bet_amount).toFixed(2)} (${bet.bet_count} bets)`);
                    }
                } else {
                    console.log(`   No recent bets found`);
                }

                // Check yesterday specifically
                const yesterdayBets = await models.User.sequelize.query(`
                    SELECT user_id, status, SUM(bet_amount) as total_bet_amount, COUNT(*) as bet_count
                    FROM ${tableName}
                    WHERE user_id IN (:userIds)
                    AND DATE(created_at) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
                    GROUP BY user_id, status
                `, {
                    replacements: { userIds: allTeamUserIds },
                    type: models.User.sequelize.QueryTypes.SELECT
                });

                if (yesterdayBets.length > 0) {
                    console.log(`   Yesterday's bets:`);
                    for (const bet of yesterdayBets) {
                        console.log(`      User ${bet.user_id} - ${bet.status}: ₹${parseFloat(bet.total_bet_amount).toFixed(2)} (${bet.bet_count} bets)`);
                    }
                } else {
                    console.log(`   No bets yesterday`);
                }

            } catch (error) {
                console.log(`   Error: ${error.message}`);
            }
        }

        // Check if there are any bets at all in the system
        console.log(`\n🔍 Checking if there are any bets in the system:`);
        
        for (const tableName of gameTables) {
            try {
                const totalBets = await models.User.sequelize.query(`
                    SELECT COUNT(*) as count, SUM(bet_amount) as total
                    FROM ${tableName}
                    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                `, {
                    type: models.User.sequelize.QueryTypes.SELECT
                });

                const result = totalBets[0];
                console.log(`   ${tableName}: ${result.count} bets, ₹${parseFloat(result.total || 0).toFixed(2)} total (last 7 days)`);
            } catch (error) {
                console.log(`   ${tableName}: Error - ${error.message}`);
            }
        }

        console.log('\n✅ Check completed!');

    } catch (error) {
        console.error('❌ Error checking user 110 bets:', error);
    } finally {
        await unifiedRedis.cleanup();
        process.exit(0);
    }
}

checkUser110Bets(); 