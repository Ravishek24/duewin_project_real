#!/usr/bin/env node

/**
 * Manual Attendance Bonus Processing Script
 * 
 * This script manually triggers the attendance bonus processing
 * for users who are eligible but haven't received their bonuses yet.
 */

const path = require('path');
const moment = require('moment-timezone');

// Add the Backend directory to the path so we can import modules
process.env.NODE_PATH = path.join(__dirname, '..');
require('module')._initPaths();

console.log('💰 Manual Attendance Bonus Processing');
console.log('===================================\n');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    date: null,
    userId: null,
    force: false,
    help: false
};

for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
        options.help = true;
    } else if (arg.startsWith('--date=')) {
        options.date = arg.split('=')[1];
    } else if (arg.startsWith('--user=')) {
        options.userId = parseInt(arg.split('=')[1]);
    } else if (arg === '--force') {
        options.force = true;
    }
}

if (options.help) {
    console.log('Usage: node scripts/manual-bonus-processing.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --date=YYYY-MM-DD        Process bonuses for specific date (default: today)');
    console.log('  --user=userId            Process bonus for specific user only');
    console.log('  --force                  Force processing even if already processed');
    console.log('  --help, -h               Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/manual-bonus-processing.js');
    console.log('  node scripts/manual-bonus-processing.js --date=2025-08-15');
    console.log('  node scripts/manual-bonus-processing.js --user=13');
    console.log('  node scripts/manual-bonus-processing.js --force');
    process.exit(0);
}

/**
 * Manual attendance bonus processing
 */
const manualBonusProcessing = async () => {
    try {
        // Set the date to process
        let targetDate;
        if (options.date) {
            // Validate date format
            if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
                throw new Error('Invalid date format. Use YYYY-MM-DD');
            }
            targetDate = options.date;
            console.log(`📅 Processing bonuses for date: ${targetDate}`);
        } else {
            targetDate = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
            console.log(`📅 Processing bonuses for TODAY: ${targetDate}`);
        }
        
        // Initialize database connection
        console.log('🔌 Connecting to database...');
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
        
        // Get attendance records for the target date
        console.log('🔍 Getting attendance records...');
        let attendanceQuery = {
            where: { attendance_date: targetDate },
            include: [{
                model: models.User,
                as: 'attendance_user',
                attributes: ['user_id', 'user_name', 'wallet_balance']
            }]
        };
        
        if (options.userId) {
            attendanceQuery.where.user_id = options.userId;
            console.log(`👤 Processing bonus for user ${options.userId} only`);
        }
        
        const attendanceRecords = await models.AttendanceRecord.findAll(attendanceQuery);
        console.log(`📊 Found ${attendanceRecords.length} attendance records for ${targetDate}`);
        
        if (attendanceRecords.length === 0) {
            console.log('❌ No attendance records found for this date');
            return;
        }
        
        // Get today's recharges
        console.log('💳 Getting recharge data...');
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
        
        console.log(`💰 Found ${recharges.length} recharge transactions for ${targetDate}`);
        
        // Create recharge map
        const rechargeMap = {};
        for (const r of recharges) {
            const uid = r.user_id;
            rechargeMap[uid] = (rechargeMap[uid] || 0) + parseFloat(r.amount);
        }
        
        // Bonus rules
        const ATTENDANCE_BONUS_RULES = [
            { days: 1, amount: 300, bonus: 10 },
            { days: 2, amount: 1000, bonus: 30 },
            { days: 3, amount: 3000, bonus: 130 },
            { days: 4, amount: 8000, bonus: 300 },
            { days: 5, amount: 20000, bonus: 650 },
            { days: 6, amount: 80000, bonus: 3150 },
            { days: 7, amount: 200000, bonus: 7500 }
        ];
        
        // Process bonuses
        console.log('\n🎁 Processing attendance bonuses...');
        console.log('===================================');
        
        let successCount = 0;
        let errorCount = 0;
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
                console.log(`   ✅ Eligible: Yes (₹${totalRecharge} >= ₹${rule.amount})`);
            } else {
                if (!rule) {
                    console.log(`   ❌ No bonus rule for Day ${streak}`);
                } else {
                    console.log(`   ❌ Insufficient recharge: ₹${totalRecharge} < ₹${rule.amount}`);
                }
            }
            
            // Prepare attendance update
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
                successCount++;
                totalBonusAmount += bonusAmount;
            } else if (eligible && attendance.bonus_claimed) {
                console.log(`   ✅ Bonus already claimed: ₹${attendance.bonus_amount}`);
            } else if (!eligible) {
                console.log(`   ❌ Not eligible for bonus`);
            }
        }
        
        // Update attendance records
        console.log('\n📝 Updating attendance records...');
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
        
        // Process bonuses (add to wallet and create transactions)
        if (Object.keys(userBonusIncrements).length > 0) {
            console.log('\n💰 Processing bonus payments...');
            
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
            console.log('\nℹ️  No bonuses to process');
        }
        
        // Final summary
        console.log('\n📊 Processing Summary:');
        console.log('======================');
        console.log(`📅 Date: ${targetDate}`);
        console.log(`👥 Total users processed: ${attendanceRecords.length}`);
        console.log(`✅ Successful bonuses: ${successCount}`);
        console.log(`❌ Errors: ${errorCount}`);
        console.log(`💰 Total bonus amount: ₹${totalBonusAmount.toFixed(2)}`);
        
        if (options.userId) {
            // Show specific user's final status
            const finalAttendance = await models.AttendanceRecord.findOne({
                where: { user_id: options.userId, attendance_date: targetDate }
            });
            
            if (finalAttendance) {
                console.log(`\n👤 Final Status for User ${options.userId}:`);
                console.log(`   🎁 Bonus eligible: ${finalAttendance.claim_eligible ? 'Yes' : 'No'}`);
                console.log(`   🎯 Bonus amount: ₹${parseFloat(finalAttendance.bonus_amount || 0).toFixed(2)}`);
                console.log(`   ✅ Bonus claimed: ${finalAttendance.bonus_claimed ? 'Yes' : 'No'}`);
                console.log(`   💰 Recharge amount: ₹${parseFloat(finalAttendance.recharge_amount || 0).toFixed(2)}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Error in manual bonus processing:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
};

// Main execution
const main = async () => {
    try {
        await manualBonusProcessing();
        console.log('\n🎉 Manual bonus processing completed successfully!');
        
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
    manualBonusProcessing
};
