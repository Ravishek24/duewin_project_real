const { WalletRecharge, WalletWithdrawal, GameTransaction } = require('../../models');
const { Op } = require('sequelize');
const moment = require('moment-timezone');

// Get today's financial statistics (after 12 AM IST)
const getTodayFinancialStats = async (req, res) => {
    try {
        const todayIST = moment().tz('Asia/Kolkata').startOf('day');
        
        // Get today's total recharge
        const todayRecharge = await WalletRecharge.sum('amount', {
            where: {
                created_at: {
                    [Op.gte]: todayIST.toDate()
                },
                status: 'completed'
            }
        });

        // Get today's total bets on internal games
        const todayBets = await GameTransaction.sum('amount', {
            where: {
                created_at: {
                    [Op.gte]: todayIST.toDate()
                },
                transaction_type: 'bet'
            }
        });

        // Get today's total withdrawals
        const todayWithdrawals = await WalletWithdrawal.sum('amount', {
            where: {
                created_at: {
                    [Op.gte]: todayIST.toDate()
                },
                status: 'completed'
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                today_recharge: todayRecharge || 0,
                today_bets: todayBets || 0,
                today_withdrawals: todayWithdrawals || 0,
                date: todayIST.format('YYYY-MM-DD')
            }
        });
    } catch (error) {
        console.error('Error getting today\'s financial stats:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching today\'s financial statistics'
        });
    }
};

// Get total financial statistics (all time)
const getTotalFinancialStats = async (req, res) => {
    try {
        // Get total recharge
        const totalRecharge = await WalletRecharge.sum('amount', {
            where: {
                status: 'completed'
            }
        });

        // Get total bets on internal games
        const totalBets = await GameTransaction.sum('amount', {
            where: {
                transaction_type: 'bet'
            }
        });

        // Get total withdrawals
        const totalWithdrawals = await WalletWithdrawal.sum('amount', {
            where: {
                status: 'completed'
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                total_recharge: totalRecharge || 0,
                total_bets: totalBets || 0,
                total_withdrawals: totalWithdrawals || 0
            }
        });
    } catch (error) {
        console.error('Error getting total financial stats:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching total financial statistics'
        });
    }
};

// Get complete financial statistics (both today and total)
const getCompleteFinancialStats = async (req, res) => {
    try {
        const todayIST = moment().tz('Asia/Kolkata').startOf('day');
        
        // Get today's statistics
        const todayRecharge = await WalletRecharge.sum('amount', {
            where: {
                created_at: {
                    [Op.gte]: todayIST.toDate()
                },
                status: 'completed'
            }
        });

        const todayBets = await GameTransaction.sum('amount', {
            where: {
                created_at: {
                    [Op.gte]: todayIST.toDate()
                },
                transaction_type: 'bet'
            }
        });

        const todayWithdrawals = await WalletWithdrawal.sum('amount', {
            where: {
                created_at: {
                    [Op.gte]: todayIST.toDate()
                },
                status: 'completed'
            }
        });

        // Get total statistics
        const totalRecharge = await WalletRecharge.sum('amount', {
            where: {
                status: 'completed'
            }
        });

        const totalBets = await GameTransaction.sum('amount', {
            where: {
                transaction_type: 'bet'
            }
        });

        const totalWithdrawals = await WalletWithdrawal.sum('amount', {
            where: {
                status: 'completed'
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                today: {
                    recharge: todayRecharge || 0,
                    bets: todayBets || 0,
                    withdrawals: todayWithdrawals || 0,
                    date: todayIST.format('YYYY-MM-DD')
                },
                total: {
                    recharge: totalRecharge || 0,
                    bets: totalBets || 0,
                    withdrawals: totalWithdrawals || 0
                }
            }
        });
    } catch (error) {
        console.error('Error getting complete financial stats:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching complete financial statistics'
        });
    }
};

module.exports = {
    getTodayFinancialStats,
    getTotalFinancialStats,
    getCompleteFinancialStats
}; 