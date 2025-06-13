// Backend/services/autoAttendanceService.js - Auto Attendance Processing
const { sequelize } = require('../config/db');
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const logger = require('../utils/logger');

// Import models
const User = require('../models/User');
const AttendanceRecord = require('../models/AttendanceRecord');

/**
 * Auto-process recharge for attendance when user makes any recharge
 * @param {number} userId - User ID
 * @param {number} rechargeAmount - Amount of recharge
 * @param {Object} transaction - Database transaction (optional)
 * @returns {Object} - Processing result
 */
const autoProcessRechargeForAttendance = async (userId, rechargeAmount, transaction = null) => {
    const t = transaction || await sequelize.transaction();
    const shouldCommit = !transaction;

    try {
        console.log(`💰 Auto-processing recharge for attendance - User: ${userId}, Amount: ${rechargeAmount}`);

        const today = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
        const now = moment.tz('Asia/Kolkata');
        console.log(`📅 Processing for date: ${today}`);

        // Get user's last login time
        const user = await User.findOne({
            where: { user_id: userId },
            attributes: ['last_login_at'],
            transaction: t
        });

        // Check if user has logged in today
        const hasLoggedInToday = user && user.last_login_at && 
            moment(user.last_login_at).format('YYYY-MM-DD') === today;

        if (!hasLoggedInToday) {
            console.log('⚠️ User has not logged in today');
            if (shouldCommit) await t.commit();
            return {
                success: false,
                message: 'User must log in today to be eligible for attendance bonus'
            };
        }

        // Find today's attendance record
        let attendanceRecord = await AttendanceRecord.findOne({
            where: {
                user_id: userId,
                attendance_date: today
            },
            transaction: t
        });

        // If no attendance record for today, create one automatically
        if (!attendanceRecord) {
            console.log('📅 No attendance record found, creating one automatically');
            
            // Get yesterday's attendance for streak calculation
            const yesterday = moment.tz('Asia/Kolkata').subtract(1, 'day').format('YYYY-MM-DD');
            const yesterdayAttendance = await AttendanceRecord.findOne({
                where: {
                    user_id: userId,
                    attendance_date: yesterday
                },
                transaction: t
            });

            let streak = 1;
            if (yesterdayAttendance && yesterdayAttendance.has_recharged) {
                streak = (yesterdayAttendance.streak_count || 0) + 1;
            }

            console.log(`🔥 Calculated streak: ${streak}`);

            // Calculate streak bonus (ONLY streak bonus, no additional recharge bonus)
            const bonusAmounts = [7, 20, 100, 200, 450, 2400, 6400];
            const bonusIndex = Math.min(streak - 1, bonusAmounts.length - 1);
            const streakBonus = bonusAmounts[bonusIndex];

            attendanceRecord = await AttendanceRecord.create({
                user_id: userId,
                date: today,
                attendance_date: today,
                streak_count: streak,
                has_recharged: true,                    // Auto-set to true since user recharged
                recharge_amount: parseFloat(rechargeAmount),
                additional_bonus: 0,                    // No additional recharge bonus
                bonus_amount: streakBonus,              // Only streak bonus
                bonus_claimed: false,
                claim_eligible: true,                   // Auto-eligible since recharged and logged in today
                created_at: new Date(),
                updated_at: new Date()
            }, { transaction: t });

            console.log(`✅ Created new attendance record with bonus: ${streakBonus}`);
        } else {
            // Update existing record
            const previousRechargeAmount = parseFloat(attendanceRecord.recharge_amount) || 0;
            const newTotalRechargeAmount = previousRechargeAmount + parseFloat(rechargeAmount);

            // Recalculate streak bonus (only streak bonus)
            const bonusAmounts = [7, 20, 100, 200, 450, 2400, 6400];
            const bonusIndex = Math.min((attendanceRecord.streak_count || 1) - 1, bonusAmounts.length - 1);
            const streakBonus = bonusAmounts[bonusIndex];

            await attendanceRecord.update({
                has_recharged: true,
                recharge_amount: newTotalRechargeAmount,
                additional_bonus: 0,                    // No additional recharge bonus
                bonus_amount: streakBonus,              // Only streak bonus
                claim_eligible: true,                   // Auto-eligible since recharged and logged in today
                updated_at: new Date()                  // Update timestamp for today's check
            }, { transaction: t });

            console.log(`✅ Updated attendance record - Total recharge: ${newTotalRechargeAmount}, Bonus: ${streakBonus}`);
        }

        if (shouldCommit) await t.commit();

        return {
            success: true,
            message: 'Recharge auto-processed for attendance bonus',
            streak: attendanceRecord.streak_count,
            streakBonus: parseFloat(attendanceRecord.bonus_amount),
            additionalBonus: 0,                         // Always 0 now
            totalBonus: parseFloat(attendanceRecord.bonus_amount),
            isEligible: true,
            attendanceDate: today,
            totalRechargeAmount: parseFloat(attendanceRecord.recharge_amount),
            hasLoggedInToday: true,                     // We know this is true because we checked
            hasRechargedToday: true                     // We know this is true because we just recharged
        };

    } catch (error) {
        if (shouldCommit) await t.rollback();
        console.error('💥 Error auto-processing recharge for attendance:', error);
        logger.error('Error auto-processing recharge for attendance:', {
            userId,
            rechargeAmount,
            error: error.message,
            stack: error.stack
        });
        return {
            success: false,
            message: 'Error auto-processing recharge for attendance: ' + error.message
        };
    }
};

