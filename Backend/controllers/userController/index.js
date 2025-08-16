const loginController = require('./loginController');
const registerController = require('./registerController');
const { validateTokenController, resetPasswordController } = require('./resetPasswordController');
const { verifyEmailController, resendVerificationController } = require('./emailVerificationController');
const { getProfileController, updateProfileController } = require('./profileController');
const forgotPasswordController = require('./forgotPasswordController');
const { getInHouseGamesStatsController, getGameBetHistoryController } = require('./inHouseGamesStatsController');
const { getThirdPartyGamesStatsController, getThirdPartyGameHistoryController } = require('./thirdPartyGamesStatsController');
const { User } = require('../../models');
const { Op } = require('sequelize');
const { 
    BetRecordWingo, 
    BetResultWingo, 
    BetRecord5D, 
    BetResult5D, 
    BetRecordK3, 
    BetResultK3, 
    SeamlessTransaction, 
    SeamlessGameSession,
    GamePeriod,
    WalletRecharge,
    PaymentGateway,
    WalletWithdrawal,
    BankAccount,
    UsdtAccount,
    Transaction,
    Referral,
    UserRebateLevel,
    RebateLevel
} = require('../../models');

// Import ReferralCommission directly
let ReferralCommission;
try {
    ReferralCommission = require('../../models/ReferralCommission');
} catch (error) {
    console.log('ReferralCommission model not found, commission features will be disabled');
    ReferralCommission = null;
}

const createSessionService = require('../../services/sessionService');

/**
 * Get user details for admin with correct financial data aggregation
 * ✅ FIXED: Now uses wallet_recharges and wallet_withdrawals tables for accurate deposit/withdrawal amounts
 * ✅ OPTIMIZED: Single query for both financial aggregations with fallback to separate queries
 * ✅ PERFORMANCE: Fast aggregation using SUM() with proper indexing on user_id and status
 */
