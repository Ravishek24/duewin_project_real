#!/usr/bin/env node

/**
 * Manual Attendance Cron Trigger Script
 * 
 * This script manually triggers the attendance cron job for testing and debugging.
 * It can be used to:
 * - Test attendance recording without waiting for the scheduled time
 * - Debug attendance-related issues
 * - Force attendance processing for a specific date
 * - Process today's attendance (default behavior)
 * 
 * Usage:
 * node scripts/manual-attendance-cron.js                    # Process today's attendance
 * node scripts/manual-attendance-cron.js --date=2024-01-15 # Process specific date
 * node scripts/manual-attendance-cron.js --force           # Force processing
 * node scripts/manual-attendance-cron.js --today           # Explicitly process today
 */

const path = require('path');
const moment = require('moment-timezone');

// Add the Backend directory to the path so we can import modules
process.env.NODE_PATH = path.join(__dirname, '..');
require('module')._initPaths();

console.log('🚀 Manual Attendance Cron Trigger Script');
console.log('=====================================\n');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    date: null,
    force: false,
    help: false,
    today: false
};

for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
        options.help = true;
    } else if (arg.startsWith('--date=')) {
        options.date = arg.split('=')[1];
    } else if (arg === '--force') {
        options.force = true;
    } else if (arg === '--today') {
        options.today = true;
    }
}

if (options.help) {
    console.log('Usage: node scripts/manual-attendance-cron.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  (no args)              Process today\'s attendance (default)');
    console.log('  --today                Explicitly process today\'s attendance');
    console.log('  --date=YYYY-MM-DD      Process attendance for specific date');
    console.log('  --force                Force processing even if already processed');
    console.log('  --help, -h             Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/manual-attendance-cron.js');
    console.log('  node scripts/manual-attendance-cron.js --today');
    console.log('  node scripts/manual-attendance-cron.js --date=2024-01-15');
    console.log('  node scripts/manual-attendance-cron.js --force');
    process.exit(0);
}

/**
 * Main function to manually trigger attendance cron
 */
const manualAttendanceCron = async () => {
    try {
        console.log('🔄 Initializing manual attendance cron...');
        
        // Set the date to process
        let targetDate;
        if (options.date) {
            // Validate date format
            if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date)) {
                throw new Error('Invalid date format. Use YYYY-MM-DD');
            }
            targetDate = options.date;
            console.log(`📅 Processing attendance for date: ${targetDate}`);
        } else {
            // Default: Process today's attendance
            targetDate = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
            console.log(`📅 Processing attendance for TODAY: ${targetDate}`);
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
        
        // Check if attendance already exists for the target date
        const existingCount = await models.AttendanceRecord.count({
            where: { attendance_date: targetDate }
        });
        
        if (existingCount > 0) {
            if (options.force) {
                console.log(`⚠️  Found ${existingCount} existing records for ${targetDate}`);
                console.log('   Force mode enabled - will delete and reprocess');
                
                // Delete existing records
                await models.AttendanceRecord.destroy({
                    where: { attendance_date: targetDate }
                });
                console.log(`🗑️  Deleted ${existingCount} existing records`);
            } else {
                console.log(`ℹ️  Found ${existingCount} existing records for ${targetDate}`);
                console.log('   Use --force to delete and reprocess');
                console.log('   Or use --today to process today\'s attendance');
                
                // For today's date, offer to update existing records
                if (targetDate === moment.tz('Asia/Kolkata').format('YYYY-MM-DD')) {
                    console.log('\n🔄 Since this is today, would you like to:');
                    console.log('   1. Update existing records (recommended)');
                    console.log('   2. Exit and check existing records');
                    console.log('   3. Force reprocess (--force)');
                    
                    // For now, let's update existing records
                    console.log('\n🔄 Updating existing attendance records...');
                    await updateExistingAttendanceRecords(targetDate, models);
                    return;
                }
                
                process.exit(0);
            }
        }
        
        // Import and run the attendance function
        console.log('🎯 Running attendance recording...');
        const { autoRecordDailyAttendance } = require('./masterCronJobs');
        
        // Temporarily override the date logic in the function
        const originalMoment = global.moment;
        global.moment = {
            tz: (timezone) => ({
                format: (format) => {
                    if (format === 'YYYY-MM-DD') {
                        return targetDate;
                    }
                    return moment.tz(timezone).format(format);
                },
                subtract: (amount, unit) => ({
                    format: (format) => {
                        if (format === 'YYYY-MM-DD') {
                            const yesterday = moment.tz(timezone).subtract(amount, unit).format('YYYY-MM-DD');
                            return yesterday;
                        }
                        return moment.tz(timezone).subtract(amount, unit).format(format);
                    }
                })
            })
        };
        
        try {
            await autoRecordDailyAttendance();
            console.log('✅ Manual attendance cron completed successfully!');
            
            // Verify the results
            const finalCount = await models.AttendanceRecord.count({
                where: { attendance_date: targetDate }
            });
            console.log(`📊 Final attendance count for ${targetDate}: ${finalCount} records`);
            
        } finally {
            // Restore original moment
            global.moment = originalMoment;
        }
        
    } catch (error) {
        console.error('❌ Error in manual attendance cron:', error);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
};

/**
 * Update existing attendance records for today
 */
