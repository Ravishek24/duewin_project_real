// test-rebate-system.js - Comprehensive Rebate System Testing
const { sequelize } = require('./config/db');
const { getModels } = require('./models');
const moment = require('moment-timezone');

async function testRebateSystem() {
    try {
        console.log('🧪 REBATE SYSTEM TESTING');
        console.log('=' .repeat(50));
        
        const models = await getModels();
        
        // 1. Check test user setup
        console.log('\n📋 STEP 1: VERIFY TEST USER SETUP');
        const testUser = await models.User.findOne({
            where: { user_id: 190 },
            attributes: ['user_id', 'user_name', 'referring_code', 'referral_code', 'wallet_balance']
        });
        
        if (!testUser) {
            console.log('❌ User 190 not found');
            return;
        }
        
        console.log('✅ Test User 190:', {
            user_id: testUser.user_id,
            user_name: testUser.user_name,
            referring_code: testUser.referring_code,
            referral_code: testUser.referral_code,
            wallet_balance: testUser.wallet_balance
        });
        
        // 2. Check rebate team setup
        const rebateTeam = await models.RebateTeam.findOne({
            where: { user_id: 190 }
        });
        
        if (!rebateTeam) {
            console.log('❌ User 190 has no rebate team entry');
            return;
        }
        
        console.log('✅ Rebate Team Data:', {
            current_rebet_level: rebateTeam.current_rebet_level,
            current_team_number: rebateTeam.current_team_number,
            level_1_count: rebateTeam.level_1_count,
            current_team_betting: rebateTeam.current_team_betting
        });
        
        // 3. Check referrer (if user 190 was referred by someone)
        let referrer = null;
        if (testUser.referral_code) {
            referrer = await models.User.findOne({
                where: { referring_code: testUser.referral_code },
                attributes: ['user_id', 'user_name', 'wallet_balance']
            });
            
            if (referrer) {
                console.log('✅ Referrer found:', {
                    user_id: referrer.user_id,
                    user_name: referrer.user_name,
                    wallet_balance: referrer.wallet_balance
                });
                
                // Check referrer's rebate team
                const referrerTeam = await models.RebateTeam.findOne({
                    where: { user_id: referrer.user_id }
                });
                
                if (referrerTeam) {
                    console.log('✅ Referrer Team:', {
                        rebate_level: referrerTeam.current_rebet_level,
                        team_count: referrerTeam.current_team_number,
                        level_1_count: referrerTeam.level_1_count
                    });
                }
            }
        }
        
        // 4. Check downline (users referred by 190)
        const downlineUsers = await models.User.findAll({
            where: { referral_code: testUser.referring_code },
            attributes: ['user_id', 'user_name', 'created_at'],
            limit: 5
        });
        
        console.log(`✅ User 190's Downline: ${downlineUsers.length} users`);
        downlineUsers.forEach(user => {
            console.log(`   - User ${user.user_id}: ${user.user_name} (registered: ${user.created_at})`);
        });
        
        // 5. Check recent bet records for user 190
        console.log('\n📋 STEP 2: CHECK RECENT BET ACTIVITY');
        
        const yesterday = moment.tz('Asia/Kolkata').subtract(1, 'day').startOf('day').utc().toDate();
        const endOfYesterday = moment.tz('Asia/Kolkata').subtract(1, 'day').endOf('day').utc().toDate();
        
        // Check lottery bets
        const [lotteryBets] = await sequelize.query(`
            SELECT user_id, SUM(bet_amount) as total_bet_amount, COUNT(*) as bet_count
            FROM (
                SELECT user_id, bet_amount FROM bet_record_wingos 
                WHERE user_id = 190 AND created_at BETWEEN :start AND :end AND status IN ('won', 'lost')
                UNION ALL
                SELECT user_id, bet_amount FROM bet_record_5ds
                WHERE user_id = 190 AND created_at BETWEEN :start AND :end AND status IN ('won', 'lost')
                UNION ALL
                SELECT user_id, bet_amount FROM bet_record_k3s
                WHERE user_id = 190 AND created_at BETWEEN :start AND :end AND status IN ('won', 'lost')
                UNION ALL
                SELECT user_id, bet_amount FROM bet_record_trx_wix
                WHERE user_id = 190 AND created_at BETWEEN :start AND :end AND status IN ('won', 'lost')
            ) as combined_bets
            GROUP BY user_id
        `, {
            replacements: { start: yesterday, end: endOfYesterday },
            type: sequelize.QueryTypes.SELECT
        });
        
        console.log('📊 Yesterday\'s Lottery Bets:', lotteryBets.length > 0 ? {
            total_amount: lotteryBets[0].total_bet_amount,
            bet_count: lotteryBets[0].bet_count
        } : 'No bets found');
        
        // 6. Check recent commissions
        console.log('\n📋 STEP 3: CHECK RECENT COMMISSIONS');
        
        const recentCommissions = await models.ReferralCommission.findAll({
            where: {
                [models.Sequelize.Op.or]: [
                    { user_id: 190 },           // Commissions earned by user 190
                    { referred_user_id: 190 }   // Commissions generated from user 190's bets
                ]
            },
            order: [['created_at', 'DESC']],
            limit: 10,
            attributes: ['user_id', 'referred_user_id', 'amount', 'rebate_type', 'level', 'created_at']
        });
        
        console.log(`📈 Recent Commissions (${recentCommissions.length}):`);
        recentCommissions.forEach(comm => {
            console.log(`   - ${comm.user_id} earned ₹${comm.amount} from user ${comm.referred_user_id} (${comm.rebate_type} L${comm.level}) - ${comm.created_at}`);
        });
        
        // 7. Recommend test actions
        console.log('\n📋 STEP 4: RECOMMENDED TEST ACTIONS');
        console.log('🎯 To test rebate system:');
        
        if (downlineUsers.length > 0) {
            console.log(`✅ 1. Have users ${downlineUsers.map(u => u.user_id).join(', ')} place lottery bets`);
            console.log('✅ 2. Wait for daily rebate cron (12:30 AM IST) or run manual test');
            console.log(`✅ 3. Check if user ${testUser.user_id} receives commission`);
        } else {
            console.log('⚠️  1. User 190 has no downline - register new users with referral code:', testUser.referring_code);
            console.log('⚠️  2. Have those new users place bets');
            console.log('⚠️  3. Then test rebate processing');
        }
        
        if (referrer) {
            console.log(`✅ 4. Have user 190 place bets to generate commission for user ${referrer.user_id}`);
        }
        
        console.log('\n🧪 MANUAL TEST COMMANDS:');
        console.log(`
// Test rebate processing for specific date:
cd Backend
FORCE_REBATE_DATE=2025-08-17 node -e "
const { processDailyRebates } = require('./scripts/masterCronJobs');
processDailyRebates().then(() => process.exit(0)).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
"

// Check user 190's wallet before/after:
cd Backend && node -e "
const { getModels } = require('./models');
getModels().then(models => {
  return models.User.findByPk(190, { attributes: ['wallet_balance'] });
}).then(user => {
  console.log('User 190 wallet:', user.wallet_balance);
  process.exit(0);
});
"
        `);
        
        console.log('\n✅ Rebate system test analysis complete!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error in rebate system test:', error.message);
        process.exit(1);
    }
}

testRebateSystem();
