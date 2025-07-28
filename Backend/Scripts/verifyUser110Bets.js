// scripts/verifyUser110Bets.js
const { getModels } = require('../models');
const { Op } = require('sequelize');

async function verifyUser110Bets() {
    try {
        console.log('🔍 Verifying User 110 Bet Data and Commission Calculation...');
        
        const models = await getModels();
        const userId = 110;
        const testDate = '2025-07-26';
        
        console.log(`\n📊 Analyzing User ${userId} for date: ${testDate}`);
        
        // Get user's rebate team data
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
        console.log(`👥 Team Size: ${rebateTeam.current_team_number}`);
        console.log(`💰 Team Deposits: ₹${rebateTeam.current_deposit}`);
        
        // Get rebate level details
        const rebateLevel = await models.RebateLevel.findOne({
            where: { level: rebateTeam.current_rebet_level }
        });
        
        if (!rebateLevel) {
            console.log('❌ No rebate level found');
            return;
        }
        
        console.log(`\n📋 Rebate Level ${rebateLevel.level} Details:`);
        console.log(`   Lottery L1 Rate: ${(rebateLevel.lottery_l1_rebate * 100).toFixed(4)}%`);
        console.log(`   Lottery L2 Rate: ${(rebateLevel.lottery_l2_rebate * 100).toFixed(4)}%`);
        console.log(`   Lottery L3 Rate: ${(rebateLevel.lottery_l3_rebate * 100).toFixed(4)}%`);
        console.log(`   Lottery L4 Rate: ${(rebateLevel.lottery_l4_rebate * 100).toFixed(4)}%`);
        console.log(`   Lottery L5 Rate: ${(rebateLevel.lottery_l5_rebate * 100).toFixed(4)}%`);
        console.log(`   Lottery L6 Rate: ${(rebateLevel.lottery_l6_rebate * 100).toFixed(4)}%`);
        
        // Get user's referral tree
        const referralTree = await models.ReferralTree.findOne({
            where: { user_id: userId }
        });
        
        if (!referralTree) {
            console.log('❌ No referral tree found for user 110');
            return;
        }
        
        console.log('\n🌳 Referral Tree Analysis:');
        
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
            console.log(`   🆔 User IDs: ${levelUserIds.join(', ')}`);
            
            if (levelUserIds.length === 0) {
                console.log(`   ❌ No valid user IDs at level ${level}`);
                continue;
            }
            
            // Get daily bets for users at this level
            const dailyBets = await getDailyBetsForUsers(levelUserIds, testDate, models);
            
            // Merge bets into allDailyBets
            for (const [userId, betAmount] of Object.entries(dailyBets)) {
                if (!allDailyBets[userId]) {
                    allDailyBets[userId] = 0;
                }
                allDailyBets[userId] += betAmount;
            }
            
            // Calculate commission for this level
            const levelCommission = calculateLevelCommission(dailyBets, rebateLevel, level);
            
            console.log(`   💰 Total bets at level ${level}: ₹${Object.values(dailyBets).reduce((sum, amount) => sum + amount, 0).toFixed(2)}`);
            console.log(`   📈 Commission rate: ${(rebateLevel[`lottery_l${level}_rebate`] * 100).toFixed(4)}%`);
            console.log(`   💸 Commission earned: ₹${levelCommission.toFixed(2)}`);
            
            if (levelCommission > 0) {
                levelCommissions[level] = levelCommission;
                totalCommission += levelCommission;
            }
            
            // Show individual user bets
            if (Object.keys(dailyBets).length > 0) {
                console.log(`   📋 Individual bets:`);
                for (const [userId, betAmount] of Object.entries(dailyBets)) {
                    console.log(`      User ${userId}: ₹${betAmount.toFixed(2)}`);
                }
            }
        }
        
        console.log('\n📊 SUMMARY:');
        console.log(`💰 Total Commission: ₹${totalCommission.toFixed(2)}`);
        console.log(`👥 Total Team Members with Bets: ${Object.keys(allDailyBets).length}`);
        console.log(`🎯 Total Team Bets: ₹${Object.values(allDailyBets).reduce((sum, amount) => sum + amount, 0).toFixed(2)}`);
        
        console.log('\n📋 Commission Breakdown by Level:');
        for (const [level, commission] of Object.entries(levelCommissions)) {
            console.log(`   Level ${level}: ₹${commission.toFixed(2)}`);
        }
        
        // Check if commission records were created
        const commissionRecords = await models.ReferralCommission.findAll({
            where: {
                user_id: userId,
                type: 'rebate',
                created_at: {
                    [Op.gte]: new Date(testDate + ' 00:00:00'),
                    [Op.lt]: new Date(testDate + ' 23:59:59')
                }
            }
        });
        
        console.log(`\n📝 Commission Records Created: ${commissionRecords.length}`);
        if (commissionRecords.length > 0) {
            console.log('📋 Commission Records:');
            for (const record of commissionRecords) {
                console.log(`   Referred User ${record.referred_user_id}: ₹${record.amount.toFixed(2)}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error verifying user 110 bets:', error);
    } finally {
        process.exit(0);
    }
}

async function getDailyBetsForUsers(userIds, processDate, models) {
    const betData = {};
    const moment = require('moment-timezone');

    // Convert IST date to UTC date range
    // IST is UTC+5:30, so IST 00:00 = UTC 18:30 (previous day)
    // IST 23:59 = UTC 18:29 (same day)
    const istStartOfDay = moment.tz(processDate + ' 00:00:00', 'Asia/Kolkata');
    const istEndOfDay = moment.tz(processDate + ' 23:59:59', 'Asia/Kolkata');
    
    const utcStartDate = istStartOfDay.utc().format('YYYY-MM-DD HH:mm:ss');
    const utcEndDate = istEndOfDay.utc().format('YYYY-MM-DD HH:mm:ss');

    console.log(`🕐 Processing bets for IST date: ${processDate}`);
    console.log(`   UTC range: ${utcStartDate} to ${utcEndDate}`);

    // Get bets from all game tables for the specified date
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

function calculateLevelCommission(dailyBets, rebateLevel, level) {
    // Get commission rate for this level (all current games are lottery games)
    const lotteryRateField = `lottery_l${level}_rebate`;
    const lotteryRate = parseFloat(rebateLevel[lotteryRateField] || 0);
    
    if (lotteryRate <= 0) {
        return 0;
    }

    // Calculate total bets from all users at this level
    const totalBets = Object.values(dailyBets).reduce((sum, betAmount) => sum + betAmount, 0);
    
    // Apply lottery commission rate (rates are stored as decimal values, e.g., 0.007000 = 0.7%)
    const commission = totalBets * lotteryRate;
    
    return commission;
}

verifyUser110Bets(); 