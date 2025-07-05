const loginController = require('./loginController');
const registerController = require('./registerController');
const { validateTokenController, resetPasswordController } = require('./resetPasswordController');
const { verifyEmailController, resendVerificationController } = require('./emailVerificationController');
const { getProfileController, updateProfileController } = require('./profileController');
const forgotPasswordController = require('./forgotPasswordController');
const { getInHouseGamesStatsController, getGameBetHistoryController } = require('./inHouseGamesStatsController');
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
                'wingo' as game_type, id, created_at, bet_amount, 
                win_amount, status, 'Internal' as type
             FROM bet_record_wingo 
             WHERE user_id = :userId 
             ${start_date ? 'AND created_at >= :startDate' : ''}
             ${end_date ? 'AND created_at <= :endDate' : ''})
            
            UNION ALL
            
            (SELECT 
                'fiveD' as game_type, id, created_at, bet_amount,
                win_amount, status, 'Internal' as type  
             FROM bet_record_5d 
             WHERE user_id = :userId
             ${start_date ? 'AND created_at >= :startDate' : ''}
             ${end_date ? 'AND created_at <= :endDate' : ''})
            
            UNION ALL
            
            (SELECT 
                'k3' as game_type, id, created_at, bet_amount,
                win_amount, status, 'Internal' as type
             FROM bet_record_k3 
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
            include: [{
                model: PaymentGateway,
                as: 'paymentGateway',
                attributes: ['name']
            }],
            order: [['created_at', 'DESC']]
        });

        // Format deposits
        const formattedDeposits = deposits.map((deposit, index) => ({
            deposit_id: deposit.id,
            date: deposit.created_at,
            amount: deposit.amount,
            method: deposit.paymentGateway ? deposit.paymentGateway.name : 'Unknown',
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

        // Get withdrawal history with bank account and USDT account information
        const withdrawals = await WalletWithdrawal.findAll({
            where: {
                user_id,
                ...dateFilter
            },
            include: [
                {
                    model: BankAccount,
                    as: 'bankAccount',
                    attributes: ['bank_name', 'account_number']
                },
                {
                    model: UsdtAccount,
                    as: 'usdtAccount',
                    attributes: ['network', 'address']
                },
                {
                    model: PaymentGateway,
                    as: 'paymentGateway',
                    attributes: ['name']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        // Format withdrawals
        const formattedWithdrawals = withdrawals.map((withdrawal, index) => {
            let method = 'Unknown';
            
            // Determine withdrawal method
            if (withdrawal.bankAccount) {
                method = `${withdrawal.bankAccount.bank_name} (${withdrawal.bankAccount.account_number})`;
            } else if (withdrawal.usdtAccount) {
                method = `USDT (${withdrawal.usdtAccount.network})`;
            } else if (withdrawal.paymentGateway) {
                method = withdrawal.paymentGateway.name;
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

        // Get bank accounts
        const bankAccounts = await BankAccount.findAll({
            where: {
                user_id
            },
            order: [['is_default', 'DESC'], ['created_at', 'DESC']]
        });

        // Get USDT accounts
        const usdtAccounts = await UsdtAccount.findAll({
            where: {
                user_id
            },
            order: [['is_default', 'DESC'], ['created_at', 'DESC']]
        });

        // Format bank accounts
        const formattedBankAccounts = bankAccounts.map(account => ({
            account_id: account.id,
            bank_name: account.bank_name,
            account_number: account.account_number,
            account_holder: account.account_holder,
            ifsc_code: account.ifsc_code,
            is_default: account.is_default,
            created_at: account.created_at
        }));

        // Format USDT accounts
        const formattedUsdtAccounts = usdtAccounts.map(account => ({
            account_id: account.id,
            network: account.network,
            address: account.address,
            is_default: account.is_default,
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

        // Get all transactions
        const transactions = await Transaction.findAll({
            where: {
                user_id,
                ...dateFilter
            },
            include: [
                {
                    model: PaymentGateway,
                    as: 'paymentGateway',
                    attributes: ['name']
                },
                {
                    model: BankAccount,
                    as: 'bankAccount',
                    attributes: ['bank_name', 'account_number']
                },
                {
                    model: UsdtAccount,
                    as: 'usdtAccount',
                    attributes: ['network', 'address']
                }
            ],
            order: [['created_at', 'DESC']]
        });

        // Format transactions
        const formattedTransactions = transactions.map(transaction => {
            let method = 'Unknown';
            
            // Determine method based on transaction type and related data
            if (transaction.paymentGateway) {
                method = transaction.paymentGateway.name;
            } else if (transaction.bankAccount) {
                method = `${transaction.bankAccount.bank_name} (${transaction.bankAccount.account_number})`;
            } else if (transaction.usdtAccount) {
                method = `USDT (${transaction.usdtAccount.network})`;
            }

            return {
                transaction_id: transaction.id,
                date: transaction.created_at,
                type: transaction.type,
                amount: transaction.amount,
                method: method,
                status: transaction.status
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

        // 🚀 SINGLE OPTIMIZED QUERY (was 13 queries)
        const teamStats = await User.sequelize.query(`
            SELECT 
                r.level,
                COUNT(DISTINCT r.referred_id) as member_count,
                COUNT(DISTINCT CASE 
                  WHEN u.is_active = 1 
                  AND u.last_login_at > DATE_SUB(NOW(), INTERVAL 30 DAY) 
                  THEN r.referred_id 
                END) as active_members,
                COALESCE(SUM(u.wallet_balance), 0) as total_team_balance,
                COALESCE(SUM(CASE 
                  WHEN t.type IN ('deposit', 'admin_credit') 
                  AND t.status = 'completed' 
                  THEN t.amount 
                END), 0) as total_recharge,
                COALESCE(SUM(CASE 
                  WHEN t.type IN ('withdrawal', 'admin_debit') 
                  AND t.status = 'completed' 
                  THEN t.amount 
                END), 0) as total_withdraw
            FROM referrals r
            LEFT JOIN users u ON r.referred_id = u.user_id
            LEFT JOIN transactions t ON u.user_id = t.user_id
            WHERE r.referrer_id = :userId 
              AND r.level BETWEEN 1 AND 6
            GROUP BY r.level
            ORDER BY r.level
        `, {
            replacements: { userId: user_id },
            type: User.sequelize.QueryTypes.SELECT
        });

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
    getUserRebateEarnings,
    getUserDetails,
    getInHouseGamesStatsController,
    getGameBetHistoryController
};