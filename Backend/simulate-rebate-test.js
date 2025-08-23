// simulate-rebate-test.js - Simulate Bet Placement and Test Rebate Processing
const { sequelize } = require('./config/db');
const { getModels } = require('./models');
const moment = require('moment-timezone');

async function simulateRebateTest() {
    try {
        console.log('🎮 SIMULATING REBATE TEST');
        console.log('=' .repeat(50));
        
        const models = await getModels();
        
        // Configuration
        const TEST_USER_ID = 190;
        const TEST_BET_AMOUNT = 1000; // ₹1000 bet
        const GAME_TYPE = 'wingo'; // Test with wingo game
        
        console.log(`\n🎯 TEST SETUP:`);
        console.log(`   User ID: ${TEST_USER_ID}`);
        console.log(`   Bet Amount: ₹${TEST_BET_AMOUNT}`);
        console.log(`   Game Type: ${GAME_TYPE}`);
        
        // 1. Get user details
        const testUser = await models.User.findByPk(TEST_USER_ID, {
            attributes: ['user_id', 'user_name', 'referral_code', 'referring_code', 'wallet_balance']
        });
        
        if (!testUser) {
            console.log(`❌ User ${TEST_USER_ID} not found`);
            return;
        }
        
        console.log(`\n👤 TEST USER:`, {
            id: testUser.user_id,
            name: testUser.user_name,
            wallet: testUser.wallet_balance,
            referred_by: testUser.referral_code || 'None',
            own_code: testUser.referring_code
        });
        
        // 2. Find referrer (who will earn commission)
        let referrer = null;
        let referrerTeam = null;
        let expectedCommission = 0;
        
        if (testUser.referral_code) {
            referrer = await models.User.findOne({
                where: { referring_code: testUser.referral_code },
                attributes: ['user_id', 'user_name', 'wallet_balance']
            });
            
            if (referrer) {
                referrerTeam = await models.RebateTeam.findOne({
                    where: { user_id: referrer.user_id }
                });
                
                // Get rebate level details
                const rebateLevels = await models.RebateLevel.findAll();
                const currentLevel = rebateLevels.find(level => level.level === referrerTeam.current_rebet_level.toString()) || rebateLevels[0];
                
                // Calculate expected commission
                const rebateRate = parseFloat(currentLevel.lottery_l1_rebate) / 100; // Convert percentage to decimal
                expectedCommission = TEST_BET_AMOUNT * rebateRate;
                
                console.log(`\n💰 REFERRER (Commission Earner):`, {
                    id: referrer.user_id,
                    name: referrer.user_name,
                    current_wallet: referrer.wallet_balance,
                    rebate_level: referrerTeam.current_rebet_level,
                    rebate_rate: `${currentLevel.lottery_l1_rebate}%`,
                    expected_commission: `₹${expectedCommission.toFixed(6)}`
                });
            }
        } else {
            console.log(`\n⚠️ User ${TEST_USER_ID} has no referrer - won't generate commission`);
        }
        
        // 3. Simulate bet record creation
        console.log(`\n🎲 STEP 1: SIMULATE BET PLACEMENT`);
        
        const transaction = await sequelize.transaction();
        
        try {
            // Create a test bet record in wingo table
            const testPeriod = moment().format('YYYYMMDDHHMMSS') + '001';
            const betId = `test_${Date.now()}`;
            
            await sequelize.query(`
                INSERT INTO bet_record_wingos (
                    user_id, 
                    period_id, 
                    bet_amount, 
                    bet_type, 
                    selected_number, 
                    status, 
                    created_at, 
                    updated_at
                ) VALUES (
                    :userId, 
                    :periodId, 
                    :betAmount, 
                    'number', 
                    '5', 
                    'lost', 
                    :createdAt, 
                    :updatedAt
                )
            `, {
                replacements: {
                    userId: TEST_USER_ID,
                    periodId: testPeriod,
                    betAmount: TEST_BET_AMOUNT,
                    createdAt: moment().subtract(1, 'day').toDate(), // Yesterday for cron processing
                    updatedAt: moment().subtract(1, 'day').toDate()
                },
                transaction
            });
            
            await transaction.commit();
            console.log(`✅ Test bet created: ₹${TEST_BET_AMOUNT} on ${GAME_TYPE} (period: ${testPeriod})`);
            
        } catch (error) {
            await transaction.rollback();
            console.error(`❌ Error creating test bet:`, error.message);
            return;
        }
        
        // 4. Record wallet balances before rebate processing
        const walletBeforeReferrer = referrer ? referrer.wallet_balance : 0;
        
        console.log(`\n📊 STEP 2: RECORD BALANCES BEFORE PROCESSING`);
        console.log(`   User ${TEST_USER_ID} wallet: ₹${testUser.wallet_balance}`);
        if (referrer) {
            console.log(`   Referrer ${referrer.user_id} wallet: ₹${walletBeforeReferrer}`);
        }
        
        // 5. Test rebate processing
        console.log(`\n⚡ STEP 3: PROCESS REBATE COMMISSION`);
        
        try {
            // Import and run rebate service
            const enhancedRebateService = require('./services/enhancedRebateService');
            const testDate = moment().subtract(1, 'day').format('YYYY-MM-DD');
            
            console.log(`🔄 Running rebate processing for date: ${testDate}`);
            
            const result = await enhancedRebateService.processDailyRebateCommissions(testDate);
            
            if (result.success) {
                console.log(`✅ Rebate processing completed:`);
                console.log(`   Processed users: ${result.processedUsers}`);
                console.log(`   Total commission: ₹${result.totalCommission.toFixed(2)}`);
                console.log(`   Processing time: ${result.processingTime}ms`);
                console.log(`   Errors: ${result.errors.length}`);
                
                if (result.errors.length > 0) {
                    console.log(`⚠️ Errors occurred:`);
                    result.errors.slice(0, 3).forEach(error => {
                        console.log(`   - User ${error.userId}: ${error.error}`);
                    });
                }
            } else {
                console.log(`❌ Rebate processing failed: ${result.error}`);
            }
            
        } catch (error) {
            console.log(`❌ Error running rebate processing: ${error.message}`);
        }
        
        // 6. Check results
        console.log(`\n🔍 STEP 4: VERIFY RESULTS`);
        
        // Refresh referrer data
        if (referrer) {
            const referrerAfter = await models.User.findByPk(referrer.user_id, {
                attributes: ['wallet_balance']
            });
            
            const walletDifference = parseFloat(referrerAfter.wallet_balance) - parseFloat(walletBeforeReferrer);
            
            console.log(`💳 WALLET CHANGES:`);
            console.log(`   Referrer ${referrer.user_id}:`);
            console.log(`     Before: ₹${walletBeforeReferrer}`);
            console.log(`     After:  ₹${referrerAfter.wallet_balance}`);
            console.log(`     Change: ₹${walletDifference.toFixed(6)}`);
            console.log(`     Expected: ₹${expectedCommission.toFixed(6)}`);
            
            if (Math.abs(walletDifference - expectedCommission) < 0.001) {
                console.log(`✅ SUCCESS: Commission matches expected amount!`);
            } else if (walletDifference > 0) {
                console.log(`⚠️ Commission received but amount differs from expected`);
            } else {
                console.log(`❌ No commission received`);
            }
        }
        
        // Check commission records
        const newCommissions = await models.ReferralCommission.findAll({
            where: {
                referred_user_id: TEST_USER_ID,
                created_at: {
                    [models.Sequelize.Op.gte]: moment().subtract(1, 'hour').toDate()
                }
            },
            order: [['created_at', 'DESC']],
            limit: 5
        });
        
        console.log(`\n📋 NEW COMMISSION RECORDS (${newCommissions.length}):`);
        newCommissions.forEach(comm => {
            console.log(`   User ${comm.user_id} earned ₹${comm.amount} from user ${comm.referred_user_id} (${comm.rebate_type} L${comm.level})`);
        });
        
        // 7. Cleanup (optional)
        console.log(`\n🧹 CLEANUP OPTIONS:`);
        console.log(`To remove test bet record, run:`);
        console.log(`DELETE FROM bet_record_wingos WHERE period_id = '${testPeriod}';`);
        
        console.log(`\n✅ Rebate simulation test complete!`);
        
        // Summary
        console.log(`\n📈 TEST SUMMARY:`);
        console.log(`   🎯 Bet Amount: ₹${TEST_BET_AMOUNT}`);
        console.log(`   💰 Expected Commission: ₹${expectedCommission.toFixed(6)}`);
        console.log(`   📊 Commission Records: ${newCommissions.length}`);
        console.log(`   ✅ System Status: ${newCommissions.length > 0 ? 'WORKING' : 'NEEDS INVESTIGATION'}`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error in rebate simulation:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

simulateRebateTest();
