const models = require('../../models');
const WalletRecharge = models.WalletRecharge;
const WalletWithdrawal = models.WalletWithdrawal;
const GameTransaction = models.GameTransaction;
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const BetRecordWingo = models.BetRecordWingo;
const BetRecord5D = models.BetRecord5D;
const BetRecordK3 = models.BetRecordK3;
const BetRecordTrxWix = models.BetRecordTrxWix;

// Get today's financial statistics (after 12 AM IST)
const getTodayFinancialStats = async (req, res) => {
    try {
        // Debug logs to diagnose model initialization
        console.log('BetRecordWingo:', BetRecordWingo);
        console.log('BetRecord5D:', BetRecord5D);
        console.log('BetRecordK3:', BetRecordK3);
        console.log('BetRecordTrxWix:', BetRecordTrxWix);
        console.log('typeof BetRecordWingo.sum:', typeof (BetRecordWingo && BetRecordWingo.sum));
        
        // Debug logs for Wallet models
        console.log('WalletRecharge:', WalletRecharge);
        console.log('typeof WalletRecharge.sum:', typeof (WalletRecharge && WalletRecharge.sum));
        console.log('WalletWithdrawal:', WalletWithdrawal);
        console.log('typeof WalletWithdrawal.sum:', typeof (WalletWithdrawal && WalletWithdrawal.sum));
        
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

        // Helper to get today's bets for a bet record model
        async function getGameBets(Model, modelName) {
            const whereClause = {
                created_at: { [Op.gte]: todayIST.toDate() },
                status: { [Op.in]: ['won', 'lost'] }
            };
            console.log(`Calling ${modelName}.sum with:`, {
                field: 'bet_amount',
                where: whereClause
            });
            const result = await Model.sum('bet_amount', { where: whereClause });
            console.log(`${modelName} sum result:`, result);
            return result || 0;
        }

        // Get today's total bets from all in-house games
        const wingoBets = await getGameBets(BetRecordWingo, 'BetRecordWingo');
        const fiveDBets = await getGameBets(BetRecord5D, 'BetRecord5D');
        const k3Bets = await getGameBets(BetRecordK3, 'BetRecordK3');
        const trxWixBets = await getGameBets(BetRecordTrxWix, 'BetRecordTrxWix');
        const todayBets = wingoBets + fiveDBets + k3Bets + trxWixBets;

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

        // Helper to get total bets for a bet record model
        async function getTotalGameBets(Model, modelName) {
            const result = await Model.sum('bet_amount', {});
            console.log(`${modelName} total sum result:`, result);
            return result || 0;
        }

        // Get total bets from all in-house games
        const wingoBets = await getTotalGameBets(BetRecordWingo, 'BetRecordWingo');
        const fiveDBets = await getTotalGameBets(BetRecord5D, 'BetRecord5D');
        const k3Bets = await getTotalGameBets(BetRecordK3, 'BetRecordK3');
        const trxWixBets = await getTotalGameBets(BetRecordTrxWix, 'BetRecordTrxWix');
        const totalBets = wingoBets + fiveDBets + k3Bets + trxWixBets;

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

        // Helper to get today's bets for a bet record model
        async function getGameBetsToday(Model, modelName) {
            const whereClause = {
                created_at: { [Op.gte]: todayIST.toDate() },
                status: { [Op.in]: ['won', 'lost'] }
            };
            const result = await Model.sum('bet_amount', { where: whereClause });
            console.log(`${modelName} today sum result:`, result);
            return result || 0;
        }

        // Helper to get total bets for a bet record model
        async function getTotalGameBets(Model, modelName) {
            const result = await Model.sum('bet_amount', {});
            console.log(`${modelName} total sum result:`, result);
            return result || 0;
        }

        // Get today's statistics
        const todayRecharge = await WalletRecharge.sum('amount', {
            where: {
                created_at: {
                    [Op.gte]: todayIST.toDate()
                },
                status: 'completed'
            }
        });

        const wingoBetsToday = await getGameBetsToday(BetRecordWingo, 'BetRecordWingo');
        const fiveDBetsToday = await getGameBetsToday(BetRecord5D, 'BetRecord5D');
        const k3BetsToday = await getGameBetsToday(BetRecordK3, 'BetRecordK3');
        const trxWixBetsToday = await getGameBetsToday(BetRecordTrxWix, 'BetRecordTrxWix');
        const todayBets = wingoBetsToday + fiveDBetsToday + k3BetsToday + trxWixBetsToday;

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

        const wingoBets = await getTotalGameBets(BetRecordWingo, 'BetRecordWingo');
        const fiveDBets = await getTotalGameBets(BetRecord5D, 'BetRecord5D');
        const k3Bets = await getTotalGameBets(BetRecordK3, 'BetRecordK3');
        const trxWixBets = await getTotalGameBets(BetRecordTrxWix, 'BetRecordTrxWix');
        const totalBets = wingoBets + fiveDBets + k3Bets + trxWixBets;

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