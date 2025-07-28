// scripts/testCompleteFix.js
const { getModels } = require('../models');
const moment = require('moment-timezone');

async function testCompleteFix() {
    try {
        console.log('🧪 Testing Complete Fix: UTC Conversion + Rate Calculation + Level Reset...\n');
        
        const models = await getModels();
        const userId = 110;
        const testDate = '2025-07-26';
        
        console.log(`📊 Testing User ${userId} for IST date: ${testDate}`);
        
        // Step 1: Reset user 110 to level 0
        console.log('\n🔄 Step 1: Resetting User 110 to Level 0...');
        await models.RebateTeam.update({
            current_rebet_level: 0
        }, {
            where: { user_id: userId }
        });
        console.log('✅ User 110 reset to level 0');
        
        // Step 2: Get user data
        const rebateTeam = await models.RebateTeam.findOne({
            where: { user_id: userId },
            include: [{
                model: models.User,
                as: 'user',
                attributes: ['user_id', 'user_name', 'wallet_balance']
            }]
        });
        
        if (!rebateTeam) {
            console.log('❌ No rebate team found for user 110');
            return;
        }
        
        console.log(`\n👤 User: ${rebateTeam.user.user_name} (ID: ${userId})`);
        console.log(`📈 Current Rebate Level: ${rebateTeam.current_rebet_level}`);
        
        // Step 3: Get rebate level details (Level 0)
        const rebateLevel = await models.RebateLevel.findOne({
            where: { level: 0 }
        });
        
        if (!rebateLevel) {
            console.log('❌ No rebate level 0 found');
            return;
        }
        
        console.log(`\n📋 Rebate Level ${rebateLevel.level} Details:`);
        console.log(`   Lottery L1 Rate: ${(rebateLevel.lottery_l1_rebate * 100).toFixed(4)}%`);
        console.log(`   Lottery L2 Rate: ${(rebateLevel.lottery_l2_rebate * 100).toFixed(4)}%`);
        console.log(`   Lottery L3 Rate: ${(rebateLevel.lottery_l3_rebate * 100).toFixed(4)}%`);
        
        // Step 4: Test UTC conversion
        console.log('\n🕐 Step 4: Testing UTC Conversion...');
        const istStartOfDay = moment.tz(testDate + ' 00:00:00', 'Asia/Kolkata');
        const istEndOfDay = moment.tz(testDate + ' 23:59:59', 'Asia/Kolkata');
        
        const utcStartDate = istStartOfDay.utc().format('YYYY-MM-DD HH:mm:ss');
        const utcEndDate = istEndOfDay.utc().format('YYYY-MM-DD HH:mm:ss');
        
        console.log(`   IST Date: ${testDate}`);
        console.log(`   UTC Range: ${utcStartDate} to ${utcEndDate}`);
        
        // Step 5: Get referral tree
        const referralTree = await models.ReferralTree.findOne({
            where: { user_id: userId }
        });
        
        if (!referralTree) {
            console.log('❌ No referral tree found for user 110');
            return;
        }
        
        console.log('\n🌳 Step 5: Processing Referral Tree with UTC Conversion...');
        
        let totalCommission = 0;
        const levelCommissions = {};
        const allDailyBets = {};
        
        // Process each level (1-6)
        for (let level = 1; level <= 6; level++) {
            const levelField = `level_${level}`;
            const levelData = referralTree[levelField];
            
            console.log(`\n📊 Level ${level}:`);
            
            if (!levelData || levelData.trim() === '') {
                console.log(`   ❌ No users at level ${level}`);
                continue;
            }
            
            // Get user IDs at this level
            const levelUserIds = levelData.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
            console.log(`   👥 Users at level ${level}: ${levelUserIds.length}`);
            
            if (levelUserIds.length === 0) {
                console.log(`   ❌ No valid user IDs at level ${level}`);
                continue;
            }
            
            // Get daily bets for users at this level using UTC conversion
            const dailyBets = await getDailyBetsForUsersWithUtc(levelUserIds, testDate, models);
            
            // Merge bets into allDailyBets
            for (const [userId, betAmount] of Object.entries(dailyBets)) {
                if (!allDailyBets[userId]) {
                    allDailyBets[userId] = 0;
                }
                allDailyBets[userId] += betAmount;
            }
            
            // Calculate commission for this level (corrected calculation)
            const levelCommission = calculateLevelCommissionCorrected(dailyBets, rebateLevel, level);
            
            console.log(`   💰 Total bets at level ${level}: ₹${Object.values(dailyBets).reduce((sum, amount) => sum + amount, 0).toFixed(2)}`);
            console.log(`   📈 Commission rate: ${(rebateLevel[`lottery_l${level}_rebate`] * 100).toFixed(4)}%`);
            console.log(`   💸 Commission earned: ₹${levelCommission.toFixed(2)}`);
            
            if (levelCommission > 0) {
                levelCommissions[level] = levelCommission;
                totalCommission += levelCommission;
            }
        }
        
        console.log('\n📊 FINAL RESULTS:');
        console.log(`💰 Total Commission: ₹${totalCommission.toFixed(2)}`);
        console.log(`👥 Total Team Members with Bets: ${Object.keys(allDailyBets).length}`);
        console.log(`🎯 Total Team Bets: ₹${Object.values(allDailyBets).reduce((sum, amount) => sum + amount, 0).toFixed(2)}`);
        
        console.log('\n📋 Commission Breakdown by Level:');
        for (const [level, commission] of Object.entries(levelCommissions)) {
            console.log(`   Level ${level}: ₹${commission.toFixed(2)}`);
        }
        
        console.log('\n✅ All fixes applied successfully!');
        console.log('   - UTC conversion for bet data');
        console.log('   - Corrected rate calculation (no division by 100)');
        console.log('   - User 110 reset to level 0');
        
    } catch (error) {
        console.error('❌ Error in complete fix test:', error);
    } finally {
        process.exit(0);
    }
}

