const { Transaction, User } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/db');

/**
 * Get comprehensive transaction report for the authenticated user
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getUserTransactionReport = async (req, res) => {
    try {
        // Get user_id from authenticated user
        const user_id = req.user.user_id;
        const { 
            start_date, 
            end_date, 
            type,
            status,
            page = 1, 
            limit = 50 
        } = req.query;
        
        const offset = (page - 1) * limit;

        // Validate user exists
        const user = await User.findByPk(user_id, {
            attributes: ['user_id', 'user_name', 'wallet_balance']
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Debug: Check what types are available for this user
        const availableTypes = await Transaction.findAll({
            where: { user_id: parseInt(user_id) },
            attributes: [[sequelize.fn('DISTINCT', sequelize.col('type')), 'type']],
            raw: true
        });
        console.log('Available transaction types for user:', availableTypes.map(t => t.type));

        // Debug: Check transactions for the specific date range
        if (start_date || end_date) {
            const dateCheckQuery = {
                user_id: parseInt(user_id)
            };
            if (start_date) {
                dateCheckQuery.created_at = { [Op.gte]: new Date(start_date) };
            }
            if (end_date) {
                dateCheckQuery.created_at = { ...dateCheckQuery.created_at, [Op.lte]: new Date(end_date) };
            }
            
            const dateRangeTransactions = await Transaction.findAll({
                where: dateCheckQuery,
                attributes: ['id', 'type', 'amount', 'created_at'],
                limit: 5
            });
            console.log('Transactions in date range:', dateRangeTransactions.map(t => ({
                id: t.id,
                type: t.type,
                amount: t.amount,
                created_at: t.created_at
            })));
        }

        // Build where clause
        const where = {
            user_id: parseInt(user_id)
        };

        // Add type filter if provided
        if (type) {
            const validTypes = [
                'deposit', 'withdrawal', 'admin_credit', 'admin_debit',
                'game_win', 'game_loss', 'gift_code', 'referral_bonus',
                'rebate', 'vip_reward', 'transfer_in', 'transfer_out',
                'refund', 'game_move_in', 'game_move_out', 'activity_reward'
            ];
            
            if (validTypes.includes(type)) {
                // Handle empty type values - treat them as rebate if filtering for rebate
                if (type === 'rebate') {
                    where.type = { [Op.or]: [type, ''] }; // Include both 'rebate' and empty string
                } else {
                    where.type = type;
                }
            } else if (type.includes(',')) {
                // Support multiple types separated by comma
                const types = type.split(',').map(t => t.trim()).filter(t => validTypes.includes(t));
                if (types.length > 0) {
                    // Handle rebate type specially
                    const finalTypes = types.map(t => t === 'rebate' ? [t, ''] : t).flat();
                    where.type = { [Op.in]: finalTypes };
                }
            }
        }

        // Add status filter if provided
        if (status) {
            const validStatuses = ['pending', 'completed', 'failed', 'cancelled'];
            if (validStatuses.includes(status)) {
                where.status = status;
            } else if (status.includes(',')) {
                // Support multiple statuses separated by comma
                const statuses = status.split(',').map(s => s.trim()).filter(s => validStatuses.includes(s));
                if (statuses.length > 0) {
                    where.status = { [Op.in]: statuses };
                }
            }
        }

        // Add date range filter if provided
        if (start_date || end_date) {
            where.created_at = {};
            if (start_date) {
                where.created_at[Op.gte] = new Date(start_date);
            }
            if (end_date) {
                where.created_at[Op.lte] = new Date(end_date);
            }
        }

        // Debug: Check if any transactions exist for this user
        const totalUserTransactions = await Transaction.count({
            where: { user_id: parseInt(user_id) }
        });
        console.log('Total transactions for user:', totalUserTransactions);

        // OPTIMIZATION: Get transactions with pagination and selective loading
        const { count, rows: transactions } = await Transaction.findAndCountAll({
            where,
            include: [{
                model: User,
                as: 'creator',
                attributes: ['user_name'], // Only load user_name
                required: false // Make it a LEFT JOIN instead of INNER JOIN
            }],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset),
            attributes: [
                'id', 'user_id', 'type', 'amount', 'status', 
                'description', 'reference_id', 'created_at', 'created_by'
            ] // Only load necessary fields
        });

        // Debug: Log the query results
        console.log('Transaction query results:', {
            count,
            transactionsCount: transactions.length,
            where,
            user_id
        });

        // Debug: Show the final where clause
        console.log('Final where clause:', JSON.stringify(where, null, 2));

        // Calculate pagination info
        const totalPages = Math.ceil(count / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        res.json({
            success: true,
            data: {
                user: {
                    user_id: user.user_id,
                    user_name: user.user_name,
                    wallet_balance: user.wallet_balance
                },
                transactions: transactions,
                pagination: {
                    current_page: parseInt(page),
                    total_pages: totalPages,
                    total_records: count,
                    limit: parseInt(limit),
                    has_next_page: hasNextPage,
                    has_prev_page: hasPrevPage
                }
            }
        });

    } catch (error) {
        console.error('Error getting user transaction report:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting transaction report'
        });
    }
};

/**
 * Get transaction statistics summary for the authenticated user
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getUserTransactionStats = async (req, res) => {
    try {
        // Get user_id from authenticated user
        const user_id = req.user.user_id;
        const { start_date, end_date } = req.query;

        // Validate user exists
        const user = await User.findByPk(user_id, {
            attributes: ['user_id', 'user_name', 'wallet_balance']
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Build where clause
        const where = {
            user_id: parseInt(user_id)
        };

        // Add date range filter if provided
        if (start_date || end_date) {
            where.created_at = {};
            if (start_date) {
                where.created_at[Op.gte] = new Date(start_date);
            }
            if (end_date) {
                where.created_at[Op.lte] = new Date(end_date);
            }
        }

        // Get all transactions for stats
        const transactions = await Transaction.findAll({
            where,
            attributes: ['type', 'amount', 'status', 'created_at']
        });

        const stats = calculateTransactionStats(transactions, start_date, end_date);

        res.json({
            success: true,
            data: {
                user: {
                    user_id: user.user_id,
                    user_name: user.user_name,
                    current_balance: parseFloat(user.wallet_balance || 0)
                },
                statistics: stats
            }
        });

    } catch (error) {
        console.error('Error fetching transaction stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch transaction statistics',
            error: error.message
        });
    }
};

/**
 * Calculate comprehensive transaction statistics
 * @param {Array} transactions - Array of transaction objects
 * @param {string} startDate - Start date filter
 * @param {string} endDate - End date filter
 * @returns {Object} Statistics object
 */
