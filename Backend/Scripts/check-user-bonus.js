#!/usr/bin/env node

/**
 * Check User Bonus Status Script
 * 
 * This script checks if a specific user has received their attendance bonus
 * and shows the complete bonus status including transactions and wallet updates.
 */

const path = require('path');
const moment = require('moment-timezone');

// Add the Backend directory to the path so we can import modules
process.env.NODE_PATH = path.join(__dirname, '..');
require('module')._initPaths();

console.log('💰 User Bonus Status Checker');
console.log('============================\n');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    userId: null,
    help: false
};

for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
        options.help = true;
    } else if (arg.startsWith('--user=')) {
        options.userId = parseInt(arg.split('=')[1]);
    } else if (!options.userId && !isNaN(parseInt(arg))) {
        options.userId = parseInt(arg);
    }
}

if (options.help) {
    console.log('Usage: node scripts/check-user-bonus.js [userId] [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  userId                    User ID to check (required)');
    console.log('');
    console.log('Options:');
    console.log('  --user=userId            Specify user ID');
    console.log('  --help, -h               Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/check-user-bonus.js 13');
    console.log('  node scripts/check-user-bonus.js --user=13');
    process.exit(0);
}

if (!options.userId) {
    console.error('❌ Error: User ID is required');
    console.log('Usage: node scripts/check-user-bonus.js [userId]');
    process.exit(1);
}

/**
 * Check user's bonus status
 */