const getUserDetailsForAdmin = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        // Base where clause to exclude admin users
        let whereClause = {
            is_admin: false // Exclude admin users
        };
        
        // Add search conditions if search term is provided
        if (search) {
            whereClause = {
                ...whereClause,
                [Op.or]: [
                    { user_id: search },
                    { phone_no: search },
                    { email: search }
                ]
            };
        }

        // Get total count for pagination
        const totalUsers = await User.count({
            where: whereClause
        });

        // Get users with pagination
        const users = await User.findAll({
            where: whereClause,
            attributes: [
                'user_id',
                'phone_no',
                'wallet_balance',
                'is_phone_verified',
                'is_blocked',
                'block_reason',
                'current_ip',
                'registration_ip',
                'last_login_ip',
                'last_login_at',
                'referring_code',
                'referral_code',
                'created_at'
            ],
            order: [['created_at', 'DESC']], // Show newest users first
            limit: parseInt(limit),
            offset: offset
        });

        // Debug: Check actual database values for is_blocked
        if (users.length > 0) {
            const debugUser = await User.findByPk(users[0].user_id, {
                attributes: ['user_id', 'is_blocked'],
                raw: true
            });
            console.log('Debug - Direct DB query result:', debugUser);
        }

        // Get total commission for each user (with safety check)
        const userIds = users.map(user => user.user_id);
        let commissionMap = {};
        
        if (ReferralCommission) {
            try {
                // Use raw query as fallback to avoid Sequelize aggregation issues
                const userCommissions = await User.sequelize.query(`
                    SELECT user_id, SUM(amount) as total_commission 
                    FROM referral_commissions 
                    WHERE user_id IN (:userIds) 
                    GROUP BY user_id
                `, {
                    replacements: { userIds },
                    type: User.sequelize.QueryTypes.SELECT
                });

                // Create a map for quick lookup
                userCommissions.forEach(commission => {
                    commissionMap[commission.user_id] = parseFloat(commission.total_commission || 0);
                });
            } catch (commissionError) {
                console.error('Error fetching commission data:', commissionError);
                // Continue without commission data
                commissionMap = {};
            }
        } else {
            console.log('ReferralCommission model not available, skipping commission calculation');
        }

        // ✅ FAST AGGREGATION: Get total deposit and withdrawal amounts from actual transaction tables
        // This replaces the incorrect usage of users.actual_deposit_amount and users.total_bet_amount
        let depositMap = {};
        let withdrawalMap = {};
        const startTime = Date.now();
        
        try {
            // Single optimized query to get both deposit and withdrawal totals
            const userFinancials = await User.sequelize.query(`
                SELECT 
                    user_id,
                    SUM(CASE WHEN source = 'deposit' THEN amount ELSE 0 END) as total_deposit_amount,
                    SUM(CASE WHEN source = 'withdrawal' THEN amount ELSE 0 END) as total_withdrawal_amount
                FROM (
                    -- Deposits from wallet_recharges
                    SELECT user_id, amount, 'deposit' as source
                    FROM wallet_recharges 
                    WHERE user_id IN (:userIds) AND (
                        status IN ('completed', 'success', 'paid', 'processed', 'settled')
                        OR status = '' OR status IS NULL
                    )
                    UNION ALL
                    -- Withdrawals (treat empty/NULL as completed in some datasets)
                    SELECT user_id, amount, 'withdrawal' as source
                    FROM wallet_withdrawals 
                    WHERE user_id IN (:userIds) AND (
                        status IN ('completed', 'approved', 'success', 'paid', 'processed', 'settled', 'payout_success')
                        OR status = '' OR status IS NULL
                    )
                ) combined_financials
                GROUP BY user_id
            `, {
                replacements: { userIds },
                type: User.sequelize.QueryTypes.SELECT
            });

            // Create maps for quick lookup
            userFinancials.forEach(financial => {
                depositMap[financial.user_id] = parseFloat(financial.total_deposit_amount || 0);
                withdrawalMap[financial.user_id] = parseFloat(financial.total_withdrawal_amount || 0);
            });
            
            console.log(`✅ Financial aggregation completed in ${Date.now() - startTime}ms for ${userIds.length} users`);
        } catch (financialError) {
            console.error('Error fetching financial data:', financialError);
            // Fallback to separate queries if the combined query fails
            try {
                console.log('🔄 Falling back to separate queries...');
                // Fallback: Separate deposit query
                const rechargeDeposits = await User.sequelize.query(`
                    SELECT user_id, SUM(amount) as total_deposit_amount 
                    FROM wallet_recharges 
                    WHERE user_id IN (:userIds) AND (
                        status IN ('completed', 'success', 'paid', 'processed', 'settled')
                        OR status = '' OR status IS NULL
                    )
                    GROUP BY user_id
                `, {
                    replacements: { userIds },
                    type: User.sequelize.QueryTypes.SELECT
                });
                rechargeDeposits.forEach(deposit => {
                    depositMap[deposit.user_id] = (depositMap[deposit.user_id] || 0) + parseFloat(deposit.total_deposit_amount || 0);
                });

                // Fallback: Separate withdrawal query
                const userWithdrawals = await User.sequelize.query(`
                    SELECT user_id, SUM(amount) as total_withdrawal_amount 
                    FROM wallet_withdrawals 
                    WHERE user_id IN (:userIds) AND (
                        status IN ('completed', 'approved', 'success', 'paid', 'processed', 'settled', 'payout_success')
                        OR status = '' OR status IS NULL
                    )
                    GROUP BY user_id
                `, {
                    replacements: { userIds },
                    type: User.sequelize.QueryTypes.SELECT
                });
                userWithdrawals.forEach(withdrawal => {
                    withdrawalMap[withdrawal.user_id] = parseFloat(withdrawal.total_withdrawal_amount || 0);
                });
                
                console.log(`✅ Fallback queries completed in ${Date.now() - startTime}ms`);
            } catch (fallbackError) {
                console.error('Fallback queries also failed:', fallbackError);
                depositMap = {};
                withdrawalMap = {};
            }
        }

        // Debug: Log first user to see what we're getting
        if (users.length > 0) {
            console.log('Debug - First user data:', {
                user_id: users[0].user_id,
                is_blocked: users[0].is_blocked,
                is_blocked_type: typeof users[0].is_blocked,
                raw_user: users[0].toJSON ? users[0].toJSON() : users[0]
            });
        }

        const formattedUsers = users.map((user, index) => {
            // Handle is_blocked properly - check for null, undefined, or falsy values
            let isBlocked = false;
            if (user.is_blocked !== null && user.is_blocked !== undefined) {
                isBlocked = Boolean(user.is_blocked);
            }
            
            // Prefer last_login_ip if available; fall back to current_ip
            const loginIp = user.last_login_ip || user.current_ip || null;
            
            return {
                sl: offset + index + 1, // Correct serial number based on pagination
                user_id: user.user_id,
                mobile_number: user.phone_no,
                balance: user.wallet_balance,
                status: user.is_phone_verified ? 'Verified' : 'Unverified',
                is_blocked: isBlocked,
                block_reason: isBlocked ? user.block_reason : null,
                total_commission: commissionMap[user.user_id] || 0,
                login_ip: loginIp,
                register_ip: user.registration_ip,
                last_login_ip: user.last_login_ip || null,
                last_login_at: user.last_login_at || null,
                referring_code: user.referring_code || null,
                referral_code: user.referral_code || null,
                total_deposit: depositMap[user.user_id] || 0,
                total_withdrawal: withdrawalMap[user.user_id] || 0,
                registered_at: user.created_at
            };
        });

        res.status(200).json({
            success: true,
            data: formattedUsers,
            pagination: {
                current_page: parseInt(page),
                total_pages: Math.ceil(totalUsers / parseInt(limit)),
                total_users: totalUsers,
                users_per_page: parseInt(limit),
                has_next_page: offset + users.length < totalUsers,
                has_prev_page: parseInt(page) > 1
            }
        });
    } catch (error) {
        console.error('Error in getUserDetailsForAdmin:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getUserBetHistory = async (req, res) => {
    try {
        const { user_id } = req.params;
        const { start_date, end_date, page = 1, limit = 50 } = req.query;
        
        const offset = (page - 1) * limit;
        
        // Get total count for pagination
        const totalCountResult = await User.sequelize.query(`
            SELECT COUNT(*) as total FROM (
                (SELECT bet_id FROM bet_record_wingos 
                 WHERE user_id = :userId 
                 ${start_date ? 'AND created_at >= :startDate' : ''}
                 ${end_date ? 'AND created_at <= :endDate' : ''})
                
                UNION ALL
                
                (SELECT bet_id FROM bet_record_5ds 
                 WHERE user_id = :userId
                 ${start_date ? 'AND created_at >= :startDate' : ''}
                 ${end_date ? 'AND created_at <= :endDate' : ''})
                
                UNION ALL
                
                (SELECT bet_id FROM bet_record_k3s 
                 WHERE user_id = :userId
                 ${start_date ? 'AND created_at >= :startDate' : ''}
                 ${end_date ? 'AND created_at <= :endDate' : ''})
                
                UNION ALL
                
                (SELECT bet_id FROM bet_record_trx_wix 
                 WHERE user_id = :userId
                 ${start_date ? 'AND created_at >= :startDate' : ''}
                 ${end_date ? 'AND created_at <= :endDate' : ''})
            ) as combined_bets
        `, {
            replacements: { 
                userId: user_id, 
                startDate: start_date,
                endDate: end_date
            },
            type: User.sequelize.QueryTypes.SELECT
        });
        
        const totalCount = totalCountResult[0]?.total || 0;
        
        // 🚀 SINGLE OPTIMIZED QUERY (was 4-6 queries)
        const allBets = await User.sequelize.query(`
            (SELECT 
                'wingo' as game_type, bet_id, created_at, bet_amount, 
                win_amount, status, 'Internal' as type, wallet_balance_after
             FROM bet_record_wingos 
             WHERE user_id = :userId 
             ${start_date ? 'AND created_at >= :startDate' : ''}
             ${end_date ? 'AND created_at <= :endDate' : ''})
            
            UNION ALL
            
            (SELECT 
                'fiveD' as game_type, bet_id, created_at, bet_amount,
                win_amount, status, 'Internal' as type, wallet_balance_after
             FROM bet_record_5ds 
             WHERE user_id = :userId
             ${start_date ? 'AND created_at >= :startDate' : ''}
             ${end_date ? 'AND created_at <= :endDate' : ''})
            
            UNION ALL
            
            (SELECT 
                'k3' as game_type, bet_id, created_at, bet_amount,
                win_amount, status, 'Internal' as type, wallet_balance_after
             FROM bet_record_k3s 
             WHERE user_id = :userId
             ${start_date ? 'AND created_at >= :startDate' : ''}
             ${end_date ? 'AND created_at <= :endDate' : ''})
            
            UNION ALL
            
            (SELECT 
                'trxWix' as game_type, bet_id, created_at, bet_amount,
                win_amount, status, 'Internal' as type, wallet_balance_after
             FROM bet_record_trx_wix 
             WHERE user_id = :userId
             ${start_date ? 'AND created_at >= :startDate' : ''}
             ${end_date ? 'AND created_at <= :endDate' : ''})
            
            ORDER BY created_at DESC
            LIMIT :limit OFFSET :offset
        `, {
            replacements: { 
                userId: user_id, 
                startDate: start_date,
                endDate: end_date,
                limit: parseInt(limit),
                offset: offset
            },
            type: User.sequelize.QueryTypes.SELECT
        });
        
        res.status(200).json({
            success: true,
            data: allBets,
            pagination: {
                total: totalCount,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalCount / limit),
                hasNextPage: (parseInt(page) * parseInt(limit)) < totalCount,
                hasPrevPage: parseInt(page) > 1
            }
        });
    } catch (error) {
        console.error('Error in getUserBetHistory:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getUserDepositHistory = async (req, res) => {
    try {
        const { user_id } = req.params;
        const { start_date, end_date, page = 1, limit = 50 } = req.query;
        
        const offset = (page - 1) * limit;

        // Validate user exists
        const user = await User.findByPk(user_id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Build date filter if provided
        let dateFilter = {};
        if (start_date && end_date) {
            dateFilter = {
                created_at: {
                    [Op.between]: [new Date(start_date), new Date(end_date)]
                }
            };
        }

        // Get total count for pagination
        const totalCount = await WalletRecharge.count({
            where: {
                user_id,
                ...dateFilter
            }
        });

        // Get deposit history with pagination
        const deposits = await WalletRecharge.findAll({
            where: {
                user_id,
                ...dateFilter
            },
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        // Format deposits
        const formattedDeposits = deposits.map((deposit, index) => ({
            deposit_id: deposit.id,
            date: deposit.created_at,
            amount: deposit.amount,
            method: deposit.payment_gateway_name || 'Unknown',
            status: deposit.status
        }));

        res.status(200).json({
            success: true,
            data: formattedDeposits,
            pagination: {
                total: totalCount,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalCount / limit),
                hasNextPage: (parseInt(page) * parseInt(limit)) < totalCount,
                hasPrevPage: parseInt(page) > 1
            }
        });
    } catch (error) {
        console.error('Error in getUserDepositHistory:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getUserWithdrawalHistory = async (req, res) => {
    try {
        const { user_id } = req.params;
        const { start_date, end_date, page = 1, limit = 50 } = req.query;
        
        const offset = (page - 1) * limit;

        // Validate user exists
        const user = await User.findByPk(user_id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Build date filter if provided
        let dateFilter = {};
        if (start_date && end_date) {
            dateFilter = {
                created_at: {
                    [Op.between]: [new Date(start_date), new Date(end_date)]
                }
            };
        }

        // Get total count for pagination
        const totalCount = await WalletWithdrawal.count({
            where: {
                user_id,
                ...dateFilter
            }
        });

        // Get withdrawal history with pagination
        const withdrawals = await WalletWithdrawal.findAll({
            where: {
                user_id,
                ...dateFilter
            },
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        // Format withdrawals
        const formattedWithdrawals = withdrawals.map((withdrawal, index) => {
            let method = 'Unknown';
            
            // Determine withdrawal method based on available fields
            if (withdrawal.bank_name && withdrawal.account_number) {
                method = `${withdrawal.bank_name} (${withdrawal.account_number})`;
            } else if (withdrawal.network && withdrawal.address) {
                method = `USDT (${withdrawal.network})`;
            } else if (withdrawal.payment_gateway_name) {
                method = withdrawal.payment_gateway_name;
            }

            return {
                withdrawal_id: withdrawal.id,
                date: withdrawal.created_at,
                amount: withdrawal.amount,
                method: method,
                status: withdrawal.status
            };
        });

        res.status(200).json({
            success: true,
            data: formattedWithdrawals,
            pagination: {
                total: totalCount,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalCount / limit),
                hasNextPage: (parseInt(page) * parseInt(limit)) < totalCount,
                hasPrevPage: parseInt(page) > 1
            }
        });
    } catch (error) {
        console.error('Error in getUserWithdrawalHistory:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getUserBankDetails = async (req, res) => {
    try {
        const { user_id } = req.params;

        // Validate user exists
        const user = await User.findByPk(user_id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get bank accounts - using raw query to avoid model import issues
        const bankAccounts = await User.sequelize.query(`
            SELECT id, bank_name, account_number, account_holder, ifsc_code, is_primary, created_at
            FROM bank_accounts 
            WHERE user_id = :userId
            ORDER BY is_primary DESC, created_at DESC
        `, {
            replacements: { userId: user_id },
            type: User.sequelize.QueryTypes.SELECT
        });

        // Get USDT accounts - using raw query to avoid model import issues
        const usdtAccounts = await User.sequelize.query(`
            SELECT id, network, address, remark, created_at
            FROM usdt_accounts 
            WHERE user_id = :userId
            ORDER BY created_at DESC
        `, {
            replacements: { userId: user_id },
            type: User.sequelize.QueryTypes.SELECT
        });

        // Format bank accounts
        const formattedBankAccounts = bankAccounts.map(account => ({
            account_id: account.id,
            bank_name: account.bank_name,
            account_number: account.account_number,
            account_holder: account.account_holder,
            ifsc_code: account.ifsc_code,
            is_primary: Boolean(account.is_primary),
            created_at: account.created_at
        }));

        // Format USDT accounts
        const formattedUsdtAccounts = usdtAccounts.map(account => ({
            account_id: account.id,
            network: account.network,
            address: account.address,
            remark: account.remark,
            created_at: account.created_at
        }));

        res.status(200).json({
            success: true,
            data: {
                bank_accounts: formattedBankAccounts,
                usdt_accounts: formattedUsdtAccounts
            }
        });
    } catch (error) {
        console.error('Error in getUserBankDetails:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getUserTransactionHistory = async (req, res) => {
    try {
        const { user_id } = req.params;
        const { start_date, end_date, page = 1, limit = 50 } = req.query;
        
        const offset = (page - 1) * limit;

        // Validate user exists
        const user = await User.findByPk(user_id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Build date filter if provided
        let dateFilter = {};
        if (start_date && end_date) {
            dateFilter = {
                created_at: {
                    [Op.between]: [new Date(start_date), new Date(end_date)]
                }
            };
        }

        // Get total count for pagination
        const totalCount = await Transaction.count({
            where: {
                user_id,
                ...dateFilter
            }
        });

        // Get transaction history with pagination
        const transactions = await Transaction.findAll({
            where: {
                user_id,
                ...dateFilter
            },
            order: [['created_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        // Format transactions
        const formattedTransactions = transactions.map(transaction => {
            let method = 'Unknown';
            
            // Determine method based on transaction type and description
            if (transaction.description) {
                method = transaction.description;
            } else if (transaction.type) {
                method = transaction.type;
            }

            return {
                transaction_id: transaction.id,
                date: transaction.created_at,
                type: transaction.type,
                amount: transaction.amount,
                method: method,
                status: transaction.status,
                reference_id: transaction.reference_id
            };
        });

        res.status(200).json({
            success: true,
            data: formattedTransactions,
            pagination: {
                total: totalCount,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalCount / limit),
                hasNextPage: (parseInt(page) * parseInt(limit)) < totalCount,
                hasPrevPage: parseInt(page) > 1
            }
        });
    } catch (error) {
        console.error('Error in getUserTransactionHistory:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getUserTeamSummary = async (req, res) => {
    try {
        const { user_id } = req.params;
        const startTime = Date.now();

        // Get user's referral tree
        const userTree = await User.sequelize.query(`
            SELECT level_1, level_2, level_3, level_4, level_5, level_6
            FROM referral_trees 
            WHERE user_id = :userId
        `, {
            replacements: { userId: user_id },
            type: User.sequelize.QueryTypes.SELECT
        });

        if (!userTree || userTree.length === 0) {
            return res.status(200).json({
                success: true,
                data: []
            });
        }

        const tree = userTree[0];
        const teamStats = [];

        // Process each level (1-6) with OPTIMIZED aggregation
        for (let level = 1; level <= 6; level++) {
            const levelField = `level_${level}`;
            const levelData = tree[levelField];
            
            if (levelData && levelData.trim()) {
                // Parse user IDs from the level data (comma-separated)
                const userIds = levelData.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                
                if (userIds.length > 0) {
                    console.log(`🚀 Processing level ${level} with ${userIds.length} users...`);
                    
                    // ✅ OPTIMIZED: Single query for user details + financial aggregation
                    const levelStats = await User.sequelize.query(`
                        SELECT 
                            COUNT(DISTINCT u.user_id) as member_count,
                            COUNT(CASE WHEN u.is_active = 1 AND u.last_login_at > DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as active_members,
                            COALESCE(SUM(u.wallet_balance), 0) as total_team_balance,
                            -- Fast deposit aggregation from wallet_recharges
                            COALESCE((
                                SELECT SUM(amount) 
                                FROM wallet_recharges 
                                WHERE user_id IN (:userIds) AND (
                                    status IN ('completed', 'success', 'paid', 'processed', 'settled')
                                    OR status = '' OR status IS NULL
                                )
                            ), 0) as total_recharge,
                            -- Fast withdrawal aggregation from wallet_withdrawals  
                            COALESCE((
                                SELECT SUM(amount) 
                                FROM wallet_withdrawals 
                                WHERE user_id IN (:userIds) AND (
                                    status IN ('completed', 'approved', 'success', 'paid', 'processed', 'settled', 'payout_success')
                                    OR status = '' OR status IS NULL
                                )
                            ), 0) as total_withdraw
                        FROM users u
                        WHERE u.user_id IN (:userIds)
                    `, {
                        replacements: { userIds },
                        type: User.sequelize.QueryTypes.SELECT
                    });

                    const stats = levelStats[0];
                    
                    teamStats.push({
                        level: level,
                        member_count: parseInt(stats.member_count || 0),
                        active_members: parseInt(stats.active_members || 0),
                        total_team_balance: parseFloat(stats.total_team_balance || 0),
                        total_recharge: parseFloat(stats.total_recharge || 0),
                        total_withdraw: parseFloat(stats.total_withdraw || 0)
                    });
                    
                    console.log(`✅ Level ${level} processed in ${Date.now() - startTime}ms`);
                }
            }
        }

        const totalProcessingTime = Date.now() - startTime;
        console.log(`🚀 Team summary completed in ${totalProcessingTime}ms for user ${user_id}`);

        res.status(200).json({
            success: true,
            data: teamStats,
            performance: {
                processing_time_ms: totalProcessingTime,
                total_levels: teamStats.length,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error in getUserTeamSummary:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getUserTeamLevelStats = async (req, res) => {
    try {
        const startTime = Date.now(); // Track total processing time
        const { user_id } = req.params;
        const { start_date, end_date, period, include_user_details = false } = req.query;
        
        console.log(`📊 Getting team level stats for user ${user_id} with period:`, period, 'and dates:', { start_date, end_date });
        
        // Handle default periods
        let finalStartDate = start_date;
        let finalEndDate = end_date;
        
        if (period) {
            const now = new Date();
            
            switch (period.toLowerCase()) {
                case 'today':
                    finalStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 19).replace('T', ' ');
                    finalEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString().slice(0, 19).replace('T', ' ');
                    break;
                case 'yesterday':
                    finalStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString().slice(0, 19).replace('T', ' ');
                    finalEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 19).replace('T', ' ');
                    break;
                case 'all':
                    finalStartDate = null;
                    finalEndDate = null;
                    break;
                default:
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid period. Use "today", "yesterday", or "all"'
                    });
            }
            
            console.log(`📅 Period "${period}" resolved to:`, { finalStartDate, finalEndDate });
        }

        // ✅ FIXED: Build referral tree dynamically instead of using broken referral_trees table
        console.log('🔧 Building referral tree dynamically from user relationships...');
        
        const allUserIds = [];
        const levelMapping = {}; // This maintains which level each user belongs to
        
        // Get target user's referral code
        const targetUser = await User.findByPk(user_id, {
            attributes: ['referral_code']
        });
        
        if (!targetUser || !targetUser.referral_code) {
            console.log('⚠️ Target user has no referral code, no team members');
            return res.status(200).json({
                success: true,
                data: [],
                summary: {
                    total_users: 0,
                    total_levels: 0,
                    date_range: { start_date: finalStartDate, end_date: finalEndDate },
                    processing_time: new Date().toISOString()
                },
                performance: {
                    processing_time_ms: Date.now() - startTime,
                    query_time_ms: 0,
                    total_levels: 0,
                    timestamp: new Date().toISOString()
                }
            });
        }
        
        // Build referral tree dynamically level by level
        const processedUsers = new Set(); // Track processed users to avoid duplicates
        const levelUsers = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
        
        // Level 1: Direct referrals (users who used this user's referral code)
        const level1Users = await User.findAll({
            where: { referral_code: targetUser.referral_code },
            attributes: ['user_id']
        });
        
        level1Users.forEach(user => {
            if (!processedUsers.has(user.user_id)) {
                levelUsers[1].push(user.user_id);
                allUserIds.push(user.user_id);
                levelMapping[user.user_id] = 1;
                processedUsers.add(user.user_id);
            }
        });
        
        console.log(`✅ Level 1: Found ${level1Users.length} direct referrals`);
        
        // Build levels 2-6 dynamically
        for (let currentLevel = 2; currentLevel <= 6; currentLevel++) {
            const previousLevelUsers = levelUsers[currentLevel - 1] || [];
            const currentLevelUserIds = [];
            
            for (const prevUserId of previousLevelUsers) {
                // Get users referred by this previous level user
                const nextLevelUsers = await User.findAll({
                    where: { referral_code: prevUserId },
                    attributes: ['user_id']
                });
                
                nextLevelUsers.forEach(user => {
                    if (!processedUsers.has(user.user_id)) {
                        currentLevelUserIds.push(user.user_id);
                        allUserIds.push(user.user_id);
                        levelMapping[user.user_id] = currentLevel;
                        processedUsers.add(user.user_id);
                    }
                });
            }
            
            levelUsers[currentLevel] = currentLevelUserIds;
            console.log(`✅ Level ${currentLevel}: Found ${currentLevelUserIds.length} users`);
        }

        if (allUserIds.length === 0) {
            return res.status(200).json({ success: true, data: [] });
        }

        console.log(`📊 Processing ${allUserIds.length} users across all levels`);
        const queryStartTime = Date.now();

        // Build date filter for user registration (not transactions)
        let dateFilter = '';
        if (finalStartDate && finalEndDate) {
            dateFilter = `AND u.created_at BETWEEN '${finalStartDate}' AND '${finalEndDate}'`;
        } else if (finalStartDate) {
            dateFilter = `AND u.created_at >= '${finalStartDate}'`;
        } else if (finalEndDate) {
            dateFilter = `AND u.created_at <= '${finalEndDate}'`;
        }

        // ✅ OPTIMIZED: Single query for all users with comprehensive stats from correct tables
        console.log(`🔍 Applying date filter: ${dateFilter || 'No date filter'}`);
        console.log(`📊 Querying financial stats for ${allUserIds.length} users...`);
        
        const allStats = await User.sequelize.query(`
            SELECT 
                u.user_id,
                ${include_user_details === 'true' ? 'u.user_name, u.phone, u.email,' : ''}
                -- Deposit stats from wallet_recharges
                COALESCE((
                    SELECT COUNT(*) 
                    FROM wallet_recharges 
                    WHERE user_id = u.user_id AND (
                        status IN ('completed', 'success', 'paid', 'processed', 'settled')
                        OR status = '' OR status IS NULL
                    )
                ), 0) as deposit_count,
                COALESCE((
                    SELECT SUM(amount) 
                    FROM wallet_recharges 
                    WHERE user_id = u.user_id AND (
                        status IN ('completed', 'success', 'paid', 'processed', 'settled')
                        OR status = '' OR status IS NULL
                    )
                ), 0) as total_deposit_amount,
                COALESCE((
                    SELECT MIN(created_at) 
                    FROM wallet_recharges 
                    WHERE user_id = u.user_id AND (
                        status IN ('completed', 'success', 'paid', 'processed', 'settled')
                        OR status = '' OR status IS NULL
                    )
                ), NULL) as first_deposit_date,
                -- Withdrawal stats from wallet_withdrawals
                COALESCE((
                    SELECT COUNT(*) 
                    FROM wallet_withdrawals 
                    WHERE user_id = u.user_id AND (
                        status IN ('completed', 'approved', 'success', 'paid', 'processed', 'settled', 'payout_success')
                        OR status = '' OR status IS NULL
                    )
                ), 0) as withdrawal_count,
                COALESCE((
                    SELECT SUM(amount) 
                    FROM wallet_withdrawals 
                    WHERE user_id = u.user_id AND (
                        status IN ('completed', 'approved', 'success', 'paid', 'processed', 'settled', 'payout_success')
                        OR status = '' OR status IS NULL
                    )
                ), 0) as total_withdrawal_amount,
                -- Combined transaction count
                COALESCE((
                    SELECT COUNT(*) 
                    FROM wallet_recharges 
                    WHERE user_id = u.user_id AND (
                        status IN ('completed', 'success', 'paid', 'processed', 'settled')
                        OR status = '' OR status IS NULL
                    )
                ), 0) + COALESCE((
                    SELECT COUNT(*) 
                    FROM wallet_withdrawals 
                    WHERE user_id = u.user_id AND (
                        status IN ('completed', 'approved', 'success', 'paid', 'processed', 'settled', 'payout_success')
                        OR status = '' OR status IS NULL
                    )
                ), 0) as total_transaction_count,
                -- Net amount calculation
                COALESCE((
                    SELECT SUM(amount) 
                    FROM wallet_recharges 
                    WHERE user_id = u.user_id AND (
                        status IN ('completed', 'success', 'paid', 'processed', 'settled')
                        OR status = '' OR status IS NULL
                    )
                ), 0) - COALESCE((
                    SELECT SUM(amount) 
                    FROM wallet_withdrawals 
                    WHERE user_id = u.user_id AND (
                        status IN ('completed', 'approved', 'success', 'paid', 'processed', 'settled', 'payout_success')
                        OR status = '' OR status IS NULL
                    )
                ), 0) as net_amount
            FROM users u
            WHERE u.user_id IN (:userIds) ${dateFilter}
            GROUP BY u.user_id${include_user_details === 'true' ? ', u.user_name, u.phone, u.email' : ''}
        `, {
            replacements: { userIds: allUserIds },
            type: User.sequelize.QueryTypes.SELECT
        });

        console.log(`✅ Financial aggregation query completed in ${Date.now() - queryStartTime}ms`);
        
        // ✅ OPTIMIZATION: Initialize level stats with level information
        const levelStats = {};
        for (let level = 1; level <= 6; level++) {
            levelStats[level] = {
                level: level,
                registered: 0,
                deposit_number: 0,
                deposit_amount: 0,
                first_deposit_number: 0,
                withdrawal_number: 0,
                withdrawal_amount: 0,
                total_transaction_count: 0,
                net_amount: 0,
                users: include_user_details === 'true' ? [] : undefined
            };
        }

        // ✅ OPTIMIZATION: Use levelMapping to categorize results by level
        allStats.forEach(stat => {
            const level = levelMapping[stat.user_id]; // Get the level for this user
            if (level && levelStats[level]) {
                levelStats[level].registered++;
                levelStats[level].deposit_number += stat.deposit_count > 0 ? 1 : 0;
                levelStats[level].deposit_amount += parseFloat(stat.total_deposit_amount || 0);
                levelStats[level].first_deposit_number += stat.deposit_count === 1 ? 1 : 0;
                levelStats[level].withdrawal_number += stat.withdrawal_count > 0 ? 1 : 0;
                levelStats[level].withdrawal_amount += parseFloat(stat.total_withdrawal_amount || 0);
                levelStats[level].total_transaction_count += parseInt(stat.total_transaction_count || 0);
                levelStats[level].net_amount += parseFloat(stat.net_amount || 0);
                
                // Optional: Store individual user details
                if (include_user_details === 'true' && levelStats[level].users) {
                    levelStats[level].users.push({
                        user_id: stat.user_id,
                        user_name: stat.user_name,
                        phone: stat.phone,
                        email: stat.email,
                        deposit_count: stat.deposit_count,
                        total_deposit_amount: stat.total_deposit_amount,
                        withdrawal_count: stat.withdrawal_count,
                        total_withdrawal_amount: stat.total_withdrawal_amount,
                        net_amount: stat.net_amount,
                        first_deposit_date: stat.first_deposit_date
                    });
                }
            }
        });

        // Convert to array format, filtering out empty levels
        const teamLevelStats = Object.values(levelStats).filter(level => level.registered > 0);

        // Remove users array if not requested to keep response clean
        if (include_user_details !== 'true') {
            teamLevelStats.forEach(level => {
                delete level.users;
            });
        }

        const totalProcessingTime = Date.now() - startTime;
        console.log(`🚀 Team level stats completed in ${totalProcessingTime}ms for user ${user_id}`);
        
        res.status(200).json({
            success: true,
            data: teamLevelStats,
            summary: {
                total_users: allUserIds.length,
                total_levels: Object.keys(levelStats).filter(level => levelStats[level].registered > 0).length,
                date_range: { start_date: finalStartDate, end_date: finalEndDate },
                processing_time: new Date().toISOString()
            },
            performance: {
                processing_time_ms: totalProcessingTime,
                query_time_ms: Date.now() - queryStartTime,
                total_levels: teamLevelStats.length,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Error in getUserTeamLevelStats:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Admin: Get user rebate earnings (total, level-wise, and by rebate type)
const getUserRebateEarnings = async (req, res) => {
    try {
        const { user_id } = req.params;
        const { start_date, end_date, period } = req.query;
        
        console.log(`💰 Getting rebate earnings for user ${user_id} with period:`, period, 'and dates:', { start_date, end_date });
        
        // Handle default periods
        let finalStartDate = start_date;
        let finalEndDate = end_date;
        
        if (period) {
            const now = new Date();
            
            switch (period.toLowerCase()) {
                case 'today':
                    finalStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 19).replace('T', ' ');
                    finalEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString().slice(0, 19).replace('T', ' ');
                    break;
                case 'yesterday':
                    finalStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString().slice(0, 19).replace('T', ' ');
                    finalEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 19).replace('T', ' ');
                    break;
                case 'all':
                    finalStartDate = null;
                    finalEndDate = null;
                    break;
                default:
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid period. Use "today", "yesterday", or "all"'
                    });
            }
            
            console.log(`📅 Period "${period}" resolved to:`, { finalStartDate, finalEndDate });
        }
        
        const user = await User.findByPk(user_id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // Build where clause with date filtering
        const whereClause = { user_id };
        
        if (finalStartDate && finalEndDate) {
            whereClause.created_at = {
                [Op.between]: [new Date(finalStartDate), new Date(finalEndDate)]
            };
        } else if (finalStartDate) {
            whereClause.created_at = {
                [Op.gte]: new Date(finalStartDate)
            };
        } else if (finalEndDate) {
            whereClause.created_at = {
                [Op.lte]: new Date(finalEndDate)
            };
        }
        
        console.log('🔍 Querying commissions with where clause:', whereClause);
        
        const commissions = await ReferralCommission.findAll({
            where: whereClause,
            attributes: ['id', 'amount', 'level', 'rebate_type', 'created_at'],
            order: [['created_at', 'DESC']]
        });
        
        console.log(`📊 Found ${commissions.length} commission records for user ${user_id}`);
        
        let total_earnings = 0;
        const level_wise_earnings = {};
        for (let i = 1; i <= 6; i++) {
            level_wise_earnings[i] = { total: 0, lottery: 0, casino: 0 };
        }
        commissions.forEach(c => {
            total_earnings += parseFloat(c.amount);
            const lvl = c.level;
            const type = c.rebate_type || 'other';
            if (level_wise_earnings[lvl]) {
                level_wise_earnings[lvl].total += parseFloat(c.amount);
                if (type === 'lottery') level_wise_earnings[lvl].lottery += parseFloat(c.amount);
                else if (type === 'casino') level_wise_earnings[lvl].casino += parseFloat(c.amount);
            }
        });
        
        console.log(`💰 Total earnings: ${total_earnings}, Level-wise:`, level_wise_earnings);
        res.json({
            success: true,
            data: {
                total_earnings,
                level_wise_earnings,
                commissions
            }
        });
    } catch (error) {
        console.error('Error in getUserRebateEarnings:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getUserDetails = async (req, res) => {
    try {
        const userId = req.user.user_id;

        const user = await User.findByPk(userId, {
            attributes: [
                'user_id',
                'phone_no',
                'email',
                'wallet_balance',
                'is_phone_verified',
                'is_email_verified',
                'created_at',
                'last_login_at'
            ]
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user's bank accounts
        const bankAccounts = await BankAccount.findAll({
            where: { user_id: userId },
            attributes: ['bank_account_id', 'account_number', 'ifsc_code', 'account_holder_name', 'is_primary']
        });

        // Get user's USDT accounts
        const usdtAccounts = await UsdtAccount.findAll({
            where: { user_id: userId },
            attributes: ['usdt_account_id', 'wallet_address', 'network_type', 'is_primary']
        });

        // Get user's total deposits and withdrawals
        const totalDeposits = await WalletRecharge.sum('amount', {
            where: { 
                user_id: userId,
                status: 'completed'
            }
        });

        const totalWithdrawals = await WalletWithdrawal.sum('amount', {
            where: { 
                user_id: userId,
                status: 'completed'
            }
        });

        // Get user's total bets
        const totalBets = await Transaction.sum('amount', {
            where: { 
                user_id: userId,
                transaction_type: 'bet'
            }
        });

        // Get user's total wins
        const totalWins = await Transaction.sum('amount', {
            where: { 
                user_id: userId,
                transaction_type: 'win'
            }
        });

        res.status(200).json({
            success: true,
            data: {
                user: {
                    ...user.toJSON(),
                    total_deposits: totalDeposits || 0,
                    total_withdrawals: totalWithdrawals || 0,
                    total_bets: totalBets || 0,
                    total_wins: totalWins || 0
                },
                bank_accounts: bankAccounts,
                usdt_accounts: usdtAccounts
            }
        });
    } catch (error) {
        console.error('Error in getUserDetails:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const logoutController = async (req, res) => {
    try {
        if (!req.session) {
            return res.status(400).json({ success: false, message: 'No active session found' });
        }
        const { getModels } = require('../../models');
        const models = await getModels();
        const sessionService = createSessionService(models);
        await sessionService.invalidateSession(req.session.id, 'manual_logout');
        res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ success: false, message: 'Logout failed' });
    }
};

module.exports = {
    loginController,
    signupController: registerController,
    registerController,
    validateTokenController,
    resetPasswordController,
    verifyEmailController,
    resendVerificationController,
    getProfileController,
    updateProfileController,
    forgotPasswordController,
    getUserDetailsForAdmin,
    getUserBetHistory,
    getUserDepositHistory,
    getUserWithdrawalHistory,
    getUserBankDetails,
    getUserTransactionHistory,
    getUserTeamSummary,
    getUserTeamLevelStats,
    getUserRebateEarnings,
    getUserDetails,
    getInHouseGamesStatsController,
    getGameBetHistoryController,
    getThirdPartyGamesStatsController,
    getThirdPartyGameHistoryController,
    logoutController
};