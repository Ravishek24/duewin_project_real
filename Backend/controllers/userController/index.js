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
                'current_ip',
                'registration_ip',
                'actual_deposit_amount',
                'total_bet_amount',
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
            
            return {
                sl: offset + index + 1, // Correct serial number based on pagination
                user_id: user.user_id,
                mobile_number: user.phone_no,
                balance: user.wallet_balance,
                status: user.is_phone_verified ? 'Verified' : 'Unverified',
                is_blocked: isBlocked,
                total_commission: commissionMap[user.user_id] || 0,
                login_ip: user.current_ip,
                register_ip: user.registration_ip,
                total_deposit: user.actual_deposit_amount,
                total_withdrawal: user.total_bet_amount,
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
        
        // 🚀 SINGLE OPTIMIZED QUERY (was 4-6 queries)
        const allBets = await User.sequelize.query(`
            (SELECT 
                'wingo' as game_type, bet_id, created_at, bet_amount, 
                win_amount, status, 'Internal' as type
             FROM bet_record_wingos 
             WHERE user_id = :userId 
             ${start_date ? 'AND created_at >= :startDate' : ''}
             ${end_date ? 'AND created_at <= :endDate' : ''})
            
            UNION ALL
            
            (SELECT 
                'fiveD' as game_type, bet_id, created_at, bet_amount,
                win_amount, status, 'Internal' as type  
             FROM bet_record_5ds 
             WHERE user_id = :userId
             ${start_date ? 'AND created_at >= :startDate' : ''}
             ${end_date ? 'AND created_at <= :endDate' : ''})
            
            UNION ALL
            
            (SELECT 
                'k3' as game_type, bet_id, created_at, bet_amount,
                win_amount, status, 'Internal' as type
             FROM bet_record_k3s 
             WHERE user_id = :userId
             ${start_date ? 'AND created_at >= :startDate' : ''}
             ${end_date ? 'AND created_at <= :endDate' : ''})
            
            UNION ALL
            
            (SELECT 
                'trxWix' as game_type, bet_id, created_at, bet_amount,
                win_amount, status, 'Internal' as type
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
            data: allBets
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
        const { start_date, end_date } = req.query;

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

        // Get deposit history
        const deposits = await WalletRecharge.findAll({
            where: {
                user_id,
                ...dateFilter
            },
            order: [['created_at', 'DESC']]
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
            data: formattedDeposits
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
        const { start_date, end_date } = req.query;

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

        // Get withdrawal history
        const withdrawals = await WalletWithdrawal.findAll({
            where: {
                user_id,
                ...dateFilter
            },
            order: [['created_at', 'DESC']]
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
            data: formattedWithdrawals
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
        const { start_date, end_date } = req.query;

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

        // Get all transactions - using raw query to avoid model import issues
        const transactions = await User.sequelize.query(`
            SELECT id, created_at, type, amount, status, description, reference_id
            FROM transactions 
            WHERE user_id = :userId
            ${start_date ? 'AND created_at >= :startDate' : ''}
            ${end_date ? 'AND created_at <= :endDate' : ''}
            ORDER BY created_at DESC
        `, {
            replacements: { 
                userId: user_id,
                startDate: start_date,
                endDate: end_date
            },
            type: User.sequelize.QueryTypes.SELECT
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
            data: formattedTransactions
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

        // Process each level (1-6)
        for (let level = 1; level <= 6; level++) {
            const levelField = `level_${level}`;
            const levelData = tree[levelField];
            
            if (levelData && levelData.trim()) {
                // Parse user IDs from the level data (comma-separated)
                const userIds = levelData.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                
                if (userIds.length > 0) {
                    // Get user details for this level
                    const levelUsers = await User.sequelize.query(`
                        SELECT user_id, wallet_balance, is_active, last_login_at
                        FROM users 
                        WHERE user_id IN (:userIds)
                    `, {
                        replacements: { userIds },
                        type: User.sequelize.QueryTypes.SELECT
                    });

                    // Get transaction data for this level
                    const levelTransactions = await User.sequelize.query(`
                        SELECT user_id, type, amount, status
                        FROM transactions 
                        WHERE user_id IN (:userIds)
                    `, {
                        replacements: { userIds },
                        type: User.sequelize.QueryTypes.SELECT
                    });

                    // Calculate stats
                    const memberCount = userIds.length;
                    const activeMembers = levelUsers.filter(user => 
                        user.is_active === 1 && 
                        user.last_login_at && 
                        new Date(user.last_login_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    ).length;
                    
                    const totalTeamBalance = levelUsers.reduce((sum, user) => sum + parseFloat(user.wallet_balance || 0), 0);
                    
                    const totalRecharge = levelTransactions
                        .filter(t => ['deposit', 'admin_credit'].includes(t.type) && t.status === 'completed')
                        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);
                    
                    const totalWithdraw = levelTransactions
                        .filter(t => ['withdrawal', 'admin_debit'].includes(t.type) && t.status === 'completed')
                        .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

                    teamStats.push({
                        level: level,
                        member_count: memberCount,
                        active_members: activeMembers,
                        total_team_balance: totalTeamBalance,
                        total_recharge: totalRecharge,
                        total_withdraw: totalWithdraw
                    });
                }
            }
        }

        res.status(200).json({
            success: true,
            data: teamStats
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
        const { user_id } = req.params;
        const { start_date, end_date } = req.query;

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
        const teamLevelStats = [];

        // Process each level (1-6)
        for (let level = 1; level <= 6; level++) {
            const levelField = `level_${level}`;
            const levelData = tree[levelField];
            
            if (levelData && levelData.trim()) {
                // Parse user IDs from the level data (comma-separated)
                const userIds = levelData.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                
                if (userIds.length > 0) {
                    // Build date filter for transactions
                    let dateFilter = '';
                    if (start_date && end_date) {
                        dateFilter = `AND created_at BETWEEN '${start_date}' AND '${end_date}'`;
                    } else if (start_date) {
                        dateFilter = `AND created_at >= '${start_date}'`;
                    } else if (end_date) {
                        dateFilter = `AND created_at <= '${end_date}'`;
                    }

                    // Get deposit statistics for this level
                    const depositStats = await User.sequelize.query(`
                        SELECT 
                            user_id,
                            COUNT(*) as deposit_count,
                            SUM(amount) as total_deposit_amount,
                            MIN(created_at) as first_deposit_date
                        FROM transactions 
                        WHERE user_id IN (:userIds) 
                        AND type IN ('deposit', 'admin_credit') 
                        AND status = 'completed'
                        ${dateFilter}
                        GROUP BY user_id
                    `, {
                        replacements: { userIds },
                        type: User.sequelize.QueryTypes.SELECT
                    });

                    // Calculate level statistics
                    const registered = userIds.length;
                    const depositNumber = depositStats.length;
                    const depositAmount = depositStats.reduce((sum, stat) => sum + parseFloat(stat.total_deposit_amount || 0), 0);
                    
                    // Count first-time depositors (users with only one deposit record)
                    const firstDepositNumber = depositStats.filter(stat => parseInt(stat.deposit_count) === 1).length;

                    teamLevelStats.push({
                        level: level,
                        registered: registered,
                        deposit_number: depositNumber,
                        deposit_amount: depositAmount,
                        first_deposit_number: firstDepositNumber
                    });
                }
            }
        }

        res.status(200).json({
            success: true,
            data: teamLevelStats
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
        const user = await User.findByPk(user_id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        const commissions = await ReferralCommission.findAll({
            where: { user_id },
            attributes: ['id', 'amount', 'level', 'rebate_type', 'created_at'],
            order: [['created_at', 'DESC']]
        });
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
    getThirdPartyGameHistoryController
};