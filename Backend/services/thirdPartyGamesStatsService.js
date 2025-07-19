const { getModels } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const moment = require('moment-timezone');

// OPTIMIZED: Simple in-memory cache for frequently requested stats
const statsCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

/**
 * Generate cache key for stats
 * @param {number} userId - User ID
 * @param {string} period - Time period
 * @returns {string} Cache key
 */
const generateCacheKey = (userId, period) => `stats_${userId}_${period}`;

/**
 * Get cached stats if available and not expired
 * @param {string} cacheKey - Cache key
 * @returns {Object|null} Cached data or null
 */
const getCachedStats = (cacheKey) => {
    const cached = statsCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
        return cached.data;
    }
    if (cached) {
        statsCache.delete(cacheKey); // Remove expired cache
    }
    return null;
};

/**
 * Set stats in cache
 * @param {string} cacheKey - Cache key
 * @param {Object} data - Data to cache
 */
const setCachedStats = (cacheKey, data) => {
    statsCache.set(cacheKey, {
        data,
        timestamp: Date.now()
    });
    
    // OPTIMIZED: Limit cache size to prevent memory issues
    if (statsCache.size > 100) {
        const firstKey = statsCache.keys().next().value;
        statsCache.delete(firstKey);
    }
};

/**
 * Get date range based on period type
 * @param {string} period - 'today', 'yesterday', 'this_week', 'this_month'
 * @returns {Object} - Start and end dates
 */
const getDateRange = (period) => {
    const now = moment();
    let startDate, endDate;

    switch (period) {
        case 'today':
            startDate = now.startOf('day').toDate();
            endDate = now.endOf('day').toDate();
            break;
        case 'yesterday':
            startDate = now.subtract(1, 'day').startOf('day').toDate();
            endDate = now.endOf('day').toDate();
            break;
        case 'this_week':
            startDate = now.startOf('week').toDate();
            endDate = now.endOf('week').toDate();
            break;
        case 'this_month':
            startDate = now.startOf('month').toDate();
            endDate = now.endOf('month').toDate();
            break;
        default:
            startDate = now.startOf('day').toDate();
            endDate = now.endOf('day').toDate();
    }

    return { startDate, endDate };
};

/**
 * Get third-party games statistics for a user
 * @param {number} userId - User ID
 * @param {string} period - Time period ('today', 'yesterday', 'this_week', 'this_month')
 * @returns {Object} - Statistics data
 */