const checkUserBonus = async () => {
    try {
        const userId = options.userId;
        console.log(`🔍 Checking bonus status for User ID: ${userId}`);
        
        // Initialize database connection
        console.log('🔌 Connecting to database...');
        const { connectDB, waitForDatabase } = require('../config/db');
        await connectDB();
        await waitForDatabase();
        console.log('✅ Database connected');
        
        // Import models
        console.log('📚 Loading models...');
        const { getModels } = require('../models');
        const models = await getModels();
        console.log('✅ Models loaded');
        
        // Get user information
        console.log('👤 Getting user information...');
        const user = await models.User.findByPk(userId, {
            attributes: ['user_id', 'user_name', 'wallet_balance', 'created_at']
        });
        
        if (!user) {
            console.error(`❌ User ${userId} not found`);
            process.exit(1);
        }
        
        console.log(`✅ Found user: ${user.user_name} (ID: ${user.user_id})`);
        console.log(`💰 Current wallet balance: ₹${parseFloat(user.wallet_balance || 0).toFixed(2)}`);
        
        // Get today's attendance record
        const today = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
        console.log(`📅 Checking attendance for today: ${today}`);
        
        const todayAttendance = await models.AttendanceRecord.findOne({
            where: { 
                user_id: userId, 
                attendance_date: today 
            }
        });
        
        if (!todayAttendance) {
            console.log('❌ No attendance record found for today');
            return;
        }
        
        console.log('\n📊 Today\'s Attendance Status:');
        console.log('================================');
        console.log(`✅ Attendance recorded: Yes`);
        console.log(`🔥 Streak count: ${todayAttendance.streak_count}`);
        console.log(`💰 Has recharged: ${todayAttendance.has_recharged ? 'Yes' : 'No'}`);
        console.log(`💳 Recharge amount: ₹${parseFloat(todayAttendance.recharge_amount || 0).toFixed(2)}`);
        console.log(`🎁 Bonus eligible: ${todayAttendance.claim_eligible ? 'Yes' : 'No'}`);
        console.log(`🎯 Bonus amount: ₹${parseFloat(todayAttendance.bonus_amount || 0).toFixed(2)}`);
        console.log(`✅ Bonus claimed: ${todayAttendance.bonus_claimed ? 'Yes' : 'No'}`);
        
        // Check if user should be eligible for bonus
        console.log('\n🔍 Bonus Eligibility Analysis:');
        console.log('==============================');
        
        const ATTENDANCE_BONUS_RULES = [
            { days: 1, amount: 300, bonus: 10 },
            { days: 2, amount: 1000, bonus: 30 },
            { days: 3, amount: 3000, bonus: 130 },
            { days: 4, amount: 8000, bonus: 300 },
            { days: 5, amount: 20000, bonus: 650 },
            { days: 6, amount: 80000, bonus: 3150 },
            { days: 7, amount: 200000, bonus: 7500 }
        ];
        
        const streak = todayAttendance.streak_count || 1;
        const rechargeAmount = parseFloat(todayAttendance.recharge_amount || 0);
        
        console.log(`🔥 Current streak: Day ${streak}`);
        console.log(`💰 Total recharge today: ₹${rechargeAmount.toFixed(2)}`);
        
        // Find applicable bonus rule
        const applicableRule = ATTENDANCE_BONUS_RULES.find(rule => rule.days === streak);
        
        if (applicableRule) {
            console.log(`📋 Bonus rule for Day ${streak}: Recharge ₹${applicableRule.amount} = Get ₹${applicableRule.bonus}`);
            
            if (rechargeAmount >= applicableRule.amount) {
                console.log(`✅ User qualifies for bonus: ₹${rechargeAmount} >= ₹${applicableRule.amount}`);
                console.log(`🎁 Expected bonus: ₹${applicableRule.bonus}`);
                
                if (todayAttendance.bonus_amount === applicableRule.bonus) {
                    console.log(`✅ Bonus amount is correct: ₹${todayAttendance.bonus_amount}`);
                } else {
                    console.log(`⚠️  Bonus amount mismatch: Expected ₹${applicableRule.bonus}, Got ₹${todayAttendance.bonus_amount}`);
                }
            } else {
                console.log(`❌ User doesn't qualify: ₹${rechargeAmount} < ₹${applicableRule.amount}`);
            }
        } else {
            console.log(`❌ No bonus rule found for Day ${streak}`);
        }
        
        // Check transactions
        console.log('\n💳 Transaction History:');
        console.log('========================');
        
        const transactions = await models.Transaction.findAll({
            where: { 
                user_id: userId,
                type: 'attendance_bonus'
            },
            order: [['created_at', 'DESC']],
            limit: 10
        });
        
        if (transactions.length === 0) {
            console.log('❌ No attendance bonus transactions found');
        } else {
            console.log(`✅ Found ${transactions.length} attendance bonus transactions:`);
            transactions.forEach((tx, index) => {
                console.log(`   ${index + 1}. ₹${parseFloat(tx.amount).toFixed(2)} - ${tx.description} (${moment(tx.created_at).format('YYYY-MM-DD HH:mm:ss')})`);
            });
        }
        
        // Check credit transactions (for wagering tracking)
        console.log('\n🎯 Credit Transactions (Wagering):');
        console.log('===================================');
        
        try {
            const creditTransactions = await models.sequelize.query(`
                SELECT * FROM credit_transactions 
                WHERE user_id = :userId 
                AND type = 'activity_reward'
                AND description LIKE '%attendance%'
                ORDER BY created_at DESC
                LIMIT 10
            `, {
                replacements: { userId },
                type: models.sequelize.QueryTypes.SELECT
            });
            
            if (creditTransactions.length === 0) {
                console.log('❌ No credit transactions found for attendance');
            } else {
                console.log(`✅ Found ${creditTransactions.length} credit transactions:`);
                creditTransactions.forEach((ct, index) => {
                    console.log(`   ${index + 1}. ₹${parseFloat(ct.amount).toFixed(2)} - ${ct.description} (${moment(ct.created_at).format('YYYY-MM-DD HH:mm:ss')})`);
                });
            }
        } catch (error) {
            console.log('⚠️  Could not check credit transactions (table might not exist)');
        }
        
        // Check wallet balance changes
        console.log('\n💰 Wallet Balance Analysis:');
        console.log('============================');
        
        const walletTransactions = await models.Transaction.findAll({
            where: { 
                user_id: userId,
                type: 'attendance_bonus'
            },
            attributes: ['amount', 'created_at'],
            order: [['created_at', 'ASC']]
        });
        
        if (walletTransactions.length > 0) {
            const totalBonusReceived = walletTransactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
            console.log(`✅ Total attendance bonuses received: ₹${totalBonusReceived.toFixed(2)}`);
            console.log(`📊 Number of bonus transactions: ${walletTransactions.length}`);
        } else {
            console.log('❌ No attendance bonuses have been received yet');
        }
        
        // Summary
        console.log('\n📋 Summary:');
        console.log('===========');
        console.log(`👤 User: ${user.user_name} (ID: ${userId})`);
        console.log(`📅 Date: ${today}`);
        console.log(`🔥 Streak: Day ${streak}`);
        console.log(`💰 Recharged: ₹${rechargeAmount.toFixed(2)}`);
        console.log(`🎁 Bonus Eligible: ${todayAttendance.claim_eligible ? 'Yes' : 'No'}`);
        console.log(`🎯 Bonus Amount: ₹${parseFloat(todayAttendance.bonus_amount || 0).toFixed(2)}`);
        console.log(`✅ Bonus Claimed: ${todayAttendance.bonus_claimed ? 'Yes' : 'No'}`);
        
        if (todayAttendance.claim_eligible && !todayAttendance.bonus_claimed) {
            console.log('\n⚠️  ALERT: User is eligible for bonus but hasn\'t claimed it yet!');
            console.log('   This might indicate a processing issue in the bonus cron job.');
        } else if (todayAttendance.claim_eligible && todayAttendance.bonus_claimed) {
            console.log('\n✅ User has received their attendance bonus successfully!');
        } else if (!todayAttendance.claim_eligible) {
            console.log('\nℹ️  User is not eligible for bonus (insufficient recharge or streak)');
        }
        
    } catch (error) {
        console.error('❌ Error checking user bonus:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
};

// Main execution
const main = async () => {
    try {
        await checkUserBonus();
        console.log('\n🎉 User bonus check completed successfully!');
        
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
    checkUserBonus
};