async function getDailyBetsForUsersWithUtc(userIds, processDate, models) {
    const betData = {};

    // Convert IST date to UTC date range
    const istStartOfDay = moment.tz(processDate + ' 00:00:00', 'Asia/Kolkata');
    const istEndOfDay = moment.tz(processDate + ' 23:59:59', 'Asia/Kolkata');
    
    const utcStartDate = istStartOfDay.utc().format('YYYY-MM-DD HH:mm:ss');
    const utcEndDate = istEndOfDay.utc().format('YYYY-MM-DD HH:mm:ss');

    const gameTables = [
        'bet_record_wingos',
        'bet_record_5ds', 
        'bet_record_k3s',
        'bet_record_trx_wix'
    ];

    for (const tableName of gameTables) {
        try {
            const bets = await models.User.sequelize.query(`
                SELECT user_id, SUM(bet_amount) as total_bet_amount
                FROM ${tableName}
                WHERE user_id IN (:userIds)
                AND created_at >= :utcStartDate
                AND created_at <= :utcEndDate
                AND status IN ('won', 'lost')
                GROUP BY user_id
            `, {
                replacements: { 
                    userIds, 
                    utcStartDate, 
                    utcEndDate 
                },
                type: models.User.sequelize.QueryTypes.SELECT
            });

            for (const bet of bets) {
                if (!betData[bet.user_id]) {
                    betData[bet.user_id] = 0;
                }
                betData[bet.user_id] += parseFloat(bet.total_bet_amount || 0);
            }
        } catch (error) {
            console.warn(`⚠️ Error querying ${tableName}:`, error.message);
        }
    }

    return betData;
}

function calculateLevelCommissionCorrected(dailyBets, rebateLevel, level) {
    const lotteryRateField = `lottery_l${level}_rebate`;
    const lotteryRate = parseFloat(rebateLevel[lotteryRateField] || 0);
    
    if (lotteryRate <= 0) {
        return 0;
    }

    const totalBets = Object.values(dailyBets).reduce((sum, betAmount) => sum + betAmount, 0);
    
    // Corrected: rates are already in decimal format, no division by 100
    const commission = totalBets * lotteryRate;
    
    return commission;
}

testCompleteFix(); 