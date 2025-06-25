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
    RebateLevel,
    ReferralCommission
} = require('../../models');

const getUserDetailsForAdmin = async (req, res) => {
    try {
        const { search } = req.query;
        let whereClause = {};
        
        if (search) {
            whereClause = {
                [Op.or]: [
                    { user_id: search },
                    { phone_no: search },
                    { email: search }
                ]
            };
        }

        const users = await User.findAll({
            where: whereClause,
            attributes: [
                'user_id',
                'phone_no',
                'wallet_balance',
                'is_phone_verified',
                'current_ip',
                'registration_ip',
                'actual_deposit_amount',
                'total_bet_amount'
            ],
            order: [['user_id', 'ASC']]
        });

        const formattedUsers = users.map((user, index) => ({
            sl: index + 1,
            user_id: user.user_id,
            mobile_number: user.phone_no,
            balance: user.wallet_balance,
            status: user.is_phone_verified ? 'Verified' : 'Unverified',
            login_ip: user.current_ip,
            register_ip: user.registration_ip,
            total_deposit: user.actual_deposit_amount,
            total_withdrawal: user.total_bet_amount
        }));

        res.status(200).json({
            success: true,
            data: formattedUsers
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

        // Get internal game bets
        const wingoBets = await BetRecordWingo.findAll({
            where: {
                user_id,
                ...dateFilter
            },
            include: [
                {
                    model: BetResultWingo,
                    as: 'bet'
                },
                {
                    model: GamePeriod,
                    as: 'gamePeriod',
                    where: {
                        game_type: 'wingo'
                    },
                    required: false
                }
            ],
            order: [['created_at', 'DESC']]
        });

        const fiveDBets = await BetRecord5D.findAll({
            where: {
                user_id,
                ...dateFilter
            },
            include: [
                {
                    model: BetResult5D,
                    as: 'bet'
                },
                {
                    model: GamePeriod,
                    as: 'gamePeriod',
                    where: {
                        game_type: 'fiveD'
                    },
                    required: false
                }
            ],
            order: [['created_at', 'DESC']]
        });

        const k3Bets = await BetRecordK3.findAll({
            where: {
                user_id,
                ...dateFilter
            },
            include: [
                {
                    model: BetResultK3,
                    as: 'bet'
                },
                {
                    model: GamePeriod,
                    as: 'gamePeriod',
                    where: {
                        game_type: 'k3'
                    },
                    required: false
                }
            ],
            order: [['created_at', 'DESC']]
        });

        // Get seamless game transactions
        const seamlessTransactions = await SeamlessTransaction.findAll({
            where: {
                user_id,
                ...dateFilter
            },
            include: [{
                model: SeamlessGameSession,
                as: 'session'
            }],
            order: [['created_at', 'DESC']]
        });

        // Format internal game bets
        const formatInternalBets = (bets, gameType) => {
            return bets.map(bet => ({
                bet_id: bet.id,
                date: bet.created_at,
                type: 'Internal',
                game_name: gameType.toUpperCase(),
                select_game: bet.gamePeriod ? `${bet.gamePeriod.duration}s` : bet.bet_type,
                amount: bet.bet_amount,
                outcome: bet.status === 'won' ? 'Win' : bet.status === 'lost' ? 'Loss' : 'Pending',
                status: bet.status,
                balance_after: bet.balance_after || 0
            }));
        };

        // Format seamless transactions
        const formatSeamlessTransactions = (transactions) => {
            return transactions.map(transaction => ({
                bet_id: transaction.id,
                date: transaction.created_at,
                type: 'Third Party',
                game_name: transaction.session.game_type,
                select_game: transaction.transaction_type,
                amount: transaction.amount,
                outcome: transaction.amount > 0 ? 'Win' : 'Loss',
                status: transaction.amount > 0 ? 'won' : 'lost',
                balance_after: transaction.balance
            }));
        };

        // Combine and sort all bets
        const allBets = [
            ...formatInternalBets(wingoBets, 'wingo'),
            ...formatInternalBets(fiveDBets, '5d'),
            ...formatInternalBets(k3Bets, 'k3'),
            ...formatSeamlessTransactions(seamlessTransactions)
        ].sort((a, b) => new Date(b.date) - new Date(a.date));

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

        // Validate user exists
        const user = await User.findByPk(user_id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user's rebate level
        const userRebateLevel = await UserRebateLevel.findOne({
            where: { user_id },
            include: [{
                model: RebateLevel,
                as: 'rebateLevel'
            }]
        });

        // Get all rebate levels for reference
        const allRebateLevels = await RebateLevel.findAll({
            order: [['level', 'ASC']]
        });

        // Initialize stats for all six team member levels
        const levelWiseStats = {};
        for (let i = 1; i <= 6; i++) {
            levelWiseStats[i] = {
                total_recharge: 0,
                total_withdraw: 0,
                total_team_balance: 0,
                member_count: 0,
                active_members: 0,
                rebate_rates: {
                    lottery: userRebateLevel?.rebateLevel?.[`lottery_l${i}_rebate`] || 0,
                    casino: userRebateLevel?.rebateLevel?.[`casino_l${i}_rebate`] || 0
                }
            };
        }

        // Get all team members with their levels
        const teamMembers = await Referral.findAll({
            where: {
                referrer_id: user_id,
                level: {
                    [Op.between]: [1, 6] // Only get members up to level 6
                }
            },
            include: [{
                model: User,
                as: 'referred',
                attributes: [
                    'user_id',
                    'wallet_balance',
                    'actual_deposit_amount',
                    'is_active',
                    'last_login_at'
                ]
            }],
            attributes: ['level']
        });

        // Group team members by level and calculate stats
        teamMembers.forEach(member => {
            const level = member.level;
            if (member.referred) {
                // Update member count
                levelWiseStats[level].member_count++;

                // Update active members count (considering last login within 30 days as active)
                const isActive = member.referred.is_active && 
                    member.referred.last_login_at && 
                    (new Date() - new Date(member.referred.last_login_at)) <= (30 * 24 * 60 * 60 * 1000);
                
                if (isActive) {
                    levelWiseStats[level].active_members++;
                }

                // Update team balance
                levelWiseStats[level].total_team_balance += member.referred.wallet_balance || 0;
            }
        });

        // Get transaction totals for each level
        for (const level in levelWiseStats) {
            const levelMembers = teamMembers.filter(m => m.level === parseInt(level));
            const memberIds = levelMembers.map(m => m.referred.user_id);

            if (memberIds.length > 0) {
                // Get total deposits (including admin credits)
                const deposits = await Transaction.sum('amount', {
                    where: {
                        user_id: {
                            [Op.in]: memberIds
                        },
                        type: {
                            [Op.in]: ['deposit', 'admin_credit']
                        },
                        status: 'completed'
                    }
                });

                // Get total withdrawals (including admin debits)
                const withdrawals = await Transaction.sum('amount', {
                    where: {
                        user_id: {
                            [Op.in]: memberIds
                        },
                        type: {
                            [Op.in]: ['withdrawal', 'admin_debit']
                        },
                        status: 'completed'
                    }
                });

                levelWiseStats[level].total_recharge = deposits || 0;
                levelWiseStats[level].total_withdraw = withdrawals || 0;
            }
        }

        // Format response
        const formattedStats = Object.entries(levelWiseStats).map(([level, stats]) => ({
            level: parseInt(level),
            total_recharge: stats.total_recharge,
            total_withdraw: stats.total_withdraw,
            total_team_balance: stats.total_team_balance,
            member_count: stats.member_count,
            active_members: stats.active_members,
            inactive_members: stats.member_count - stats.active_members,
            rebate_rates: stats.rebate_rates
        }));

        // Sort by level
        formattedStats.sort((a, b) => a.level - b.level);

        // Calculate totals across all levels
        const totalStats = formattedStats.reduce((acc, curr) => ({
            total_recharge: acc.total_recharge + curr.total_recharge,
            total_withdraw: acc.total_withdraw + curr.total_withdraw,
            total_team_balance: acc.total_team_balance + curr.total_team_balance,
            total_members: acc.total_members + curr.member_count,
            total_active_members: acc.total_active_members + curr.active_members
        }), {
            total_recharge: 0,
            total_withdraw: 0,
            total_team_balance: 0,
            total_members: 0,
            total_active_members: 0
        });

        // Format rebate level requirements
        const rebateLevelRequirements = allRebateLevels.map(level => ({
            level: level.level,
            requirements: {
                min_team_members: level.min_team_members,
                min_team_betting: level.min_team_betting,
                min_team_deposit: level.min_team_deposit
            }
        }));

        res.status(200).json({
            success: true,
            data: {
                level_wise_stats: formattedStats,
                total_stats: {
                    ...totalStats,
                    total_inactive_members: totalStats.total_members - totalStats.total_active_members
                },
                current_rebate_level: userRebateLevel?.rebateLevel?.level || 'L0',
                rebate_level_requirements: rebateLevelRequirements
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
                'last_login'
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