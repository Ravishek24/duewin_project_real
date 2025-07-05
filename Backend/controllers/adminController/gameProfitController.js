const { GameTransaction, Game } = require('../../models');
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const sequelize = require('sequelize');
const BetRecordWingo = require('../../models/BetRecordWingo');
const BetRecord5D = require('../../models/BetRecord5D');
const BetRecordK3 = require('../../models/BetRecordK3');
const BetRecordTrxWix = require('../../models/BetRecordTrxWix');

// Get today's profit (after 12 AM IST)
const getTodayProfit = async (req, res) => {
    try {
        const todayIST = moment().tz('Asia/Kolkata').startOf('day');
        const { fn, col } = require('sequelize');

        // Helper to get profit for a bet record model
        async function getGameProfit(Model, game_type) {
            const result = await Model.findAll({
                attributes: [
                    [fn('SUM', col('bet_amount')), 'total_bet'],
                    [fn('SUM', col('win_amount')), 'total_win']
                ],
                where: {
                    status: { [Op.in]: ['won', 'lost'] },
                    created_at: { [Op.gte]: todayIST.toDate() }
                }
            });
            const totalBet = parseFloat(result[0].get('total_bet')) || 0;
            const totalWin = parseFloat(result[0].get('total_win')) || 0;
            return {
                game_type,
                total_bet: totalBet,
                total_win: totalWin,
                profit: totalBet - totalWin
            };
        }

        // Get profit for each game
        const wingo = await getGameProfit(BetRecordWingo, 'wingo');
        const fiveD = await getGameProfit(BetRecord5D, '5d');
        const k3 = await getGameProfit(BetRecordK3, 'k3');
        const trxWix = await getGameProfit(BetRecordTrxWix, 'trx_wix');

        const allGames = [wingo, fiveD, k3, trxWix];
        const total_profit = allGames.reduce((sum, g) => sum + g.profit, 0);

        return res.status(200).json({
            success: true,
            data: {
                total_profit,
                game_wise_profit: allGames,
                date: todayIST.format('YYYY-MM-DD')
            }
        });
    } catch (error) {
        console.error('Error getting today\'s profit:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching today\'s profit'
        });
    }
};

// Get this week's profit
const getWeeklyProfit = async (req, res) => {
    try {
        const weekStartIST = moment().tz('Asia/Kolkata').startOf('week');
        const { fn, col, Op } = require('sequelize');

        // Helper to get profit for a bet record model
        async function getGameProfit(Model, game_type) {
            const result = await Model.findAll({
                attributes: [
                    [fn('SUM', col('bet_amount')), 'total_bet'],
                    [fn('SUM', col('win_amount')), 'total_win']
                ],
                where: {
                    status: { [Op.in]: ['won', 'lost'] },
                    created_at: { [Op.gte]: weekStartIST.toDate() }
                }
            });
            const totalBet = parseFloat(result[0].get('total_bet')) || 0;
            const totalWin = parseFloat(result[0].get('total_win')) || 0;
            return {
                game_type,
                total_bet: totalBet,
                total_win: totalWin,
                profit: totalBet - totalWin
            };
        }

        // Get profit for each game
        const wingo = await getGameProfit(BetRecordWingo, 'wingo');
        const fiveD = await getGameProfit(BetRecord5D, '5d');
        const k3 = await getGameProfit(BetRecordK3, 'k3');
        const trxWix = await getGameProfit(BetRecordTrxWix, 'trx_wix');

        const allGames = [wingo, fiveD, k3, trxWix];
        const total_profit = allGames.reduce((sum, g) => sum + g.profit, 0);

        return res.status(200).json({
            success: true,
            data: {
                total_profit,
                game_wise_profit: allGames,
                week_start: weekStartIST.format('YYYY-MM-DD'),
                week_end: moment().tz('Asia/Kolkata').endOf('week').format('YYYY-MM-DD')
            }
        });
    } catch (error) {
        console.error('Error getting weekly profit:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching weekly profit'
        });
    }
};

