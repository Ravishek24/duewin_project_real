const { Transaction, User } = require('../models');
const { Op } = require('sequelize');

// Define all available game types
const AVAILABLE_GAME_TYPES = ['wingo', 'fiveD', 'k3', 'trx_wix'];

/**
 * Get user's game move transactions with pagination
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getUserGameMoveTransactions = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { 
            page = 1, 
            limit = 20, 
            type, 
            game_type, 
            start_date, 
            end_date,
            status 
        } = req.query;
        
        const offset = (page - 1) * limit;

        // Build where clause
        const where = {
            user_id: user_id,
            type: {
                [Op.in]: ['transfer_in', 'transfer_out']
            }
        };

        // Add type filter if provided
        if (type && ['transfer_in', 'transfer_out'].includes(type)) {
            where.type = type;
        }

        // Add status filter if provided
        if (status && ['pending', 'completed', 'failed', 'cancelled'].includes(status)) {
            where.status = status;
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

        // OPTIMIZATION: Get transactions with selective loading
        const { count, rows: transactions } = await Transaction.findAndCountAll({
            where,
            include: [{
                model: User,
                as: 'creator',
                attributes: ['user_name'] // Only load user_name
            }],
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset),
            attributes: [
                'id', 'user_id', 'type', 'amount', 'status', 
                'description', 'reference_id', 'metadata', 'created_at', 'created_by'
            ] // Only load necessary fields
        });

        // Calculate pagination info
        const totalPages = Math.ceil(count / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        // Format transactions for response
        const formattedTransactions = transactions.map(transaction => {
            const metadata = transaction.metadata || {};
            return {
                id: transaction.id,
                type: transaction.type,
                amount: parseFloat(transaction.amount),
                status: transaction.status,
                description: transaction.description,
                reference_id: transaction.reference_id,
                game_type: metadata.game_type || null,
                game_id: metadata.game_id || null,
                session_id: metadata.session_id || null,
                created_at: transaction.created_at,
                created_by: transaction.creator ? transaction.creator.user_name : null
            };
        });

        res.json({
            success: true,
            data: {
                transactions: formattedTransactions,
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
        console.error('Error getting game move transactions:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting game move transactions'
        });
    }
};

/**
 * Get game move transaction statistics for user
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getGameMoveTransactionStats = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { start_date, end_date, game_type } = req.query;

        // Build where clause
        const where = {
            user_id: user_id,
            type: {
                [Op.in]: ['transfer_in', 'transfer_out']
            }
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
            attributes: ['type', 'amount', 'status', 'metadata', 'created_at']
        });

        // Filter by game_type if provided
        let filteredTransactions = transactions;
        if (game_type) {
            const gameTypes = game_type.split(',').map(gt => gt.trim());
            filteredTransactions = transactions.filter(transaction => {
                const metadata = transaction.metadata;
                return metadata && metadata.game_type && gameTypes.includes(metadata.game_type);
            });
        }

        // Calculate statistics
        const stats = {
            total_transactions: filteredTransactions.length,
            move_in_count: filteredTransactions.filter(t => t.type === 'transfer_in').length,
            move_out_count: filteredTransactions.filter(t => t.type === 'transfer_out').length,
            total_move_in_amount: 0,
            total_move_out_amount: 0,
            game_type_breakdown: {},
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
            // Initialize all game types with zero counts
            all_game_types: {}
        };

        // Initialize all available game types
        AVAILABLE_GAME_TYPES.forEach(gameType => {
            stats.all_game_types[gameType] = {
                count: 0,
                move_in_count: 0,
                move_out_count: 0,
                total_amount: 0
            };
        });

        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

        filteredTransactions.forEach(transaction => {
            const amount = parseFloat(transaction.amount);
            const metadata = transaction.metadata || {};

            // Calculate amounts
            if (transaction.type === 'transfer_in') {
                stats.total_move_in_amount += amount;
            } else if (transaction.type === 'transfer_out') {
                stats.total_move_out_amount += amount;
            }

            // Status breakdown
            stats.status_breakdown[transaction.status]++;

            // Game type breakdown
            const gameType = metadata.game_type || 'unknown';
            if (!stats.game_type_breakdown[gameType]) {
                stats.game_type_breakdown[gameType] = {
                    count: 0,
                    total_amount: 0
                };
            }
            stats.game_type_breakdown[gameType].count++;
            stats.game_type_breakdown[gameType].total_amount += amount;

            // All game types breakdown
            if (stats.all_game_types[gameType]) {
                stats.all_game_types[gameType].count++;
                if (transaction.type === 'transfer_in') {
                    stats.all_game_types[gameType].move_in_count++;
                } else if (transaction.type === 'transfer_out') {
                    stats.all_game_types[gameType].move_out_count++;
                }
                stats.all_game_types[gameType].total_amount += amount;
            }

            // Recent activity
            const createdAt = new Date(transaction.created_at);
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
        stats.total_move_in_amount = parseFloat(stats.total_move_in_amount.toFixed(2));
        stats.total_move_out_amount = parseFloat(stats.total_move_out_amount.toFixed(2));

        // Format game type breakdown amounts
        Object.keys(stats.game_type_breakdown).forEach(gameType => {
            stats.game_type_breakdown[gameType].total_amount = 
                parseFloat(stats.game_type_breakdown[gameType].total_amount.toFixed(2));
        });

        // Format all game types amounts
        Object.keys(stats.all_game_types).forEach(gameType => {
            stats.all_game_types[gameType].total_amount = 
                parseFloat(stats.all_game_types[gameType].total_amount.toFixed(2));
        });

        res.json({
            success: true,
            data: stats,
            available_game_types: AVAILABLE_GAME_TYPES
        });

    } catch (error) {
        console.error('Error fetching game move transaction stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch game move transaction statistics',
            error: error.message
        });
    }
};

/**
 * Get specific game move transaction by ID
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
const getGameMoveTransactionById = async (req, res) => {
    try {
        const user_id = req.user.user_id;
        const { id } = req.params;

        const transaction = await Transaction.findOne({
            where: {
                id: id,
                user_id: user_id,
                type: {
                    [Op.in]: ['transfer_in', 'transfer_out']
                }
            },
            include: [{
                model: User,
                as: 'creator',
                attributes: ['user_name']
            }]
        });

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: 'Game move transaction not found'
            });
        }

        const metadata = transaction.metadata || {};
        const formattedTransaction = {
            id: transaction.id,
            type: transaction.type,
            amount: parseFloat(transaction.amount),
            status: transaction.status,
            description: transaction.description,
            reference_id: transaction.reference_id,
            game_type: metadata.game_type || null,
            room_duration: metadata.room_duration || null,
            room_id: metadata.room_id || null,
            action: metadata.action || null,
            wallet_balance: metadata.wallet_balance || null,
            created_at: transaction.created_at,
            updated_at: transaction.updated_at,
            created_by: transaction.creator ? transaction.creator.user_name : null,
            metadata: transaction.metadata
        };

        res.json({
            success: true,
            data: formattedTransaction
        });

    } catch (error) {
        console.error('Error fetching game move transaction:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch game move transaction',
            error: error.message
        });
    }
};

module.exports = {
    getUserGameMoveTransactions,
    getGameMoveTransactionStats,
    getGameMoveTransactionById
}; 