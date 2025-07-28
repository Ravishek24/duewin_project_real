// scripts/checkCurrentDateAndBets.js
const { getModels } = require('../models');
const unifiedRedis = require('../config/unifiedRedisManager');
const moment = require('moment-timezone');

async function checkCurrentDateAndBets() {
    try {
        console.log('📅 Checking Current Date and Bet Dates...');
        await unifiedRedis.initialize();
        const models = await getModels();

        // Check current dates
        console.log('\n🕐 Current Dates:');
        console.log(`   UTC Now: ${moment().utc().format('YYYY-MM-DD HH:mm:ss')}`);
        console.log(`   IST Now: ${moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')}`);
        console.log(`   Yesterday UTC: ${moment().utc().subtract(1, 'day').format('YYYY-MM-DD')}`);
        console.log(`   Yesterday IST: ${moment().tz('Asia/Kolkata').subtract(1, 'day').format('YYYY-MM-DD')}`);

        // Check what dates have bets
        console.log('\n🎲 Checking Bet Dates in System:');
        
        const gameTables = [
            'bet_record_wingos',
            'bet_record_5ds', 
            'bet_record_k3s',
            'bet_record_trx_wix'
        ];

        for (const tableName of gameTables) {
            try {
                const betDates = await models.User.sequelize.query(`
                    SELECT DATE(created_at) as bet_date, COUNT(*) as bet_count, SUM(bet_amount) as total_amount
                    FROM ${tableName}
                    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                    GROUP BY DATE(created_at)
                    ORDER BY bet_date DESC
                    LIMIT 10
                `, {
                    type: models.User.sequelize.QueryTypes.SELECT
                });

                if (betDates.length > 0) {
                    console.log(`\n📊 ${tableName}:`);
                    for (const date of betDates) {
                        console.log(`   ${date.bet_date}: ${date.bet_count} bets, ₹${parseFloat(date.total_amount).toFixed(2)}`);
                    }
                } else {
                    console.log(`\n📊 ${tableName}: No bets in last 30 days`);
                }
            } catch (error) {
                console.log(`\n📊 ${tableName}: Error - ${error.message}`);
            }
        }

        // Check user 110's team bets specifically
        console.log('\n👤 Checking User 110 Team Bets by Date:');
        
        const referralTree = await models.ReferralTree.findOne({
            where: { user_id: 110 }
        });

        if (referralTree) {
            const allTeamUserIds = [];
            for (let level = 1; level <= 6; level++) {
                const levelField = `level_${level}`;
                const levelData = referralTree[levelField];
                
                if (levelData && levelData.trim()) {
                    const userIds = levelData.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                    allTeamUserIds.push(...userIds);
                }
            }

            if (allTeamUserIds.length > 0) {
                const teamBetDates = await models.User.sequelize.query(`
                    SELECT DATE(created_at) as bet_date, COUNT(*) as bet_count, SUM(bet_amount) as total_amount
                    FROM bet_record_wingos
                    WHERE user_id IN (:userIds)
                    AND created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
                    GROUP BY DATE(created_at)
                    ORDER BY bet_date DESC
                `, {
                    replacements: { userIds: allTeamUserIds },
                    type: models.User.sequelize.QueryTypes.SELECT
                });

                if (teamBetDates.length > 0) {
                    console.log(`   User 110 team bets by date:`);
                    for (const date of teamBetDates) {
                        console.log(`      ${date.bet_date}: ${date.bet_count} bets, ₹${parseFloat(date.total_amount).toFixed(2)}`);
                    }
                } else {
                    console.log(`   No team bets found in last 30 days`);
                }
            }
        }

        console.log('\n✅ Date check completed!');

    } catch (error) {
        console.error('❌ Error checking dates:', error);
    } finally {
        await unifiedRedis.cleanup();
        process.exit(0);
    }
}

checkCurrentDateAndBets(); 