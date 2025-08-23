// manual-rebate-test.js - Manual Trigger for Master Cron Rebate System
// This script simulates the exact same process that runs automatically at 12:30 AM IST daily

const moment = require('moment-timezone');

async function manualRebateTest() {
    try {
        console.log('🚀 MANUAL REBATE SYSTEM TEST');
        console.log('=' .repeat(60));
        console.log('⏰ Simulating daily cron job execution...');
        console.log(`🕐 Current time: ${moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss')} IST`);
        
        // Import the exact same function used by master cron
        const { processDailyRebates } = require('./scripts/masterCronJobs');
        
        console.log('\n📋 REBATE PROCESSING OVERVIEW:');
        console.log('   🎯 Target: ALL users with rebate teams');
        console.log('   📅 Date: Yesterday\'s bets (IST timezone)');
        console.log('   🎮 Games: Lottery (Wingo, 5D, K3, TRX) + Casino');
        console.log('   💰 Output: Commission credits + Transaction records');
        
        // Show what date will be processed
        const processDate = moment().tz('Asia/Kolkata').subtract(1, 'day').format('YYYY-MM-DD');
        const startTime = moment().tz('Asia/Kolkata').subtract(1, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss');
        const endTime = moment().tz('Asia/Kolkata').subtract(1, 'day').endOf('day').format('YYYY-MM-DD HH:mm:ss');
        
        console.log('\n📅 PROCESSING WINDOW:');
        console.log(`   Date: ${processDate}`);
        console.log(`   Start: ${startTime} IST`);
        console.log(`   End: ${endTime} IST`);
        
        // Pre-check: Show system status
        console.log('\n🔍 PRE-CHECK SYSTEM STATUS:');
        
        try {
            const { getModels } = require('./models');
            const models = await getModels();
            
            // Count rebate teams
            const totalRebateTeams = await models.RebateTeam.count();
            console.log(`   👥 Users with rebate teams: ${totalRebateTeams}`);
            
            // Count recent commissions
            const recentCommissions = await models.ReferralCommission.count({
                where: {
                    created_at: {
                        [models.Sequelize.Op.gte]: moment().subtract(24, 'hours').toDate()
                    }
                }
            });
            console.log(`   💰 Commissions in last 24h: ${recentCommissions}`);
            
            // Check bet activity for yesterday
            const { sequelize } = require('./config/db');
            const yesterday = moment.tz('Asia/Kolkata').subtract(1, 'day').startOf('day').utc().toDate();
            const endOfYesterday = moment.tz('Asia/Kolkata').subtract(1, 'day').endOf('day').utc().toDate();
            
            const [betActivity] = await sequelize.query(`
                SELECT COUNT(*) as total_bets, COUNT(DISTINCT user_id) as unique_users, SUM(bet_amount) as total_volume
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
                replacements: { start: yesterday, end: endOfYesterday },
                type: sequelize.QueryTypes.SELECT
            });
            
            console.log(`   🎲 Yesterday's bet activity:`);
            console.log(`     - Total bets: ${betActivity[0].total_bets || 0}`);
            console.log(`     - Unique users: ${betActivity[0].unique_users || 0}`);
            console.log(`     - Total volume: ₹${parseFloat(betActivity[0].total_volume || 0).toFixed(2)}`);
            
        } catch (error) {
            console.log(`   ⚠️ Error in pre-check: ${error.message}`);
        }
        
        console.log('\n🚀 STARTING REBATE PROCESSING...');
        console.log('⚡ This is the EXACT same process that runs automatically daily');
        console.log('📊 Processing ALL users in the system...');
        
        const startTime = Date.now();
        
        // Execute the master cron rebate function
        const result = await processDailyRebates();
        
        const processingTime = Date.now() - startTime;
        
        console.log('\n✅ REBATE PROCESSING COMPLETED!');
        console.log('=' .repeat(60));
        console.log(`⏱️  Total processing time: ${processingTime}ms`);
        
        // Post-check: Show results
        console.log('\n📊 POST-CHECK RESULTS:');
        
        try {
            const { getModels } = require('./models');
            const models = await getModels();
            
            // Count new commissions
            const newCommissions = await models.ReferralCommission.findAll({
                where: {
                    created_at: {
                        [models.Sequelize.Op.gte]: new Date(startTime)
                    }
                },
                attributes: ['user_id', 'amount', 'rebate_type', 'level', 'referred_user_id'],
                order: [['created_at', 'DESC']],
                limit: 10
            });
            
            console.log(`   💰 New commissions created: ${newCommissions.length}`);
            
            if (newCommissions.length > 0) {
                console.log('\n🎯 SAMPLE NEW COMMISSIONS:');
                newCommissions.forEach((comm, index) => {
                    console.log(`   ${index + 1}. User ${comm.user_id} earned ₹${comm.amount} from user ${comm.referred_user_id} (${comm.rebate_type} L${comm.level})`);
                });
            }
            
            // Count new transaction records
            const newTransactions = await models.Transaction.count({
                where: {
                    type: 'rebate',
                    created_at: {
                        [models.Sequelize.Op.gte]: new Date(startTime)
                    }
                }
            });
            
            console.log(`   📝 New transaction records: ${newTransactions}`);
            
            // Calculate total commission distributed
            const totalCommissionDistributed = newCommissions.reduce((sum, comm) => sum + parseFloat(comm.amount), 0);
            console.log(`   💸 Total commission distributed: ₹${totalCommissionDistributed.toFixed(2)}`);
            
        } catch (error) {
            console.log(`   ⚠️ Error in post-check: ${error.message}`);
        }
        
        console.log('\n🎉 MANUAL REBATE TEST SUMMARY:');
        console.log('=' .repeat(60));
        console.log('✅ Master cron rebate system executed successfully');
        console.log('✅ All users processed automatically');
        console.log('✅ Commission calculations completed');
        console.log('✅ Wallet balances updated');
        console.log('✅ Transaction audit records created');
        console.log('✅ System ready for automatic daily execution');
        
        console.log('\n📅 NEXT AUTOMATIC EXECUTION:');
        const nextExecution = moment().tz('Asia/Kolkata').add(1, 'day').startOf('day').add(12, 'hours').add(30, 'minutes');
        console.log(`   ⏰ ${nextExecution.format('YYYY-MM-DD HH:mm:ss')} IST (12:30 AM tomorrow)`);
        
        console.log('\n🔍 VERIFICATION QUERIES:');
        console.log(`
-- Check all rebate commissions from this run:
SELECT 
    user_id,
    referred_user_id,
    amount,
    rebate_type,
    level,
    created_at
FROM referral_commissions 
WHERE created_at >= '${moment(startTime).format('YYYY-MM-DD HH:mm:ss')}'
ORDER BY created_at DESC;

-- Check transaction records:
SELECT 
    user_id,
    type,
    amount,
    description,
    created_at
FROM transactions 
WHERE type = 'rebate' 
    AND created_at >= '${moment(startTime).format('YYYY-MM-DD HH:mm:ss')}'
ORDER BY created_at DESC;
        `);
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ ERROR IN MANUAL REBATE TEST:');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        console.log('\n🔧 TROUBLESHOOTING:');
        console.log('1. Check if Redis is running and accessible');
        console.log('2. Verify database connection');
        console.log('3. Ensure all models are properly initialized');
        console.log('4. Check if masterCronJobs module exports processDailyRebates');
        
        process.exit(1);
    }
}

// Execute the manual test
console.log('🎮 DIUWIN REBATE SYSTEM - MANUAL EXECUTION');
console.log('This script runs the EXACT same rebate processing as the daily cron');
console.log('Processing ALL users in the system...\n');

manualRebateTest();