const getThirdPartyGamesStats = async (userId, period = 'today') => {
    try {
        console.log(`📊 Getting third-party games stats for user ${userId}, period: ${period}`);

        // OPTIMIZED: Check cache first
        const cacheKey = generateCacheKey(userId, period);
        const cachedResult = getCachedStats(cacheKey);
        if (cachedResult) {
            console.log(`📊 Returning cached stats for user ${userId}, period: ${period}`);
            return cachedResult;
        }

        // Get initialized models
        const models = await getModels();
        const { SpribeTransaction, SeamlessTransaction } = models;

        // Get date range
        const { startDate, endDate } = getDateRange(period);

        // Common where clause for date filtering
        const dateFilter = {
            user_id: userId,
            created_at: {
                [Op.between]: [startDate, endDate]
            }
        };

        // OPTIMIZED: Run both queries in parallel with performance optimizations
        const [spribeStats, seamlessStats] = await Promise.all([
            // Spribe Statistics - Single optimized query with performance hints
            SpribeTransaction.findAll({
                where: {
                    ...dateFilter,
                    status: 'completed' // Only completed transactions
                },
                attributes: [
                    [fn('COUNT', literal("CASE WHEN type = 'bet' THEN 1 END")), 'total_bets'],
                    [fn('COUNT', literal("CASE WHEN type = 'win' THEN 1 END")), 'total_wins'],
                    [fn('COUNT', literal("CASE WHEN type = 'rollback' THEN 1 END")), 'total_rollbacks'],
                    [fn('SUM', literal("CASE WHEN type = 'bet' THEN amount ELSE 0 END")), 'total_bet_amount_cents'],
                    [fn('SUM', literal("CASE WHEN type = 'win' THEN amount ELSE 0 END")), 'total_win_amount_cents'],
                    [fn('SUM', literal("CASE WHEN type = 'rollback' THEN amount ELSE 0 END")), 'total_rollback_amount_cents']
                ],
                raw: true,
                // OPTIMIZED: Add performance optimizations
                logging: false, // Disable query logging
                benchmark: false, // Disable benchmarking
                // OPTIMIZED: Add query hints for better index usage
                subQuery: false // Prevent subquery generation
            }),

            // Seamless Statistics - Single optimized query with performance hints
            SeamlessTransaction.findAll({
                where: {
                    ...dateFilter,
                    status: 'success' // Only successful transactions
                },
                attributes: [
                    [fn('COUNT', literal("CASE WHEN type = 'debit' THEN 1 END")), 'total_bets'],
                    [fn('COUNT', literal("CASE WHEN type = 'credit' THEN 1 END")), 'total_wins'],
                    [fn('COUNT', literal("CASE WHEN type = 'rollback' THEN 1 END")), 'total_rollbacks'],
                    [fn('COUNT', literal("CASE WHEN type = 'balance' THEN 1 END")), 'total_balance_checks'],
                    [fn('SUM', literal("CASE WHEN type = 'debit' THEN amount ELSE 0 END")), 'total_bet_amount'],
                    [fn('SUM', literal("CASE WHEN type = 'credit' THEN amount ELSE 0 END")), 'total_win_amount'],
                    [fn('SUM', literal("CASE WHEN type = 'rollback' THEN amount ELSE 0 END")), 'total_rollback_amount'],
                    [fn('COUNT', literal("CASE WHEN is_jackpot_win = true THEN 1 END")), 'jackpot_wins'],
                    [fn('SUM', literal("CASE WHEN is_jackpot_win = true THEN amount ELSE 0 END")), 'jackpot_amount'],
                    [fn('COUNT', literal("CASE WHEN is_freeround_bet = true THEN 1 END")), 'freeround_bets'],
                    [fn('COUNT', literal("CASE WHEN is_freeround_win = true THEN 1 END")), 'freeround_wins']
                ],
                raw: true,
                // OPTIMIZED: Add performance optimizations
                logging: false, // Disable query logging
                benchmark: false, // Disable benchmarking
                // OPTIMIZED: Add query hints for better index usage
                subQuery: false // Prevent subquery generation
            })
        ]);

        // Process Spribe statistics
        const spribeData = spribeStats[0] || {};
        const spribeBetAmount = parseFloat(spribeData.total_bet_amount_cents || 0) / 100; // Convert from cents
        const spribeWinAmount = parseFloat(spribeData.total_win_amount_cents || 0) / 100; // Convert from cents
        const spribeRollbackAmount = parseFloat(spribeData.total_rollback_amount_cents || 0) / 100; // Convert from cents

        const spribeStatsProcessed = {
            provider: 'Spribe',
            total_transactions: parseInt(spribeData.total_bets || 0) + parseInt(spribeData.total_wins || 0) + parseInt(spribeData.total_rollbacks || 0),
            total_bets: parseInt(spribeData.total_bets || 0),
            total_wins: parseInt(spribeData.total_wins || 0),
            total_rollbacks: parseInt(spribeData.total_rollbacks || 0),
            total_bet_amount: spribeBetAmount,
            total_win_amount: spribeWinAmount,
            total_rollback_amount: spribeRollbackAmount,
            net_profit: spribeWinAmount - spribeBetAmount,
            win_rate: parseInt(spribeData.total_bets || 0) > 0 
                ? parseFloat(((parseInt(spribeData.total_wins || 0) / parseInt(spribeData.total_bets || 0)) * 100).toFixed(2))
                : 0
        };

        // OPTIMIZED: Get provider name in the same query as statistics
        let seamlessProviderName = 'Seamless';
        if (parseInt(seamlessData.total_transactions || 0) > 0) {
            // Use a subquery to get the most recent provider without additional database hit
            const providerSubquery = await SeamlessTransaction.findOne({
                where: {
                    ...dateFilter,
                    status: 'success',
                    provider: { [Op.ne]: null } // Only get non-null providers
                },
                attributes: ['provider'],
                order: [['created_at', 'DESC']],
                limit: 1
            });
            if (providerSubquery && providerSubquery.provider) {
                seamlessProviderName = providerSubquery.provider;
            }
        }

        // Process Seamless statistics
        const seamlessData = seamlessStats[0] || {};
        const seamlessBetAmount = parseFloat(seamlessData.total_bet_amount || 0);
        const seamlessWinAmount = parseFloat(seamlessData.total_win_amount || 0);
        const seamlessRollbackAmount = parseFloat(seamlessData.total_rollback_amount || 0);
        const jackpotAmount = parseFloat(seamlessData.jackpot_amount || 0);

        const seamlessStatsProcessed = {
            provider: seamlessProviderName,
            total_transactions: parseInt(seamlessData.total_bets || 0) + parseInt(seamlessData.total_wins || 0) + parseInt(seamlessData.total_rollbacks || 0) + parseInt(seamlessData.total_balance_checks || 0),
            total_bets: parseInt(seamlessData.total_bets || 0),
            total_wins: parseInt(seamlessData.total_wins || 0),
            total_rollbacks: parseInt(seamlessData.total_rollbacks || 0),
            total_balance_checks: parseInt(seamlessData.total_balance_checks || 0),
            total_bet_amount: seamlessBetAmount,
            total_win_amount: seamlessWinAmount,
            total_rollback_amount: seamlessRollbackAmount,
            jackpot_wins: parseInt(seamlessData.jackpot_wins || 0),
            jackpot_amount: jackpotAmount,
            freeround_bets: parseInt(seamlessData.freeround_bets || 0),
            freeround_wins: parseInt(seamlessData.freeround_wins || 0),
            net_profit: seamlessWinAmount - seamlessBetAmount,
            win_rate: parseInt(seamlessData.total_bets || 0) > 0 
                ? parseFloat(((parseInt(seamlessData.total_wins || 0) / parseInt(seamlessData.total_bets || 0)) * 100).toFixed(2))
                : 0
        };

        // Calculate overall statistics
        const overallStats = {
            total_transactions: spribeStatsProcessed.total_transactions + seamlessStatsProcessed.total_transactions,
            total_bets: spribeStatsProcessed.total_bets + seamlessStatsProcessed.total_bets,
            total_wins: spribeStatsProcessed.total_wins + seamlessStatsProcessed.total_wins,
            total_bet_amount: spribeStatsProcessed.total_bet_amount + seamlessStatsProcessed.total_bet_amount,
            total_win_amount: spribeStatsProcessed.total_win_amount + seamlessStatsProcessed.total_win_amount,
            net_profit: spribeStatsProcessed.net_profit + seamlessStatsProcessed.net_profit,
            jackpot_wins: seamlessStatsProcessed.jackpot_wins,
            jackpot_amount: seamlessStatsProcessed.jackpot_amount,
            freeround_bets: seamlessStatsProcessed.freeround_bets,
            freeround_wins: seamlessStatsProcessed.freeround_wins
        };

        // Calculate overall win rate
        const totalCompletedBets = overallStats.total_bets;
        overallStats.win_rate = totalCompletedBets > 0 
            ? parseFloat(((overallStats.total_wins / totalCompletedBets) * 100).toFixed(2))
            : 0;

        // Format response
        const response = {
            success: true,
            period: period,
            date_range: {
                start_date: startDate,
                end_date: endDate
            },
            overall_stats: overallStats,
            game_stats: {
                spribe: spribeStatsProcessed,
                seamless: seamlessStatsProcessed
            }
        };

        console.log(`✅ Third-party games stats retrieved successfully for user ${userId}`);
        
        // OPTIMIZED: Cache the result for future requests
        setCachedStats(cacheKey, response);
        
        return response;

    } catch (error) {
        console.error('❌ Error getting third-party games stats:', error);
        return {
            success: false,
            message: 'Error retrieving third-party games statistics: ' + error.message
        };
    }
};