/**
 * Get user's attendance status for today
 * @param {number} userId - User ID
 * @returns {Object} - Today's attendance status
 */
const getTodayAttendanceStatus = async (userId) => {
    try {
        const today = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
        const now = moment.tz('Asia/Kolkata');
        
        console.log('📅 Date check:', {
            today: today,
            currentTime: now.format('HH:mm:ss')
        });
        
        // Get user's last login time
        const user = await User.findOne({
            where: { user_id: userId },
            attributes: ['last_login_at']
        });

        // Check if user has logged in today
        const hasLoggedInToday = user && user.last_login_at && 
            moment(user.last_login_at).format('YYYY-MM-DD') === today;

        console.log('🔑 Login check:', {
            lastLogin: user?.last_login_at ? moment(user.last_login_at).format('YYYY-MM-DD HH:mm:ss') : 'Never',
            hasLoggedInToday: hasLoggedInToday
        });
        
        const attendanceRecord = await AttendanceRecord.findOne({
            where: {
                user_id: userId,
                attendance_date: today
            }
        });

        if (!attendanceRecord) {
            return {
                success: true,
                hasAttended: false,
                hasRecharged: false,
                hasLoggedInToday: hasLoggedInToday,
                isEligibleForBonus: false,
                bonusClaimed: false,
                streak: 0,
                bonusAmount: 0,
                attendanceDate: today
            };
        }

        // Check if recharge was done today
        const hasRechargedToday = attendanceRecord.has_recharged && 
            moment(attendanceRecord.updated_at).format('YYYY-MM-DD') === today;

        console.log('💰 Recharge check:', {
            lastRecharge: attendanceRecord.updated_at ? moment(attendanceRecord.updated_at).format('YYYY-MM-DD HH:mm:ss') : 'Never',
            hasRechargedToday: hasRechargedToday,
            rechargeAmount: parseFloat(attendanceRecord.recharge_amount || 0)
        });

        const isEligible = attendanceRecord.claim_eligible && hasLoggedInToday && hasRechargedToday;
        console.log('🎯 Eligibility check:', {
            claimEligible: attendanceRecord.claim_eligible,
            hasLoggedInToday,
            hasRechargedToday,
            isEligible
        });

        return {
            success: true,
            hasAttended: true,
            hasRecharged: attendanceRecord.has_recharged,
            hasLoggedInToday: hasLoggedInToday,
            hasRechargedToday: hasRechargedToday,
            isEligibleForBonus: isEligible,
            bonusClaimed: attendanceRecord.bonus_claimed,
            streak: attendanceRecord.streak_count,
            bonusAmount: parseFloat(attendanceRecord.bonus_amount || 0),
            rechargeAmount: parseFloat(attendanceRecord.recharge_amount || 0),
            attendanceDate: today
        };

    } catch (error) {
        console.error('❌ Error getting today\'s attendance status:', error);
        return {
            success: false,
            message: 'Error getting attendance status: ' + error.message
        };
    }
};

/**
 * Get user's attendance history
 * @param {number} userId - User ID
 * @param {number} days - Number of days to look back (default: 30)
 * @returns {Object} - Attendance history
 */
const getUserAttendanceHistory = async (userId, days = 30) => {
    try {
        const startDate = moment.tz('Asia/Kolkata').subtract(days, 'days').format('YYYY-MM-DD');
        const endDate = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');

        const attendanceRecords = await AttendanceRecord.findAll({
            where: {
                user_id: userId,
                attendance_date: {
                    [Op.between]: [startDate, endDate]
                }
            },
            order: [['attendance_date', 'DESC']],
            attributes: [
                'attendance_date',
                'streak_count',
                'has_recharged',
                'recharge_amount',
                'bonus_amount',
                'bonus_claimed',
                'claim_eligible'
            ]
        });

        // Calculate statistics
        const totalDays = attendanceRecords.length;
        const rechargedDays = attendanceRecords.filter(r => r.has_recharged).length;
        const totalBonusEarned = attendanceRecords
            .filter(r => r.bonus_claimed)
            .reduce((sum, r) => sum + parseFloat(r.bonus_amount || 0), 0);
        const currentStreak = attendanceRecords.length > 0 ? attendanceRecords[0].streak_count : 0;

        return {
            success: true,
            history: attendanceRecords.map(record => ({
                date: record.attendance_date,
                streak: record.streak_count,
                hasRecharged: record.has_recharged,
                rechargeAmount: parseFloat(record.recharge_amount || 0),
                bonusAmount: parseFloat(record.bonus_amount || 0),
                bonusClaimed: record.bonus_claimed,
                isEligible: record.claim_eligible
            })),
            statistics: {
                totalDays,
                rechargedDays,
                totalBonusEarned,
                currentStreak,
                attendanceRate: totalDays > 0 ? (rechargedDays / totalDays * 100).toFixed(2) : 0
            }
        };

    } catch (error) {
        console.error('❌ Error getting attendance history:', error);
        return {
            success: false,
            message: 'Error getting attendance history: ' + error.message
        };
    }
};

