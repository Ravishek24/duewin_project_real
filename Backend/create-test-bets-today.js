// create-test-bets-today.js - Create test betting data for today and process rebates

async function createTestBetsAndProcess() {
    try {
        console.log('🎯 CREATE TEST BETS + PROCESS REBATES');
        console.log('=' .repeat(50));
        
        const moment = require('moment-timezone');
        const { sequelize } = require('./config/db');
        const { getModels } = require('./models');
        
        // Get current IST time for today
        const todayIST = moment().tz('Asia/Kolkata');
        const testTime = todayIST.clone().subtract(2, 'hours').toDate(); // 2 hours ago today
        
        console.log(`📅 Creating test bets for: ${todayIST.format('YYYY-MM-DD')}`);
        console.log(`⏰ Test bet time: ${moment(testTime).format('YYYY-MM-DD HH:mm:ss')}`);
        
        // Step 1: Find users with referrers
        console.log('\n🔍 STEP 1: FINDING USERS WITH REFERRERS...');
        
        const [usersWithReferrers] = await sequelize.query(`
            SELECT 
                u.user_id,
                u.user_name,
                u.referral_code,
                r.user_id as referrer_id,
                r.user_name as referrer_name
            FROM users u
            JOIN users r ON u.referral_code = r.referring_code
            WHERE u.referral_code IS NOT NULL
            ORDER BY u.user_id
            LIMIT 10
        `, {
            type: sequelize.QueryTypes.SELECT
        });
        
        if (usersWithReferrers.length === 0) {
            console.log('❌ No users with referrers found. Cannot test rebate system.');
            process.exit(1);
        }
        
        console.log(`✅ Found ${usersWithReferrers.length} users with referrers:`);
        usersWithReferrers.forEach(user => {
            console.log(`   User ${user.user_id} (${user.user_name}) → Referrer ${user.referrer_id} (${user.referrer_name})`);
        });
        
        // Step 2: Create test bets
        console.log('\n🎲 STEP 2: CREATING TEST BETS...');
        
        const transaction = await sequelize.transaction();
        const testBets = [];
        
        try {
            for (let i = 0; i < Math.min(5, usersWithReferrers.length); i++) {
                const user = usersWithReferrers[i];
                const betAmount = (i + 1) * 500; // ₹500, ₹1000, ₹1500, etc.
                const periodId = moment().format('YYYYMMDDHHMMSS') + (i + 1).toString().padStart(3, '0');
                
                await sequelize.query(`
                    INSERT INTO bet_record_wingos (
                        user_id, period_id, bet_amount, bet_type, 
                        selected_number, status, created_at, updated_at
                    ) VALUES (
                        :userId, :periodId, :betAmount, 'number', 
                        :number, 'lost', :createdAt, :updatedAt
                    )
                `, {
                    replacements: {
                        userId: user.user_id,
                        periodId: periodId,
                        betAmount: betAmount,
                        number: (i % 10).toString(),
                        createdAt: testTime,
                        updatedAt: testTime
                    },
                    transaction
                });
                
                testBets.push({
                    user_id: user.user_id,
                    user_name: user.user_name,
                    referrer_id: user.referrer_id,
                    referrer_name: user.referrer_name,
                    bet_amount: betAmount,
                    period_id: periodId
                });
                
                console.log(`   ✅ Created ₹${betAmount} bet for user ${user.user_id} → will generate commission for user ${user.referrer_id}`);
            }
            
            await transaction.commit();
            console.log(`\n🎯 Created ${testBets.length} test bets successfully!`);
            
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
        
        // Step 3: Record wallet balances before
        console.log('\n💰 STEP 3: RECORDING BALANCES BEFORE PROCESSING...');
        
        const models = await getModels();
        const referrerIds = [...new Set(testBets.map(bet => bet.referrer_id))];
        const balancesBefore = {};
        
        for (const referrerId of referrerIds) {
            const referrer = await models.User.findByPk(referrerId, {
                attributes: ['user_id', 'user_name', 'wallet_balance']
            });
            balancesBefore[referrerId] = {
                name: referrer.user_name,
                balance: parseFloat(referrer.wallet_balance)
            };
            console.log(`   User ${referrerId} (${referrer.user_name}): ₹${referrer.wallet_balance}`);
        }
        
        // Step 4: Process rebates
        console.log('\n⚡ STEP 4: PROCESSING REBATES...');
        
        // Set environment variable to force today's date
        process.env.FORCE_REBATE_DATE = todayIST.format('YYYY-MM-DD');
        
        const startTime = Date.now();
        const { processDailyRebates } = require('./scripts/masterCronJobs');
        
        console.log('🔄 Running rebate processing...');
        await processDailyRebates();
        
        const processingTime = Date.now() - startTime;
        console.log(`✅ Rebate processing completed in ${processingTime}ms`);
        
        // Step 5: Check results
        console.log('\n📊 STEP 5: CHECKING RESULTS...');
        
        const { Op } = require('sequelize');
        
        // Check new commissions
        const newCommissions = await models.ReferralCommission.findAll({
            where: {
                created_at: {
                    [Op.gte]: new Date(startTime)
                }
            },
            attributes: ['user_id', 'referred_user_id', 'amount', 'rebate_type', 'level'],
            order: [['amount', 'DESC']]
        });
        
        // Check new transactions
        const newTransactions = await models.Transaction.findAll({
            where: {
                type: 'rebate',
                created_at: {
                    [Op.gte]: new Date(startTime)
                }
            },
            attributes: ['user_id', 'amount', 'description'],
            order: [['amount', 'DESC']]
        });
        
        console.log(`💰 Commissions created: ${newCommissions.length}`);
        console.log(`📝 Transaction records: ${newTransactions.length}`);
        
        if (newCommissions.length > 0) {
            const totalCommission = newCommissions.reduce((sum, comm) => sum + parseFloat(comm.amount), 0);
            console.log(`💸 Total commission: ₹${totalCommission.toFixed(6)}`);
            
            console.log('\n🏆 COMMISSION DETAILS:');
            newCommissions.forEach(comm => {
                const testBet = testBets.find(bet => bet.user_id === comm.referred_user_id && bet.referrer_id === comm.user_id);
                if (testBet) {
                    const commissionRate = (parseFloat(comm.amount) / testBet.bet_amount * 100).toFixed(4);
                    console.log(`   User ${comm.user_id} earned ₹${comm.amount} from ₹${testBet.bet_amount} bet (${commissionRate}% rate)`);
                }
            });
        }
        
        // Check wallet changes
        console.log('\n💳 WALLET CHANGES:');
        for (const referrerId of referrerIds) {
            const referrerAfter = await models.User.findByPk(referrerId, {
                attributes: ['wallet_balance']
            });
            
            const balanceBefore = balancesBefore[referrerId].balance;
            const balanceAfter = parseFloat(referrerAfter.wallet_balance);
            const change = balanceAfter - balanceBefore;
            
            console.log(`   User ${referrerId} (${balancesBefore[referrerId].name}):`);
            console.log(`     Before: ₹${balanceBefore.toFixed(2)}`);
            console.log(`     After:  ₹${balanceAfter.toFixed(2)}`);
            console.log(`     Change: ₹${change.toFixed(6)} ${change > 0 ? '✅' : '❌'}`);
        }
        
        console.log('\n🧹 CLEANUP:');
        console.log('To remove test bets, run:');
        testBets.forEach(bet => {
            console.log(`DELETE FROM bet_record_wingos WHERE period_id = '${bet.period_id}';`);
        });
        
        console.log('\n✅ TEST COMPLETED SUCCESSFULLY!');
        console.log('🎯 Rebate system is working and creating commissions + transactions');
        
        // Clean up environment variable
        delete process.env.FORCE_REBATE_DATE;
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ ERROR IN TEST:');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

// Execute the test
console.log('🎮 DIUWIN REBATE SYSTEM - COMPLETE TEST');
console.log('Creating test bets and processing rebates...\n');

createTestBetsAndProcess();