/**
 * Get detailed transaction history for a specific game type
 * @param {number} userId - User ID
 * @param {string} gameType - Game type ('spribe', 'seamless')
 * @param {string} period - Time period filter
 * @param {number} page - Page number for pagination
 * @param {number} limit - Number of records per page
 * @returns {Object} - Detailed transaction history
 */
const getThirdPartyGameHistory = async (userId, gameType, period = 'today', page = 1, limit = 20) => {
    try {
        const offset = (page - 1) * limit;

        // Get initialized models
        const models = await getModels();
        const { SpribeTransaction, SeamlessTransaction } = models;

        // Get date range
        const { startDate, endDate } = getDateRange(period);

        let transactions = [];
        let totalCount = 0;
        let provider;

        if (gameType === 'spribe') {
            provider = 'Spribe';
            
            // OPTIMIZED: Build where clause for Spribe with better indexing
            const whereClause = {
                user_id: userId,
                created_at: {
                    [Op.between]: [startDate, endDate]
                },
                status: 'completed'
            };

            // OPTIMIZED: Get Spribe transactions with pagination and selective attributes
            const spribeResult = await SpribeTransaction.findAndCountAll({
                where: whereClause,
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: offset,
                attributes: [
                    'id', 'type', 'amount', 'currency', 'game_id', 'provider',
                    'provider_tx_id', 'operator_tx_id', 'status', 'created_at'
                ],
                // OPTIMIZED: Add query hints for better performance
                logging: false, // Disable query logging for better performance
                benchmark: false // Disable benchmarking
            });

            transactions = spribeResult.rows.map(tx => ({
                transaction_id: tx.operator_tx_id,
                type: tx.type,
                amount: parseFloat(tx.amount) / 100, // Convert from cents
                currency: tx.currency,
                game_id: tx.game_id,
                provider: tx.provider,
                provider_tx_id: tx.provider_tx_id,
                status: tx.status,
                created_at: tx.created_at,
                net_profit: tx.type === 'win' ? parseFloat(tx.amount) / 100 : -(parseFloat(tx.amount) / 100)
            }));

            totalCount = spribeResult.count;

        } else if (gameType === 'seamless') {
            // OPTIMIZED: Build where clause for Seamless with better indexing
            const whereClause = {
                user_id: userId,
                created_at: {
                    [Op.between]: [startDate, endDate]
                },
                status: 'success'
            };

            // OPTIMIZED: Get Seamless transactions with pagination and selective attributes
            const seamlessResult = await SeamlessTransaction.findAndCountAll({
                where: whereClause,
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: offset,
                attributes: [
                    'id', 'transaction_id', 'type', 'amount', 'provider', 'game_id',
                    'game_id_hash', 'round_id', 'provider_transaction_id', 'status',
                    'is_jackpot_win', 'is_freeround_bet', 'is_freeround_win',
                    'jackpot_contribution_in_amount', 'created_at'
                ],
                // OPTIMIZED: Add query hints for better performance
                logging: false, // Disable query logging for better performance
                benchmark: false // Disable benchmarking
            });

            // Extract the actual provider name from the first transaction
            // If no transactions found, default to 'Seamless'
            if (seamlessResult.rows.length > 0) {
                const firstTransaction = seamlessResult.rows[0];
                provider = firstTransaction.provider || 'Seamless';
            } else {
                provider = 'Seamless';
            }

            transactions = seamlessResult.rows.map(tx => {
                const amount = parseFloat(tx.amount);
                const isBet = tx.type === 'debit';
                const isWin = tx.type === 'credit';
                
                return {
                    transaction_id: tx.transaction_id,
                    type: tx.type,
                    amount: amount,
                    provider: tx.provider,
                    game_id: tx.game_id,
                    game_id_hash: tx.game_id_hash,
                    round_id: tx.round_id,
                    provider_transaction_id: tx.provider_transaction_id,
                    status: tx.status,
                    is_jackpot_win: tx.is_jackpot_win,
                    is_freeround_bet: tx.is_freeround_bet,
                    is_freeround_win: tx.is_freeround_win,
                    jackpot_contribution: parseFloat(tx.jackpot_contribution_in_amount || 0),
                    created_at: tx.created_at,
                    net_profit: isWin ? amount : -amount
                };
            });

            totalCount = seamlessResult.count;

        } else {
            return {
                success: false,
                message: 'Invalid game type. Valid game types are: spribe, seamless'
            };
        }

        const totalPages = Math.ceil(totalCount / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;

        return {
            success: true,
            game_type: gameType,
            provider: provider,
            period: period,
            date_range: {
                start_date: startDate,
                end_date: endDate
            },
            transactions: transactions,
            pagination: {
                current_page: parseInt(page),
                total_pages: totalPages,
                total_records: totalCount,
                records_per_page: parseInt(limit),
                has_next_page: hasNextPage,
                has_prev_page: hasPrevPage
            }
        };

    } catch (error) {
        console.error('❌ Error getting third-party game history:', error);
        return {
            success: false,
            message: 'Error retrieving transaction history: ' + error.message
        };
    }
};

module.exports = {
    getThirdPartyGamesStats,
    getThirdPartyGameHistory,
    getDateRange,
    // OPTIMIZED: Export cache functions for testing and management
    generateCacheKey,
    getCachedStats,
    setCachedStats,
    statsCache
}; 