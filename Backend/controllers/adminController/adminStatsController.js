const { User, ReferralCommission } = require('../../models');
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
                last_login_at: {
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

// Get total commission statistics
const getTotalCommission = async (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        
        // Build date filter
        let dateFilter = {};
        if (start_date && end_date) {
            dateFilter = {
                [Op.between]: [new Date(start_date), new Date(end_date)]
            };
        } else if (start_date) {
            dateFilter = {
                [Op.gte]: new Date(start_date)
            };
        } else if (end_date) {
            dateFilter = {
                [Op.lte]: new Date(end_date)
            };
        }

        // Get total commission amount
        const totalCommission = await ReferralCommission.sum('amount', {
            where: {
                ...(Object.keys(dateFilter).length > 0 && { created_at: dateFilter })
            }
        });

        // Get commission count
        const totalCommissionCount = await ReferralCommission.count({
            where: {
                ...(Object.keys(dateFilter).length > 0 && { created_at: dateFilter })
            }
        });

        // Get commission by type
        const commissionByType = await ReferralCommission.findAll({
            where: {
                ...(Object.keys(dateFilter).length > 0 && { created_at: dateFilter })
            },
            attributes: [
                'rebate_type',
                [Op.fn('SUM', Op.col('amount')), 'total_amount'],
                [Op.fn('COUNT', Op.col('id')), 'count']
            ],
            group: ['rebate_type'],
            raw: true
        });

        // Get commission by level
        const commissionByLevel = await ReferralCommission.findAll({
            where: {
                ...(Object.keys(dateFilter).length > 0 && { created_at: dateFilter })
            },
            attributes: [
                'level',
                [Op.fn('SUM', Op.col('amount')), 'total_amount'],
                [Op.fn('COUNT', Op.col('id')), 'count']
            ],
            group: ['level'],
            raw: true
        });

        // Get today's commission
        const todayIST = moment().tz('Asia/Kolkata').startOf('day');
        const todayCommission = await ReferralCommission.sum('amount', {
            where: {
                created_at: {
                    [Op.gte]: todayIST.toDate()
                }
            }
        });

        // Get this month's commission
        const monthStart = moment().tz('Asia/Kolkata').startOf('month');
        const monthCommission = await ReferralCommission.sum('amount', {
            where: {
                created_at: {
                    [Op.gte]: monthStart.toDate()
                }
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                total_commission: parseFloat(totalCommission || 0),
                total_commission_count: totalCommissionCount,
                today_commission: parseFloat(todayCommission || 0),
                month_commission: parseFloat(monthCommission || 0),
                by_type: commissionByType.map(item => ({
                    type: item.rebate_type || 'unknown',
                    total_amount: parseFloat(item.total_amount || 0),
                    count: parseInt(item.count || 0)
                })),
                by_level: commissionByLevel.map(item => ({
                    level: item.level,
                    total_amount: parseFloat(item.total_amount || 0),
                    count: parseInt(item.count || 0)
                }))
            }
        });
    } catch (error) {
        console.error('Error getting total commission:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching total commission statistics'
        });
    }
};

module.exports = {
    getTotalUsers,
    getTodayRegistrations,
    getUserStats,
    getTotalCommission
}; 