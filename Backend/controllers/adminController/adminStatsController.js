const { User } = require('../../models');
const { Op } = require('sequelize');
const moment = require('moment-timezone');

// Get total users count
const getTotalUsers = async (req, res) => {
    try {
        const totalUsers = await User.count({
            where: {
                is_admin: false // Exclude admin users
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                total_users: totalUsers
            }
        });
    } catch (error) {
        console.error('Error getting total users:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching total users count'
        });
    }
};

// Get today's new registrations (after 12 AM IST)
const getTodayRegistrations = async (req, res) => {
    try {
        // Get current date in IST
        const todayIST = moment().tz('Asia/Kolkata').startOf('day');
        
        const todayUsers = await User.count({
            where: {
                is_admin: false,
                created_at: {
                    [Op.gte]: todayIST.toDate()
                }
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                today_registrations: todayUsers,
                date: todayIST.format('YYYY-MM-DD')
            }
        });
    } catch (error) {
        console.error('Error getting today\'s registrations:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching today\'s registrations'
        });
    }
};

// Get detailed user statistics
const getUserStats = async (req, res) => {
    try {
        // Get current date in IST
        const todayIST = moment().tz('Asia/Kolkata').startOf('day');
        
        // Get total users
        const totalUsers = await User.count({
            where: {
                is_admin: false
            }
        });

        // Get today's registrations
        const todayUsers = await User.count({
            where: {
                is_admin: false,
                created_at: {
                    [Op.gte]: todayIST.toDate()
                }
            }
        });

        // Get active users (users who have logged in within last 24 hours)
        const activeUsers = await User.count({
            where: {
                is_admin: false,
                last_login: {
                    [Op.gte]: moment().subtract(24, 'hours').toDate()
                }
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                total_users: totalUsers,
                today_registrations: todayUsers,
                active_users: activeUsers,
                date: todayIST.format('YYYY-MM-DD')
            }
        });
    } catch (error) {
        console.error('Error getting user statistics:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching user statistics'
        });
    }
};

module.exports = {
    getTotalUsers,
    getTodayRegistrations,
    getUserStats
}; 