const calculateTransactionStats = (transactions, startDate, endDate) => {
    const stats = {
        total_transactions: transactions.length,
        total_amount: 0,
        net_amount: 0,
        type_breakdown: {},
        status_breakdown: {
            completed: 0,
            pending: 0,
            failed: 0,
            cancelled: 0
        },
        recent_activity: {
            last_7_days: 0,
            last_30_days: 0,
            last_90_days: 0
        },
        // Initialize all transaction types
        all_types: {
            deposit: { count: 0, total_amount: 0 },
            withdrawal: { count: 0, total_amount: 0 },
            admin_credit: { count: 0, total_amount: 0 },
            admin_debit: { count: 0, total_amount: 0 },
            game_win: { count: 0, total_amount: 0 },
            game_loss: { count: 0, total_amount: 0 },
            gift_code: { count: 0, total_amount: 0 },
            referral_bonus: { count: 0, total_amount: 0 },
            rebate: { count: 0, total_amount: 0 },
            vip_reward: { count: 0, total_amount: 0 },
            transfer_in: { count: 0, total_amount: 0 },
            transfer_out: { count: 0, total_amount: 0 },
            refund: { count: 0, total_amount: 0 },
            game_move_in: { count: 0, total_amount: 0 },
            game_move_out: { count: 0, total_amount: 0 },
            activity_reward: { count: 0, total_amount: 0 }
        }
    };

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    transactions.forEach(transaction => {
        const amount = parseFloat(transaction.amount);
        const type = transaction.type;
        const status = transaction.status;
        const createdAt = new Date(transaction.created_at);

        // Total amounts
        stats.total_amount += amount;

        // Net amount calculation (positive for credits, negative for debits)
        if (['deposit', 'admin_credit', 'game_win', 'gift_code', 'referral_bonus', 'rebate', 'vip_reward', 'transfer_in', 'game_move_in', 'activity_reward', 'refund'].includes(type)) {
            stats.net_amount += amount;
        } else {
            stats.net_amount -= amount;
        }

        // Status breakdown
        stats.status_breakdown[status]++;

        // Type breakdown
        if (!stats.type_breakdown[type]) {
            stats.type_breakdown[type] = {
                count: 0,
                total_amount: 0
            };
        }
        stats.type_breakdown[type].count++;
        stats.type_breakdown[type].total_amount += amount;

        // All types breakdown
        if (stats.all_types[type]) {
            stats.all_types[type].count++;
            stats.all_types[type].total_amount += amount;
        }

        // Recent activity
        if (createdAt >= sevenDaysAgo) {
            stats.recent_activity.last_7_days++;
        }
        if (createdAt >= thirtyDaysAgo) {
            stats.recent_activity.last_30_days++;
        }
        if (createdAt >= ninetyDaysAgo) {
            stats.recent_activity.last_90_days++;
        }
    });

    // Format amounts
    stats.total_amount = parseFloat(stats.total_amount.toFixed(2));
    stats.net_amount = parseFloat(stats.net_amount.toFixed(2));

    // Format type breakdown amounts
    Object.keys(stats.type_breakdown).forEach(type => {
        stats.type_breakdown[type].total_amount = 
            parseFloat(stats.type_breakdown[type].total_amount.toFixed(2));
    });

    // Format all types amounts
    Object.keys(stats.all_types).forEach(type => {
        stats.all_types[type].total_amount = 
            parseFloat(stats.all_types[type].total_amount.toFixed(2));
    });

    return stats;
};

module.exports = {
    getUserTransactionReport,
    getUserTransactionStats
}; 