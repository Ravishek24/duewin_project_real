// scripts/debugUser110Rebate.js
const { getModels } = require('../models');
const unifiedRedis = require('../config/unifiedRedisManager');

async function debugUser110Rebate() {
    try {
        console.log('🔍 Debugging User 110 Rebate Calculation...');
        await unifiedRedis.initialize();
        const models = await getModels();

        const userId = 110;
        const processDate = '2025-01-26'; // Yesterday's date

        console.log(`\n👤 Checking User ${userId}...`);

        // 1. Check if user has RebateTeam entry
        const rebateTeam = await models.RebateTeam.findOne({
            where: { user_id: userId },
            include: [{
                model: models.User,
                as: 'user',
                attributes: ['user_id', 'user_name', 'wallet_balance']
            }]
        });

        if (!rebateTeam) {
            console.log('❌ User 110 has no RebateTeam entry');
            return;
        }

        console.log(`✅ Found RebateTeam entry:`);
        console.log(`   User: ${rebateTeam.user.user_name} (ID: ${userId})`);
        console.log(`   Current Level: ${rebateTeam.current_rebet_level}`);
        console.log(`   Team Size: ${rebateTeam.current_team_number}`);
        console.log(`   Team Deposits: ₹${rebateTeam.current_deposit}`);

        // 2. Check referral tree
        const referralTree = await models.ReferralTree.findOne({
            where: { user_id: userId }
        });

        if (!referralTree) {
            console.log('❌ User 110 has no referral tree');
            return;
        }

        console.log(`\n🌳 Referral Tree Structure:`);
        for (let level = 1; level <= 6; level++) {
            const levelField = `level_${level}`;
            const levelData = referralTree[levelField];
            
            if (levelData && levelData.trim()) {
                const userIds = levelData.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                console.log(`   Level ${level}: ${userIds.length} users - [${userIds.join(', ')}]`);
            } else {
                console.log(`   Level ${level}: 0 users`);
            }
        }

        // 3. Get rebate level details
        const rebateLevel = await models.RebateLevel.findOne({
            where: { level: rebateTeam.current_rebet_level }
        });

        if (!rebateLevel) {
            console.log(`❌ No rebate level found for level ${rebateTeam.current_rebet_level}`);
            return;
        }

        console.log(`\n📊 Rebate Level ${rebateLevel.level} Details:`);
        for (let level = 1; level <= 6; level++) {
            const rateField = `lottery_l${level}_rebate`;
            const rate = parseFloat(rebateLevel[rateField] || 0);
            console.log(`   Level ${level} Rate: ${rate} (${(rate * 100).toFixed(3)}%)`);
        }

        // 4. Check bets for each level
        console.log(`\n🎲 Checking Bets for ${processDate}:`);
        
        for (let level = 1; level <= 6; level++) {
            const levelField = `level_${level}`;
            const levelData = referralTree[levelField];
            
            if (!levelData || levelData.trim() === '') {
                console.log(`   Level ${level}: No users`);
                continue;
            }

            const levelUserIds = levelData.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            
            if (levelUserIds.length === 0) {
                console.log(`   Level ${level}: No valid user IDs`);
                continue;
            }

            console.log(`\n   📊 Level ${level} (${levelUserIds.length} users):`);
            
            // Check bets for each user at this level
            let levelTotalBets = 0;
            for (const levelUserId of levelUserIds) {
                const userBets = await checkUserBets(levelUserId, processDate, models);
                if (userBets > 0) {
                    console.log(`      User ${levelUserId}: ₹${userBets.toFixed(2)}`);
                    levelTotalBets += userBets;
                }
            }

            if (levelTotalBets > 0) {
                const rateField = `lottery_l${level}_rebate`;
                const rate = parseFloat(rebateLevel[rateField] || 0);
                const commission = levelTotalBets * (rate / 100);
                
                console.log(`      💰 Level ${level} Total: ₹${levelTotalBets.toFixed(2)}`);
                console.log(`      📈 Commission: ₹${commission.toFixed(4)} (Rate: ${(rate * 100).toFixed(3)}%)`);
            } else {
                console.log(`      ❌ No bets found for level ${level}`);
            }
        }

        // 5. Check if there are any bets at all for the date
        console.log(`\n🔍 Checking if there are any bets on ${processDate}:`);
        
        const gameTables = [
            'bet_record_wingos',
            'bet_record_5ds', 
            'bet_record_k3s',
            'bet_record_trx_wix'
        ];

        for (const tableName of gameTables) {
            try {
                const totalBets = await models.User.sequelize.query(`
                    SELECT COUNT(*) as count, SUM(bet_amount) as total
                    FROM ${tableName}
                    WHERE DATE(created_at) = :processDate
                    AND status IN ('won', 'lost')
                `, {
                    replacements: { processDate },
                    type: models.User.sequelize.QueryTypes.SELECT
                });

                const result = totalBets[0];
                console.log(`   ${tableName}: ${result.count} bets, ₹${parseFloat(result.total || 0).toFixed(2)} total`);
            } catch (error) {
                console.log(`   ${tableName}: Error - ${error.message}`);
            }
        }

        // 6. Check specific users in user 110's team
        console.log(`\n👥 Checking specific team members of user 110:`);
        
        const allTeamUserIds = [];
        for (let level = 1; level <= 6; level++) {
            const levelField = `level_${level}`;
            const levelData = referralTree[levelField];
            
            if (levelData && levelData.trim()) {
                const userIds = levelData.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                allTeamUserIds.push(...userIds);
            }
        }

        console.log(`   Total team members: ${allTeamUserIds.length}`);
        console.log(`   Team user IDs: [${allTeamUserIds.join(', ')}]`);

        // Check if any of these users have bets
        if (allTeamUserIds.length > 0) {
            for (const tableName of gameTables) {
                try {
                    const teamBets = await models.User.sequelize.query(`
                        SELECT user_id, SUM(bet_amount) as total_bet_amount
                        FROM ${tableName}
                        WHERE user_id IN (:userIds)
                        AND DATE(created_at) = :processDate
                        AND status IN ('won', 'lost')
                        GROUP BY user_id
                    `, {
                        replacements: { userIds: allTeamUserIds, processDate },
                        type: models.User.sequelize.QueryTypes.SELECT
                    });

                    if (teamBets.length > 0) {
                        console.log(`   ${tableName} - Team bets found:`);
                        for (const bet of teamBets) {
                            console.log(`      User ${bet.user_id}: ₹${parseFloat(bet.total_bet_amount).toFixed(2)}`);
                        }
                    } else {
                        console.log(`   ${tableName} - No team bets found`);
                    }
                } catch (error) {
                    console.log(`   ${tableName} - Error: ${error.message}`);
                }
            }
        }

        console.log('\n✅ Debug completed!');

    } catch (error) {
        console.error('❌ Error debugging user 110:', error);
    } finally {
        await unifiedRedis.cleanup();
        process.exit(0);
    }
}

async function checkUserBets(userId, processDate, models) {
    const gameTables = [
        'bet_record_wingos',
        'bet_record_5ds', 
        'bet_record_k3s',
        'bet_record_trx_wix'
    ];

    let totalBets = 0;

    for (const tableName of gameTables) {
        try {
            const bets = await models.User.sequelize.query(`
                SELECT SUM(bet_amount) as total_bet_amount
                FROM ${tableName}
                WHERE user_id = :userId
                AND DATE(created_at) = :processDate
                AND status IN ('won', 'lost')
            `, {
                replacements: { userId, processDate },
                type: models.User.sequelize.QueryTypes.SELECT
            });

            const betAmount = parseFloat(bets[0]?.total_bet_amount || 0);
            totalBets += betAmount;
        } catch (error) {
            // Ignore table errors
        }
    }

    return totalBets;
}

debugUser110Rebate(); 