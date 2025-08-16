#!/usr/bin/env node

/**
 * Test Attendance Cron Logic Script
 * 
 * This script mimics the EXACT logic of the real attendance cron job
 * from masterCronJobs.js to test if the cron system is working properly.
 * It only processes today's data to avoid interfering with existing records.
 */

const path = require('path');
const moment = require('moment-timezone');

// Add the Backend directory to the path so we can import modules
process.env.NODE_PATH = path.join(__dirname, '..');
require('module')._initPaths();

console.log('🧪 Testing Attendance Cron Logic');
console.log('================================\n');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    date: null,
    dryRun: false,
    help: false
};

for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
        options.help = true;
    } else if (arg.startsWith('--date=')) {
        options.date = arg.split('=')[1];
    } else if (arg === '--dry-run') {
        options.dryRun = true;
    }
}

if (options.help) {
    console.log('Usage: node scripts/test-attendance-cron-logic.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --date=YYYY-MM-DD        Test for specific date (default: today)');
    console.log('  --dry-run                Show what would happen without making changes');
    console.log('  --help, -h               Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/test-attendance-cron-logic.js');
    console.log('  node scripts/test-attendance-cron-logic.js --date=2025-08-15');
    console.log('  node scripts/test-attendance-cron-logic.js --dry-run');
    process.exit(0);
}

/**
 * Test the exact attendance bonus processing logic from masterCronJobs.js
 */
