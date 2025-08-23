// test-rebate-today.js - Test Rebate System with TODAY's date
// This will process today's betting activity instead of yesterday's

async function testRebateToday() {
    try {
        console.log('🚀 REBATE TEST - TODAY\'S DATE');
        console.log('=' .repeat(50));
        
        const moment = require('moment-timezone');
        const todayIST = moment().tz('Asia/Kolkata').format('YYYY-MM-DD');
        
        console.log(`📅 Processing rebates for: ${todayIST} (TODAY)`);
        console.log('⚡ This will include all betting activity from today');
        
        // Set environment variable to force today's date
        process.env.FORCE_REBATE_DATE = todayIST;
        
        console.log('\n🔄 Starting rebate processing...');
        const startTime = Date.now();
        
        // Import and execute the daily rebate function with today's date
        const { processDailyRebates } = require('./scripts/masterCronJobs');
        await processDailyRebates();
        
        const processingTime = Date.now() - startTime;
        console.log(`✅ Processing completed in ${processingTime}ms`);
        
        // Check results
        console.log('\n📊 CHECKING RESULTS...');
        
        const { getModels } = require('./models');
        const models = await getModels();
        const { Op } = require('sequelize');
        
        // Count new commissions from this run
        const newCommissions = await models.ReferralCommission.findAll({
            where: {
                created_at: {
                    [Op.gte]: new Date(startTime)
                }
            },
            attributes: ['user_id', 'referred_user_id', 'amount', 'rebate_type', 'level'],
            order: [['amount', 'DESC']],
            limit: 10
        });
        
        // Count new transaction records
        const newTransactions = await models.Transaction.count({
            where: {
                type: 'rebate',
                created_at: {
                    [Op.gte]: new Date(startTime)
                }
            }
        });
        
        console.log(`💰 New commissions created: ${newCommissions.length}`);
        console.log(`📝 New transaction records: ${newTransactions}`);
        
        if (newCommissions.length > 0) {
            const totalCommission = newCommissions.reduce((sum, comm) => sum + parseFloat(comm.amount), 0);
            console.log(`💸 Total commission distributed: ₹${totalCommission.toFixed(2)}`);
            
            console.log('\n🏆 TOP COMMISSIONS:');
            newCommissions.forEach((comm, index) => {
                console.log(`   ${index + 1}. User ${comm.user_id} earned ₹${comm.amount} from user ${comm.referred_user_id} (${comm.rebate_type} L${comm.level})`);
            });
        } else {
            console.log('\n⚠️ No commissions generated');
            console.log('This means either:');
            console.log('   • No betting activity today');
            console.log('   • No users have referrers to earn from');
            console.log('   • Users don\'t meet rebate level requirements');
        }
        
        // Show today's betting activity
        console.log('\n📈 TODAY\'S BETTING ACTIVITY:');
        
        const { sequelize } = require('./config/db');
        const todayStart = moment().tz('Asia/Kolkata').startOf('day').utc().toDate();
        const todayEnd = moment().tz('Asia/Kolkata').endOf('day').utc().toDate();
        
        const [betActivity] = await sequelize.query(`
            SELECT 
                COUNT(*) as total_bets, 
                COUNT(DISTINCT user_id) as unique_users, 
                SUM(bet_amount) as total_volume
            FROM (
                SELECT user_id, bet_amount FROM bet_record_wingos 
                WHERE created_at BETWEEN :start AND :end AND status IN ('won', 'lost')
                UNION ALL
                SELECT user_id, bet_amount FROM bet_record_5ds
                WHERE created_at BETWEEN :start AND :end AND status IN ('won', 'lost')
                UNION ALL
                SELECT user_id, bet_amount FROM bet_record_k3s
                WHERE created_at BETWEEN :start AND :end AND status IN ('won', 'lost')
                UNION ALL
                SELECT user_id, bet_amount FROM bet_record_trx_wix
                WHERE created_at BETWEEN :start AND :end AND status IN ('won', 'lost')
            ) as combined_bets
        `, {
            replacements: { start: todayStart, end: todayEnd },
            type: sequelize.QueryTypes.SELECT
        });
        
        if (betActivity && betActivity[0]) {
            console.log(`   🎲 Total bets: ${betActivity[0].total_bets || 0}`);
            console.log(`   👥 Unique users: ${betActivity[0].unique_users || 0}`);
            console.log(`   💰 Total volume: ₹${parseFloat(betActivity[0].total_volume || 0).toFixed(2)}`);
        } else {
            console.log('   📊 No betting activity data available');
        }
        
        // Show users with referrers who bet today
        if (betActivity[0].total_bets > 0) {
            const [usersWithReferrers] = await sequelize.query(`
                SELECT DISTINCT 
                    b.user_id,
                    u.user_name,
                    u.referral_code,
                    r.user_id as referrer_id,
                    r.user_name as referrer_name,
                    SUM(b.bet_amount) as total_bet
                FROM (
                    SELECT user_id, bet_amount FROM bet_record_wingos 
                    WHERE created_at BETWEEN :start AND :end AND status IN ('won', 'lost')
                    UNION ALL
                    SELECT user_id, bet_amount FROM bet_record_5ds
                    WHERE created_at BETWEEN :start AND :end AND status IN ('won', 'lost')
                    UNION ALL
                    SELECT user_id, bet_amount FROM bet_record_k3s
                    WHERE created_at BETWEEN :start AND :end AND status IN ('won', 'lost')
                    UNION ALL
                    SELECT user_id, bet_amount FROM bet_record_trx_wix
                    WHERE created_at BETWEEN :start AND :end AND status IN ('won', 'lost')
                ) b
                JOIN users u ON b.user_id = u.user_id
                LEFT JOIN users r ON u.referral_code = r.referring_code
                WHERE u.referral_code IS NOT NULL AND r.user_id IS NOT NULL
                GROUP BY b.user_id, u.user_name, u.referral_code, r.user_id, r.user_name
                ORDER BY total_bet DESC
                LIMIT 5
            `, {
                replacements: { start: todayStart, end: todayEnd },
                type: sequelize.QueryTypes.SELECT
            });
            
            if (usersWithReferrers.length > 0) {
                console.log('\n👥 USERS WHO BET TODAY (with referrers):');
                usersWithReferrers.forEach((user, index) => {
                    console.log(`   ${index + 1}. User ${user.user_id} (${user.user_name}) bet ₹${user.total_bet} → Referrer: ${user.referrer_id} (${user.referrer_name})`);
                });
            } else {
                console.log('\n⚠️ No users with referrers bet today');
                console.log('   This explains why no commissions were generated');
            }
        }
        
        console.log('\n✅ TODAY\'S REBATE TEST COMPLETED!');
        
        // Clean up environment variable
        delete process.env.FORCE_REBATE_DATE;
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ ERROR IN TODAY\'S REBATE TEST:');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Execute the test
console.log('🎮 DIUWIN REBATE SYSTEM - TODAY\'S TEST');
console.log('Processing current date betting activity...\n');

testRebateToday();
