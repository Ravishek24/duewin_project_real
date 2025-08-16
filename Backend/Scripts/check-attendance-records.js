#!/usr/bin/env node

/**
 * Check Attendance Records Script
 * 
 * This script checks existing attendance records for a specific date
 * to understand what's already been processed.
 */

const path = require('path');
const moment = require('moment-timezone');

// Add the Backend directory to the path so we can import modules
process.env.NODE_PATH = path.join(__dirname, '..');
require('module')._initPaths();

console.log('🔍 Attendance Records Checker');
console.log('============================\n');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    date: null,
    help: false
};

for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
        options.help = true;
    } else if (arg.startsWith('--date=')) {
        options.date = arg.split('=')[1];
    }
}

if (options.help) {
    console.log('Usage: node scripts/check-attendance-records.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  --date=YYYY-MM-DD    Check attendance for specific date (default: today)');
    console.log('  --help, -h           Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/check-attendance-records.js');
    console.log('  node scripts/check-attendance-records.js --date=2025-08-15');
    process.exit(0);
}

/**
 * Check attendance records for a specific date
 */
const checkAttendanceRecords = async () => {
    try {
        // Set the date to check
        let targetDate;
        if (options.date) {
            // Validate date format
            if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
                throw new Error('Invalid date format. Use YYYY-MM-DD');
            }
            targetDate = options.date;
            console.log(`📅 Checking attendance records for date: ${targetDate}`);
        } else {
            targetDate = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
            console.log(`📅 Checking attendance records for today: ${targetDate}`);
        }
        
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
        
        // Get attendance records for the target date (simplified query)
        console.log('🔍 Querying attendance records...');
        const attendanceRecords = await models.AttendanceRecord.findAll({
            where: { attendance_date: targetDate },
            include: [{
                model: models.User,
                as: 'attendance_user',
                attributes: ['user_id', 'user_name'] // Removed status column
            }],
            order: [['created_at', 'ASC']]
        });
        
        console.log(`\n📊 Attendance Records for ${targetDate}:`);
        console.log('=====================================');
        console.log(`Total Records: ${attendanceRecords.length}`);
        
        if (attendanceRecords.length === 0) {
            console.log('ℹ️  No attendance records found for this date');
            return;
        }
        
        // Analyze the records
        const streakCounts = {};
        let hasRechargedCount = 0;
        let bonusEligibleCount = 0;
        let totalRechargeAmount = 0;
        let totalBonusAmount = 0;
        
        for (const record of attendanceRecords) {
            // Count by streak
            const streak = record.streak_count || 1;
            streakCounts[streak] = (streakCounts[streak] || 0) + 1;
            
            // Count recharged users
            if (record.has_recharged) {
                hasRechargedCount++;
                totalRechargeAmount += parseFloat(record.recharge_amount || 0);
            }
            
            // Count bonus eligible users
            if (record.claim_eligible) {
                bonusEligibleCount++;
                totalBonusAmount += parseFloat(record.bonus_amount || 0);
            }
        }
        
        console.log('\n🔥 Streak Breakdown:');
        for (const [streak, count] of Object.entries(streakCounts).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))) {
            console.log(`  Day ${streak}: ${count} users`);
        }
        
        console.log('\n💰 Financial Stats:');
        console.log(`  Users with recharge: ${hasRechargedCount}`);
        console.log(`  Total recharge amount: ₹${totalRechargeAmount.toFixed(2)}`);
        console.log(`  Bonus eligible users: ${bonusEligibleCount}`);
        console.log(`  Total bonus amount: ₹${totalBonusAmount.toFixed(2)}`);
        
        // Show sample records
        console.log('\n📝 Sample Records (first 5):');
        console.log('User ID | Username | Streak | Recharged | Recharge Amt | Bonus Eligible | Bonus Amt');
        console.log('---------|----------|---------|-----------|--------------|---------------|----------');
        
        attendanceRecords.slice(0, 5).forEach(record => {
            const userId = record.user_id;
            const username = record.attendance_user?.user_name || 'N/A';
            const streak = record.streak_count || 1;
            const recharged = record.has_recharged ? 'Yes' : 'No';
            const rechargeAmt = record.recharge_amount || 0;
            const bonusEligible = record.claim_eligible ? 'Yes' : 'No';
            const bonusAmt = record.bonus_amount || 0;
            
            console.log(`${userId.toString().padEnd(8)} | ${username.padEnd(8)} | ${streak.toString().padEnd(6)} | ${recharged.padEnd(9)} | ₹${rechargeAmt.toString().padEnd(11)} | ${bonusEligible.padEnd(13)} | ₹${bonusAmt.toString().padEnd(8)}`);
        });
        
        if (attendanceRecords.length > 5) {
            console.log(`... and ${attendanceRecords.length - 5} more records`);
        }
        
        // Check if this looks like a complete daily run
        const totalUsers = await models.User.count(); // Removed status filter
        const attendancePercentage = ((attendanceRecords.length / totalUsers) * 100).toFixed(1);
        
        console.log('\n📈 Coverage Analysis:');
        console.log(`Total users in system: ${totalUsers}`);
        console.log(`Attendance coverage: ${attendancePercentage}%`);
        
        if (attendancePercentage >= 95) {
            console.log('✅ High coverage - looks like a complete daily run');
        } else if (attendancePercentage >= 80) {
            console.log('⚠️  Moderate coverage - some users may be missing');
        } else {
            console.log('❌ Low coverage - many users may be missing');
        }
        
        // Show additional attendance details
        console.log('\n📋 Attendance Record Details:');
        console.log(`  Date field: ${attendanceRecords[0]?.date || 'N/A'}`);
        console.log(`  Attendance date field: ${attendanceRecords[0]?.attendance_date || 'N/A'}`);
        console.log(`  Created at: ${attendanceRecords[0]?.created_at || 'N/A'}`);
        console.log(`  Updated at: ${attendanceRecords[0]?.updated_at || 'N/A'}`);
        
    } catch (error) {
        console.error('❌ Error checking attendance records:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
};

// Main execution
const main = async () => {
    try {
        await checkAttendanceRecords();
        console.log('\n🎉 Attendance check completed successfully!');
        
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
    checkAttendanceRecords
};