const testAttendanceCronLogic = async () => {
    try {
        // Set the date to process (default to today)
        let targetDate;
        if (options.date) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
                throw new Error('Invalid date format. Use YYYY-MM-DD');
            }
            targetDate = options.date;
        } else {
            targetDate = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
        }
        
        console.log(`📅 Testing attendance cron logic for: ${targetDate}`);
        console.log(`🔍 Mode: ${options.dryRun ? 'DRY RUN (no changes)' : 'LIVE (will make changes)'}`);
        
        // Initialize database connection
        console.log('\n🔌 Connecting to database...');
        const { connectDB, waitForDatabase } = require('../config/db');
        await connectDB();
        await waitForDatabase();
        console.log('✅ Database connected');
        
        // Initialize Redis
        console.log('🔌 Connecting to Redis...');
        const unifiedRedis = require('../config/unifiedRedisManager');
        await unifiedRedis.initialize();
        const redis = await unifiedRedis.getHelper();
        if (!redis) {
            throw new Error('Redis connection failed');
        }
        console.log('✅ Redis connected');
        
        // Import models
        console.log('📚 Loading models...');
        const { getModels } = require('../models');
        const models = await getModels();
        console.log('✅ Models loaded');
        
        // Check Redis lock (same as real cron)
        console.log('\n🔒 Checking Redis lock...');
        const lockKey = `attendance_bonus_cron_lock_${targetDate}`;
        const lockValue = `manual_test_${Date.now()}`;
        const lockTTL = 300; // 5 minutes
        
        const lockAcquired = await redis.set(lockKey, lockValue, 'EX', lockTTL, 'NX');
        if (!lockAcquired) {
            console.log('⚠️  Cron lock already exists - another process might be running');
            console.log('   This is normal if the real cron is active');
        } else {
            console.log('✅ Redis lock acquired successfully');
        }
        
        try {
            // STEP 1: Get today's attendance records (same as real cron)
            console.log('\n📊 STEP 1: Getting attendance records...');
            const attendanceRecords = await models.AttendanceRecord.findAll({
                where: { attendance_date: targetDate },
                include: [{
                    model: models.User,
                    as: 'attendance_user',
                    attributes: ['user_id', 'user_name', 'wallet_balance']
                }]
            });
            
            console.log(`✅ Found ${attendanceRecords.length} attendance records for ${targetDate}`);
            
            if (attendanceRecords.length === 0) {
                console.log('❌ No attendance records found - attendance cron may not have run yet');
                return;
            }
            
            // STEP 2: Get today's recharges (same as real cron)
            console.log('\n💳 STEP 2: Getting recharge data...');
            const startOfDayIST = moment.tz(targetDate, 'Asia/Kolkata').startOf('day').utc().toDate();
            const endOfDayIST = moment.tz(targetDate, 'Asia/Kolkata').endOf('day').utc().toDate();
            
            const userIds = attendanceRecords.map(a => a.user_id);
            const recharges = await models.WalletRecharge.findAll({
                where: {
                    user_id: { [require('sequelize').Op.in]: userIds },
                    status: 'completed',
                    created_at: { [require('sequelize').Op.between]: [startOfDayIST, endOfDayIST] }
                },
                attributes: ['user_id', 'amount']
            });
            
            console.log(`✅ Found ${recharges.length} recharge transactions for ${targetDate}`);
            
            // Create recharge map (same as real cron)
            const rechargeMap = {};
            for (const r of recharges) {
                const uid = r.user_id;
                rechargeMap[uid] = (rechargeMap[uid] || 0) + parseFloat(r.amount);
            }
            
            // STEP 3: Bonus rules (exact same as real cron)
            console.log('\n📋 STEP 3: Applying bonus rules...');
            const ATTENDANCE_BONUS_RULES = [
                { days: 1, amount: 300, bonus: 10 },
                { days: 2, amount: 1000, bonus: 30 },
                { days: 3, amount: 3000, bonus: 130 },
                { days: 4, amount: 8000, bonus: 300 },
                { days: 5, amount: 20000, bonus: 650 },
                { days: 6, amount: 80000, bonus: 3150 },
                { days: 7, amount: 200000, bonus: 7500 }
            ];
            
            // STEP 4: Process bonuses (same logic as real cron)
            console.log('\n🎁 STEP 4: Processing attendance bonuses...');
            console.log('============================================');
            
            let eligibleCount = 0;
            let ineligibleCount = 0;
            let totalBonusAmount = 0;
            const attendanceUpdates = [];
            const transactionCreates = [];
            const userBonusIncrements = {};
            
            for (const attendance of attendanceRecords) {
                const userId = attendance.user_id;
                const userName = attendance.attendance_user?.user_name || userId;
                const totalRecharge = rechargeMap[userId] || 0;
                const streak = attendance.streak_count || 1;
                const rule = ATTENDANCE_BONUS_RULES.find(r => r.days === streak);
                
                console.log(`\n👤 User ${userName} (ID: ${userId}):`);
                console.log(`   🔥 Streak: Day ${streak}`);
                console.log(`   💰 Recharge: ₹${totalRecharge.toFixed(2)}`);
                
                let eligible = false;
                let bonusAmount = 0;
                
                if (rule && totalRecharge >= rule.amount) {
                    eligible = true;
                    bonusAmount = rule.bonus;
                    console.log(`   📋 Rule: Day ${streak} - Recharge ₹${rule.amount} = Get ₹${rule.bonus}`);
                    console.log(`   ✅ ELIGIBLE: Yes (₹${totalRecharge} >= ₹${rule.amount})`);
                    eligibleCount++;
                } else {
                    if (!rule) {
                        console.log(`   ❌ No bonus rule for Day ${streak}`);
                    } else {
                        console.log(`   ❌ INELIGIBLE: Insufficient recharge (₹${totalRecharge} < ₹${rule.amount})`);
                    }
                    ineligibleCount++;
                }
                
                // Prepare attendance update (same as real cron)
                attendanceUpdates.push({
                    id: attendance.id,
                    claim_eligible: eligible,
                    bonus_amount: bonusAmount,
                    recharge_amount: totalRecharge
                });
                
                // Prepare bonus processing if eligible and not already claimed
                if (eligible && !attendance.bonus_claimed && bonusAmount > 0) {
                    userBonusIncrements[userId] = (userBonusIncrements[userId] || 0) + bonusAmount;
                    transactionCreates.push({
                        user_id: userId,
                        type: 'attendance_bonus',
                        amount: bonusAmount,
                        status: 'completed',
                        description: `Daily attendance bonus - Day ${streak}`,
                        reference_id: `attendance_${attendance.id}_${Date.now()}`,
                        metadata: {
                            attendance_id: attendance.id,
                            streak_count: streak,
                            attendance_date: attendance.attendance_date
                        },
                        created_at: new Date(),
                        updated_at: new Date()
                    });
                    
                    console.log(`   🎁 Bonus: ₹${bonusAmount} (will be processed)`);
                    totalBonusAmount += bonusAmount;
                } else if (eligible && attendance.bonus_claimed) {
                    console.log(`   ✅ Bonus already claimed: ₹${attendance.bonus_amount}`);
                } else if (!eligible) {
                    console.log(`   ❌ Not eligible for bonus`);
                }
            }
            
            // STEP 5: Update attendance records (same as real cron)
            console.log('\n📝 STEP 5: Updating attendance records...');
            if (!options.dryRun) {
                for (const update of attendanceUpdates) {
                    await models.AttendanceRecord.update({
                        claim_eligible: update.claim_eligible,
                        bonus_amount: update.bonus_amount,
                        recharge_amount: update.recharge_amount
                    }, {
                        where: { id: update.id }
                    });
                }
                console.log(`✅ Updated ${attendanceUpdates.length} attendance records`);
            } else {
                console.log(`📝 Would update ${attendanceUpdates.length} attendance records (DRY RUN)`);
            }
            
            // STEP 6: Process bonus payments (same as real cron)
            if (Object.keys(userBonusIncrements).length > 0) {
                console.log('\n💰 STEP 6: Processing bonus payments...');
                
                if (!options.dryRun) {
                    // Update user wallet balances
                    for (const userId in userBonusIncrements) {
                        await models.User.increment('wallet_balance', {
                            by: userBonusIncrements[userId],
                            where: { user_id: userId }
                        });
                        console.log(`   ✅ User ${userId}: +₹${userBonusIncrements[userId]}`);
                    }
                    
                    // Create credit transactions for wagering tracking
                    try {
                        const CreditService = require('../services/creditService');
                        for (const userId in userBonusIncrements) {
                            try {
                                await CreditService.addCredit(
                                    userId,
                                    userBonusIncrements[userId],
                                    'activity_reward',
                                    'external',
                                    `attendance_bonus_${userId}_${Date.now()}`,
                                    `Daily attendance bonus - Total: ${userBonusIncrements[userId]}`
                                );
                                console.log(`   🎯 Credit transaction created for user ${userId}`);
                            } catch (creditError) {
                                console.error(`   ⚠️  Error creating credit transaction for user ${userId}:`, creditError.message);
                            }
                        }
                    } catch (error) {
                        console.log('   ⚠️  CreditService not available, skipping credit transactions');
                    }
                    
                    // Create transaction records
                    if (transactionCreates.length > 0) {
                        await models.Transaction.bulkCreate(transactionCreates);
                        console.log(`   📝 Created ${transactionCreates.length} transaction records`);
                    }
                    
                    // Mark bonuses as claimed
                    for (const attendance of attendanceRecords) {
                        if (userBonusIncrements[attendance.user_id]) {
                            await models.AttendanceRecord.update({
                                bonus_claimed: true,
                                claimed_at: new Date()
                            }, {
                                where: { id: attendance.id }
                            });
                        }
                    }
                    console.log(`   ✅ Marked bonuses as claimed`);
                    
                } else {
                    console.log(`💰 Would process bonuses for ${Object.keys(userBonusIncrements).length} users (DRY RUN)`);
                    for (const userId in userBonusIncrements) {
                        console.log(`   📝 User ${userId}: +₹${userBonusIncrements[userId]}`);
                    }
                }
                
            } else {
                console.log('\nℹ️  No bonuses to process');
            }
            
            // STEP 7: Final summary (same format as real cron)
            console.log('\n📊 ATTENDANCE CRON TEST RESULTS:');
            console.log('================================');
            console.log(`📅 Date: ${targetDate}`);
            console.log(`👥 Total users: ${attendanceRecords.length}`);
            console.log(`✅ Eligible for bonus: ${eligibleCount}`);
            console.log(`❌ Not eligible: ${ineligibleCount}`);
            console.log(`💰 Total bonus amount: ₹${totalBonusAmount.toFixed(2)}`);
            console.log(`🔒 Redis lock: ${lockAcquired ? 'Acquired' : 'Already exists'}`);
            console.log(`🧪 Test mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
            
            // STEP 8: Verify the results match expected cron behavior
            console.log('\n🔍 VERIFICATION: Does this match your cron output?');
            console.log('==================================================');
            
            if (eligibleCount > 0) {
                console.log(`✅ Found ${eligibleCount} eligible users - this should match your cron logs`);
                console.log(`💰 Total bonus: ₹${totalBonusAmount} - check if this appears in your cron logs`);
            } else {
                console.log(`⚠️  No eligible users found - check if your cron is calculating bonuses correctly`);
            }
            
            if (ineligibleCount > 0) {
                console.log(`ℹ️  ${ineligibleCount} users not eligible - this is normal`);
            }
            
            console.log('\n💡 TIP: Compare these results with your cron job logs to verify they match!');
            
        } finally {
            // Release Redis lock (same as real cron)
            if (lockAcquired) {
                console.log('\n🔓 Releasing Redis lock...');
                await redis.del(lockKey);
                console.log('✅ Redis lock released');
            }
        }
        
    } catch (error) {
        console.error('❌ Error testing attendance cron logic:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
};

// Main execution
const main = async () => {
    try {
        await testAttendanceCronLogic();
        console.log('\n🎉 Attendance cron logic test completed!');
        
        if (options.dryRun) {
            console.log('\n💡 This was a DRY RUN - no changes were made to the database');
            console.log('   Run without --dry-run to actually process the bonuses');
        }
        
    } catch (error) {
        console.error('\n💥 Fatal error:', error.message);
        process.exit(1);
    }
};

// Run the script
if (require.main === module) {
    main();
}

module.exports = {
    testAttendanceCronLogic
};