// Get this month's profit
const getMonthlyProfit = async (req, res) => {
    try {
        const monthStartIST = moment().tz('Asia/Kolkata').startOf('month');
        
        const monthlyProfit = await GameTransaction.sum('profit', {
            where: {
                created_at: {
                    [Op.gte]: monthStartIST.toDate()
                }
            }
        });

        // Get weekly breakdown with game names
        const weeklyProfit = await GameTransaction.findAll({
            attributes: [
                [sequelize.fn('WEEK', sequelize.col('created_at')), 'week_number'],
                [sequelize.fn('SUM', sequelize.col('profit')), 'total_profit'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'total_transactions']
            ],
            include: [{
                model: Game,
                attributes: ['game_name', 'game_type'],
                required: true
            }],
            where: {
                created_at: {
                    [Op.gte]: monthStartIST.toDate()
                }
            },
            group: [
                sequelize.fn('WEEK', sequelize.col('created_at')),
                'Game.game_id'
            ]
        });

        // Get game-wise breakdown
        const gameWiseProfit = await GameTransaction.findAll({
            attributes: [
                'game_id',
                [sequelize.fn('SUM', sequelize.col('profit')), 'total_profit'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'total_transactions']
            ],
            include: [{
                model: Game,
                attributes: ['game_name', 'game_type', 'is_active'],
                required: true
            }],
            where: {
                created_at: {
                    [Op.gte]: monthStartIST.toDate()
                }
            },
            group: ['game_id', 'Game.game_id']
        });

        // Format the responses
        const formattedWeeklyProfit = weeklyProfit.map(week => ({
            week_number: week.getDataValue('week_number'),
            game_name: week.Game.game_name,
            game_type: week.Game.game_type,
            total_profit: parseFloat(week.getDataValue('total_profit')) || 0,
            total_transactions: parseInt(week.getDataValue('total_transactions')) || 0
        }));

        const formattedGameWiseProfit = gameWiseProfit.map(game => ({
            game_id: game.game_id,
            game_name: game.Game.game_name,
            game_type: game.Game.game_type,
            is_active: game.Game.is_active,
            total_profit: parseFloat(game.getDataValue('total_profit')) || 0,
            total_transactions: parseInt(game.getDataValue('total_transactions')) || 0
        }));

        return res.status(200).json({
            success: true,
            data: {
                total_profit: monthlyProfit || 0,
                weekly_breakdown: formattedWeeklyProfit,
                game_wise_profit: formattedGameWiseProfit,
                month_start: monthStartIST.format('YYYY-MM-DD'),
                month_end: moment().tz('Asia/Kolkata').endOf('month').format('YYYY-MM-DD')
            }
        });
    } catch (error) {
        console.error('Error getting monthly profit:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching monthly profit'
        });
    }
};

// Get detailed profit statistics
const getProfitStats = async (req, res) => {
    try {
        const { fn, col, Op } = require('sequelize');

        // Helper to get profit for a bet record model (all time)
        async function getGameProfit(Model, game_type) {
            const result = await Model.findAll({
                attributes: [
                    [fn('SUM', col('bet_amount')), 'total_bet'],
                    [fn('SUM', col('win_amount')), 'total_win']
                ],
                where: {
                    status: { [Op.in]: ['won', 'lost'] }
                }
            });
            const totalBet = parseFloat(result[0].get('total_bet')) || 0;
            const totalWin = parseFloat(result[0].get('total_win')) || 0;
            return {
                game_type,
                total_bet: totalBet,
                total_win: totalWin,
                profit: totalBet - totalWin
            };
        }

        // Get profit for each game
        const wingo = await getGameProfit(BetRecordWingo, 'wingo');
        const fiveD = await getGameProfit(BetRecord5D, '5d');
        const k3 = await getGameProfit(BetRecordK3, 'k3');
        const trxWix = await getGameProfit(BetRecordTrxWix, 'trx_wix');

        const allGames = [wingo, fiveD, k3, trxWix];
        const total_profit = allGames.reduce((sum, g) => sum + g.profit, 0);

        return res.status(200).json({
            success: true,
            data: {
                total_profit,
                game_wise_profit: allGames
            }
        });
    } catch (error) {
        console.error('Error getting profit stats:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching profit stats'
        });
    }
};

module.exports = {
    getTodayProfit,
    getWeeklyProfit,
    getMonthlyProfit,
    getProfitStats
}; 