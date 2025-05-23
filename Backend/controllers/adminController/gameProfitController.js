const { GameTransaction, Game } = require('../../models');
const { Op } = require('sequelize');
const moment = require('moment-timezone');

// Get today's profit (after 12 AM IST)
const getTodayProfit = async (req, res) => {
    try {
        const todayIST = moment().tz('Asia/Kolkata').startOf('day');
        
        const todayProfit = await GameTransaction.sum('profit', {
            where: {
                created_at: {
                    [Op.gte]: todayIST.toDate()
                }
            }
        });

        // Get game-wise breakdown with game names
        const gameWiseProfit = await GameTransaction.findAll({
            attributes: [
                'game_id',
                [sequelize.fn('SUM', sequelize.col('profit')), 'total_profit'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'total_transactions']
            ],
            where: {
                created_at: {
                    [Op.gte]: todayIST.toDate()
                }
            },
            include: [{
                model: Game,
                attributes: ['game_name', 'game_type', 'is_active'],
                required: true
            }],
            group: ['game_id', 'Game.game_id']
        });

        // Format the response
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
                total_profit: todayProfit || 0,
                game_wise_profit: formattedGameWiseProfit,
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
        
        const weeklyProfit = await GameTransaction.sum('profit', {
            where: {
                created_at: {
                    [Op.gte]: weekStartIST.toDate()
                }
            }
        });

        // Get daily breakdown with game names
        const dailyProfit = await GameTransaction.findAll({
            attributes: [
                [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
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
                    [Op.gte]: weekStartIST.toDate()
                }
            },
            group: [
                sequelize.fn('DATE', sequelize.col('created_at')),
                'Game.game_id'
            ]
        });

        // Format the response
        const formattedDailyProfit = dailyProfit.map(day => ({
            date: day.getDataValue('date'),
            game_name: day.Game.game_name,
            game_type: day.Game.game_type,
            total_profit: parseFloat(day.getDataValue('total_profit')) || 0,
            total_transactions: parseInt(day.getDataValue('total_transactions')) || 0
        }));

        return res.status(200).json({
            success: true,
            data: {
                total_profit: weeklyProfit || 0,
                daily_breakdown: formattedDailyProfit,
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
        const todayIST = moment().tz('Asia/Kolkata').startOf('day');
        const weekStartIST = moment().tz('Asia/Kolkata').startOf('week');
        const monthStartIST = moment().tz('Asia/Kolkata').startOf('month');

        // Get today's profit
        const todayProfit = await GameTransaction.sum('profit', {
            where: {
                created_at: {
                    [Op.gte]: todayIST.toDate()
                }
            }
        });

        // Get this week's profit
        const weeklyProfit = await GameTransaction.sum('profit', {
            where: {
                created_at: {
                    [Op.gte]: weekStartIST.toDate()
                }
            }
        });

        // Get this month's profit
        const monthlyProfit = await GameTransaction.sum('profit', {
            where: {
                created_at: {
                    [Op.gte]: monthStartIST.toDate()
                }
            }
        });

        // Get game-wise profit for today with game names
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
                    [Op.gte]: todayIST.toDate()
                }
            },
            group: ['game_id', 'Game.game_id']
        });

        // Format the game-wise profit
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
                today_profit: todayProfit || 0,
                weekly_profit: weeklyProfit || 0,
                monthly_profit: monthlyProfit || 0,
                game_wise_profit: formattedGameWiseProfit,
                date: todayIST.format('YYYY-MM-DD')
            }
        });
    } catch (error) {
        console.error('Error getting profit statistics:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching profit statistics'
        });
    }
};

module.exports = {
    getTodayProfit,
    getWeeklyProfit,
    getMonthlyProfit,
    getProfitStats
}; 