const updateExistingAttendanceRecords = async (targetDate, models) => {
    try {
        console.log('🔄 Updating existing attendance records...');
        
        // Get all existing records for today
        const existingRecords = await models.AttendanceRecord.findAll({
            where: { attendance_date: targetDate }
        });
        
        console.log(`📝 Found ${existingRecords.length} existing records to update`);
        
        // Get all users to ensure we have records for everyone
        const allUsers = await models.User.findAll({ 
            attributes: ['user_id', 'user_name']
        });
        
        const existingUserIds = new Set(existingRecords.map(r => r.user_id));
        const missingUsers = allUsers.filter(user => !existingUserIds.has(user.user_id));
        
        if (missingUsers.length > 0) {
            console.log(`➕ Adding ${missingUsers.length} missing users...`);
            
            // Create records for missing users
            const newRecords = [];
            for (const user of missingUsers) {
                // Calculate streak
                const yesterday = moment.tz('Asia/Kolkata').subtract(1, 'day').format('YYYY-MM-DD');
                const yesterdayAttendance = await models.AttendanceRecord.findOne({
                    where: { user_id: user.user_id, attendance_date: yesterday }
                });
                
                let streak = 1;
                if (yesterdayAttendance && yesterdayAttendance.has_recharged) {
                    streak = (yesterdayAttendance.streak_count || 0) + 1;
                }
                
                newRecords.push({
                    user_id: user.user_id,
                    date: targetDate,
                    attendance_date: targetDate,
                    streak_count: streak,
                    has_recharged: false,
                    recharge_amount: 0,
                    additional_bonus: 0,
                    bonus_amount: 0,
                    bonus_claimed: false,
                    claim_eligible: false,
                    created_at: new Date(),
                    updated_at: new Date()
                });
            }
            
            if (newRecords.length > 0) {
                await models.AttendanceRecord.bulkCreate(newRecords);
                console.log(`✅ Added ${newRecords.length} new attendance records`);
            }
        }
        
        // Update existing records with current timestamp
        await models.AttendanceRecord.update(
            { updated_at: new Date() },
            { where: { attendance_date: targetDate } }
        );
        
        const finalCount = await models.AttendanceRecord.count({
            where: { attendance_date: targetDate }
        });
        
        console.log(`✅ Updated ${existingRecords.length} existing records`);
        console.log(`📊 Total attendance records for ${targetDate}: ${finalCount}`);
        
    } catch (error) {
        console.error('❌ Error updating existing records:', error);
        throw error;
    }
};

/**
 * Alternative approach: Direct database operations
 */
const directAttendanceProcessing = async () => {
    try {
        console.log('🔄 Using direct database approach...');
        
        const targetDate = options.date || moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
        console.log(`📅 Processing attendance for date: ${targetDate}`);
        
        // Initialize database
        const { connectDB, waitForDatabase } = require('../config/db');
        await connectDB();
        await waitForDatabase();
        
        const { getModels } = require('../models');
        const models = await getModels();
        
        // Get all active users
        const users = await models.User.findAll({ 
            attributes: ['user_id', 'user_name']
        });
        
        console.log(`👥 Found ${users.length} active users`);
        
        // Check existing records
        const existingRecords = await models.AttendanceRecord.findAll({
            where: { attendance_date: targetDate },
            attributes: ['user_id']
        });
        
        const existingUserIds = new Set(existingRecords.map(r => r.user_id));
        const newRecords = [];
        
        for (const user of users) {
            if (!existingUserIds.has(user.user_id)) {
                // Calculate streak
                const yesterday = moment.tz('Asia/Kolkata').subtract(1, 'day').format('YYYY-MM-DD');
                const yesterdayAttendance = await models.AttendanceRecord.findOne({
                    where: { user_id: user.user_id, attendance_date: yesterday }
                });
                
                let streak = 1;
                if (yesterdayAttendance && yesterdayAttendance.has_recharged) {
                    streak = (yesterdayAttendance.streak_count || 0) + 1;
                }
                
                newRecords.push({
                    user_id: user.user_id,
                    date: targetDate,
                    attendance_date: targetDate,
                    streak_count: streak,
                    has_recharged: false,
                    recharge_amount: 0,
                    additional_bonus: 0,
                    bonus_amount: 0,
                    bonus_claimed: false,
                    claim_eligible: false,
                    created_at: new Date(),
                    updated_at: new Date()
                });
            }
        }
        
        if (newRecords.length === 0) {
            console.log('ℹ️  No new attendance records to create');
            return;
        }
        
        // Insert records in batches
        const BATCH_SIZE = 500;
        let successCount = 0;
        
        for (let i = 0; i < newRecords.length; i += BATCH_SIZE) {
            const batch = newRecords.slice(i, i + BATCH_SIZE);
            await models.AttendanceRecord.bulkCreate(batch);
            successCount += batch.length;
            console.log(`📝 Processed batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} records`);
        }
        
        console.log(`✅ Direct attendance processing completed: ${successCount} records created`);
        
        // Final count
        const finalCount = await models.AttendanceRecord.count({
            where: { attendance_date: targetDate }
        });
        console.log(`📊 Total attendance records for ${targetDate}: ${finalCount}`);
        
    } catch (error) {
        console.error('❌ Error in direct attendance processing:', error);
        throw error;
    }
};

// Main execution
const main = async () => {
    try {
        if (options.force) {
            console.log('⚠️  Force mode enabled - will override existing records');
        }
        
        if (options.today || (!options.date && !options.force)) {
            console.log('🎯 Processing today\'s attendance by default');
        }
        
        // Try the cron approach first, fallback to direct processing
        try {
            await manualAttendanceCron();
        } catch (cronError) {
            console.log('⚠️  Cron approach failed, trying direct processing...');
            console.log('   Error:', cronError.message);
            await directAttendanceProcessing();
        }
        
        console.log('\n🎉 Manual attendance processing completed successfully!');
        
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
    manualAttendanceCron,
    directAttendanceProcessing,
    updateExistingAttendanceRecords
};