/**
 * Get unclaimed attendance bonuses for a user
 * @param {number} userId - User ID
 * @returns {Object} - List of unclaimed bonuses
 */
const getUnclaimedAttendanceBonuses = async (userId) => {
    try {
        const unclaimed = await AttendanceRecord.findAll({
            where: {
                user_id: userId,
                claim_eligible: true,
                bonus_claimed: false,
                bonus_amount: { [Op.gt]: 0 }
            },
            order: [['attendance_date', 'DESC']],
            attributes: [
                'attendance_date',
                'streak_count',
                'recharge_amount',
                'bonus_amount'
            ]
        });

        const totalUnclaimedAmount = unclaimed.reduce(
            (sum, record) => sum + parseFloat(record.bonus_amount || 0), 
            0
        );

        return {
            success: true,
            unclaimedBonuses: unclaimed.map(record => ({
                date: record.attendance_date,
                streak: record.streak_count,
                rechargeAmount: parseFloat(record.recharge_amount || 0),
                bonusAmount: parseFloat(record.bonus_amount || 0)
            })),
            totalUnclaimedAmount,
            count: unclaimed.length
        };

    } catch (error) {
        console.error('❌ Error getting unclaimed attendance bonuses:', error);
        return {
            success: false,
            message: 'Error getting unclaimed bonuses: ' + error.message
        };
    }
};

/**
 * Get attendance statistics for admin dashboard
 * @returns {Object} - Attendance system statistics
 */
const getAttendanceStatistics = async () => {
    try {
        const today = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
        const thisMonth = moment.tz('Asia/Kolkata').format('YYYY-MM');

        // Today's attendance stats
        const todayStats = await AttendanceRecord.findAll({
            where: {
                attendance_date: today
            },
            attributes: [
                [sequelize.fn('COUNT', sequelize.col('user_id')), 'total_attendees'],
                [sequelize.fn('COUNT', sequelize.literal('CASE WHEN has_recharged = true THEN 1 END')), 'recharged_attendees'],
                [sequelize.fn('COUNT', sequelize.literal('CASE WHEN claim_eligible = true THEN 1 END')), 'eligible_for_bonus'],
                [sequelize.fn('SUM', sequelize.col('bonus_amount')), 'total_bonus_amount']
            ],
            raw: true
        });

        // This month's stats
        const monthlyStats = await AttendanceRecord.findAll({
            where: {
                attendance_date: {
                    [Op.like]: `${thisMonth}%`
                }
            },
            attributes: [
                [sequelize.fn('COUNT', sequelize.literal('DISTINCT user_id')), 'unique_attendees'],
                [sequelize.fn('COUNT', sequelize.literal('CASE WHEN has_recharged = true THEN 1 END')), 'total_recharges'],
                [sequelize.fn('SUM', sequelize.col('recharge_amount')), 'total_recharge_amount'],
                [sequelize.fn('COUNT', sequelize.literal('CASE WHEN bonus_claimed = true THEN 1 END')), 'claimed_bonuses'],
                [sequelize.fn('SUM', sequelize.literal('CASE WHEN bonus_claimed = true THEN bonus_amount ELSE 0 END')), 'claimed_bonus_amount']
            ],
            raw: true
        });

        // Streak distribution
        const streakDistribution = await sequelize.query(`
            SELECT 
                CASE 
                    WHEN streak_count = 1 THEN '1 day'
                    WHEN streak_count BETWEEN 2 AND 3 THEN '2-3 days'
                    WHEN streak_count BETWEEN 4 AND 7 THEN '4-7 days'
                    WHEN streak_count BETWEEN 8 AND 14 THEN '1-2 weeks'
                    WHEN streak_count BETWEEN 15 AND 30 THEN '2-4 weeks'
                    WHEN streak_count > 30 THEN '30+ days'
                    ELSE 'Unknown'
                END as streak_range,
                COUNT(DISTINCT user_id) as user_count
            FROM attendance_records 
            WHERE attendance_date = :today
            GROUP BY streak_range
            ORDER BY MIN(streak_count)
        `, {
            replacements: { today },
            type: sequelize.QueryTypes.SELECT
        });

        return {
            success: true,
            statistics: {
                today: todayStats[0] || {},
                monthly: monthlyStats[0] || {},
                streakDistribution,
                lastUpdated: new Date()
            }
        };

    } catch (error) {
        console.error('❌ Error getting attendance statistics:', error);
        return {
            success: false,
            message: 'Error getting attendance statistics: ' + error.message
        };
    }
};

module.exports = {
    autoProcessRechargeForAttendance,
    getTodayAttendanceStatus,
    getUserAttendanceHistory,
    getUnclaimedAttendanceBonuses,
    getAttendanceStatistics
};