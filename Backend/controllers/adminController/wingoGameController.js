const { BetRecordWingo, BetResultWingo, User } = require('../../models');
const GamePeriod = require('../../models/GamePeriod');const { Op } = require('sequelize');
const moment = require('moment-timezone');
const WebSocket = require('ws');
const unifiedRedis = require('../../config/unifiedRedisManager');
function getRedisHelper() { return unifiedRedis.getHelper(); }
const gameLogicService = require('../../services/gameLogicService');

// WebSocket server instance
let wss;

// Initialize WebSocket server
const initializeWebSocket = (server) => {
    wss = new WebSocket.Server({ server });
    
    wss.on('connection', (ws) => {
        console.log('New WebSocket connection established');
        
        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message);
                if (data.type === 'subscribe') {
                    ws.timeline = data.timeline;
                }
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        });
    });
};

// Broadcast updates to all connected clients
const broadcastUpdate = (timeline, data) => {
    if (!wss) return;
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN && client.timeline === timeline) {
            client.send(JSON.stringify(data));
        }
    });
};

// Format bet type information
const formatBetTypeInfo = (bet) => {
    const betInfo = {
        type: bet.bet_type,
        value: bet.bet_value,
        display: ''
    };

    switch(bet.bet_type) {
        case 'number':
            betInfo.display = `Number ${bet.bet_value}`;
            break;
        case 'color':
            betInfo.display = `${bet.bet_value.charAt(0).toUpperCase() + bet.bet_value.slice(1)} Color`;
            break;
        case 'odd_even':
            betInfo.display = `${bet.bet_value.charAt(0).toUpperCase() + bet.bet_value.slice(1)} Numbers`;
            break;
        case 'size':
            betInfo.display = `${bet.bet_value.charAt(0).toUpperCase() + bet.bet_value.slice(1)} Numbers (${bet.bet_value === 'small' ? '0-4' : '5-9'})`;
            break;
    }

    return betInfo;
};

// Get all active Wingo periods
const getActivePeriods = async (req, res) => {
    try {
        const now = moment().tz('Asia/Kolkata');
        
        // Find all active periods
        const activePeriods = await GamePeriod.findAll({
            where: {
                game_type: 'wingo',
                start_time: {
                    [Op.lte]: now.toDate()
                },
                end_time: {
                    [Op.gt]: now.toDate()
                },
                is_completed: false
            },
            order: [['start_time', 'ASC']]
        });

        // Format the response
        const formattedPeriods = activePeriods.map(period => ({
            period_id: period.period_id,
            start_time: period.start_time,
            end_time: period.end_time,
            duration: period.duration,
            time_remaining: moment(period.end_time).diff(now, 'seconds'),
            timeline: period.timeline || 'default' // Add timeline information
        }));

        return res.status(200).json({
            success: true,
            data: {
                active_periods: formattedPeriods
            }
        });
    } catch (error) {
        console.error('Error getting active Wingo periods:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching active Wingo periods'
        });
    }
};

// Get current ongoing Wingo game period for a specific timeline
const getCurrentPeriod = async (req, res) => {
    try {
        const { timeline = 'default' } = req.query;
        const now = moment().tz('Asia/Kolkata');
        
        // Find the current period for the specified timeline
        const currentPeriod = await GamePeriod.findOne({
            where: {
                game_type: 'wingo',
                timeline: timeline,
                start_time: {
                    [Op.lte]: now.toDate()
                },
                end_time: {
                    [Op.gt]: now.toDate()
                },
                is_completed: false
            },
            order: [['start_time', 'DESC']]
        });

        if (!currentPeriod) {
            return res.status(200).json({
                success: true,
                data: {
                    has_active_period: false,
                    timeline: timeline,
                    message: `No active Wingo period found for timeline: ${timeline}`
                }
            });
        }

        // Get all bets for this period
        const periodBets = await BetRecordWingo.findAll({
            where: {
                period: currentPeriod.period_id,
                status: 'pending'
            },
            include: [{
                model: User,
                attributes: ['user_name', 'phone'],
                required: true
            }]
        });

        // Calculate total bet amount and unique bettors
        const totalBetAmount = periodBets.reduce((sum, bet) => sum + parseFloat(bet.bet_amount), 0);
        const uniqueBettors = new Set(periodBets.map(bet => bet.user_id)).size;

        // Initialize betting statistics
        const bettingStats = {
            numbers: Array(10).fill(0).map(() => ({ total_amount: 0, bet_count: 0 })),
            colors: {
                red: { total_amount: 0, bet_count: 0 },
                green: { total_amount: 0, bet_count: 0 },
                blue: { total_amount: 0, bet_count: 0 }
            },
            odd_even: {
                odd: { total_amount: 0, bet_count: 0 },
                even: { total_amount: 0, bet_count: 0 }
            },
            size: {
                small: { total_amount: 0, bet_count: 0 },
                big: { total_amount: 0, bet_count: 0 }
            }
        };

        // Process bets and update statistics
        periodBets.forEach(bet => {
            const betAmount = parseFloat(bet.bet_amount);
            
            switch(bet.bet_type) {
                case 'number':
                    const number = parseInt(bet.bet_value);
                    bettingStats.numbers[number].total_amount += betAmount;
                    bettingStats.numbers[number].bet_count += 1;
                    break;
                case 'color':
                    bettingStats.colors[bet.bet_value.toLowerCase()].total_amount += betAmount;
                    bettingStats.colors[bet.bet_value.toLowerCase()].bet_count += 1;
                    break;
                case 'odd_even':
                    bettingStats.odd_even[bet.bet_value.toLowerCase()].total_amount += betAmount;
                    bettingStats.odd_even[bet.bet_value.toLowerCase()].bet_count += 1;
                    break;
                case 'size':
                    bettingStats.size[bet.bet_value.toLowerCase()].total_amount += betAmount;
                    bettingStats.size[bet.bet_value.toLowerCase()].bet_count += 1;
                    break;
            }
        });

        // Format the response
        const formattedBets = periodBets.map(bet => ({
            bet_id: bet.id,
            user: {
                username: bet.User.user_name,
                phone: bet.User.phone
            },
            bet_info: formatBetTypeInfo(bet),
            bet_amount: parseFloat(bet.bet_amount),
            odds: parseFloat(bet.odds),
            created_at: bet.created_at
        }));

        const response = {
            success: true,
            data: {
                has_active_period: true,
                timeline: timeline,
                period: {
                    period_id: currentPeriod.period_id,
                    start_time: currentPeriod.start_time,
                    end_time: currentPeriod.end_time,
                    duration: currentPeriod.duration,
                    total_bet_amount: totalBetAmount,
                    unique_bettors: uniqueBettors,
                    time_remaining: moment(currentPeriod.end_time).diff(now, 'seconds'),
                    betting_stats: {
                        numbers: bettingStats.numbers.map((stat, index) => ({
                            number: index,
                            total_amount: stat.total_amount,
                            bet_count: stat.bet_count
                        })),
                        colors: Object.entries(bettingStats.colors).map(([color, stat]) => ({
                            color,
                            total_amount: stat.total_amount,
                            bet_count: stat.bet_count
                        })),
                        odd_even: Object.entries(bettingStats.odd_even).map(([type, stat]) => ({
                            type,
                            total_amount: stat.total_amount,
                            bet_count: stat.bet_count
                        })),
                        size: Object.entries(bettingStats.size).map(([size, stat]) => ({
                            size,
                            total_amount: stat.total_amount,
                            bet_count: stat.bet_count
                        }))
                    },
                    bets: formattedBets
                }
            }
        };

        // Broadcast update to WebSocket clients
        broadcastUpdate(timeline, {
            type: 'period_update',
            data: response.data
        });

        return res.status(200).json(response);
    } catch (error) {
        console.error('Error getting current Wingo period:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching current Wingo period'
        });
    }
};

// Handle bet result publication
const handleBetResult = async (periodId, result) => {
    try {
        // Broadcast result to WebSocket clients
        broadcastUpdate(result.timeline, {
            type: 'result_published',
            data: {
                period_id: periodId,
                result: result,
                timestamp: new Date()
            }
        });

        // Reset statistics for next period
        broadcastUpdate(result.timeline, {
            type: 'period_reset',
            data: {
                message: 'New period started',
                timestamp: new Date()
            }
        });
    } catch (error) {
        console.error('Error handling bet result:', error);
    }
};

// Get recent Wingo game periods
const getRecentPeriods = async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const now = moment().tz('Asia/Kolkata');

        // Get recent periods
        const recentPeriods = await GamePeriod.findAll({
            where: {
                game_type: 'wingo',
                end_time: {
                    [Op.lte]: now.toDate()
                }
            },
            order: [['end_time', 'DESC']],
            limit: parseInt(limit)
        });

        // Get results for these periods
        const periodResults = await BetResultWingo.findAll({
            where: {
                bet_number: {
                    [Op.in]: recentPeriods.map(p => p.period_id)
                }
            }
        });

        // Format the response
        const formattedPeriods = recentPeriods.map(period => {
            const result = periodResults.find(r => r.bet_number === period.period_id);
            return {
                period_id: period.period_id,
                start_time: period.start_time,
                end_time: period.end_time,
                duration: period.duration,
                total_bet_amount: parseFloat(period.total_bet_amount) || 0,
                total_payout_amount: parseFloat(period.total_payout_amount) || 0,
                unique_bettors: period.unique_bettors,
                result: result ? {
                    number: result.result_of_number,
                    size: result.result_of_size,
                    color: result.result_of_color
                } : null
            };
        });

        return res.status(200).json({
            success: true,
            data: {
                periods: formattedPeriods
            }
        });
    } catch (error) {
        console.error('Error getting recent Wingo periods:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching recent Wingo periods'
        });
    }
};

// Get Wingo game statistics
const getWingoStats = async (req, res) => {
    try {
        const todayIST = moment().tz('Asia/Kolkata').startOf('day');
        
        // Get today's total bets
        const todayBets = await BetRecordWingo.sum('bet_amount', {
            where: {
                created_at: {
                    [Op.gte]: todayIST.toDate()
                }
            }
        });

        // Get today's total payouts
        const todayPayouts = await BetRecordWingo.sum('bet_amount', {
            where: {
                created_at: {
                    [Op.gte]: todayIST.toDate()
                },
                status: 'won'
            },
            include: [{
                model: BetResultWingo,
                required: true
            }]
        });

        // Get bet type distribution
        const betTypeDistribution = await BetRecordWingo.findAll({
            attributes: [
                'bet_type',
                [sequelize.fn('SUM', sequelize.col('bet_amount')), 'total_amount'],
                [sequelize.fn('COUNT', sequelize.col('id')), 'total_bets']
            ],
            where: {
                created_at: {
                    [Op.gte]: todayIST.toDate()
                }
            },
            group: ['bet_type']
        });

        return res.status(200).json({
            success: true,
            data: {
                today: {
                    total_bets: todayBets || 0,
                    total_payouts: todayPayouts || 0,
                    net_profit: (todayBets || 0) - (todayPayouts || 0),
                    date: todayIST.format('YYYY-MM-DD')
                },
                bet_distribution: betTypeDistribution.map(dist => ({
                    bet_type: dist.bet_type,
                    total_amount: parseFloat(dist.getDataValue('total_amount')) || 0,
                    total_bets: parseInt(dist.getDataValue('total_bets')) || 0
                }))
            }
        });
    } catch (error) {
        console.error('Error getting Wingo stats:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching Wingo statistics'
        });
    }
};

const setWingoResult = async (req, res) => {
    console.log('🔐 [ADMIN_OVERRIDE] ===== setWingoResult CALLED =====');
    console.log('🔐 [ADMIN_OVERRIDE] Admin override for period:', req.body.periodId);
    console.log('🔐 [ADMIN_OVERRIDE] Number:', req.body.number);
    console.log('🔐 [ADMIN_OVERRIDE] Admin:', req.user?.user_id);
    
    try {
        const { periodId, number, duration, timeline = 'default' } = req.body;

        // Validate required fields
        if (!periodId || number === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Period ID and number are required'
            });
        }

        // Validate number (0-9)
        if (number < 0 || number > 9) {
            return res.status(400).json({
                success: false,
                message: 'Number must be between 0 and 9'
            });
        }

        // Get the period
        const period = await GamePeriod.findOne({
            where: {
                period_id: periodId,
                game_type: 'wingo'
            }
        });

        if (!period) {
            return res.status(404).json({
                success: false,
                message: 'Period not found'
            });
        }

        // Check if period is already completed
        if (period.is_completed) {
            return res.status(400).json({
                success: false,
                message: 'Period is already completed'
            });
        }

        // 🔐 CRITICAL: Check if period has ended (countdown = 0)
        const now = moment().tz('Asia/Kolkata');
        const periodEnd = moment(period.end_time);
        const timeRemaining = periodEnd.diff(now, 'seconds');

        if (timeRemaining > 0) {
            return res.status(400).json({
                success: false,
                message: `Period has not ended yet. Time remaining: ${timeRemaining} seconds`,
                timeRemaining: timeRemaining
            });
        }

        // 🔐 AUTOMATIC: Determine color and size based on number
        const result = determineWingoResult(number);
        console.log('🔐 [ADMIN_OVERRIDE] Auto-determined result:', result);

        // Store result in Redis for override
        const durationKey = period.duration === 30 ? '30s' : 
                          period.duration === 60 ? '1m' : 
                          period.duration === 180 ? '3m' : 
                          period.duration === 300 ? '5m' : '10m';
        
        const overrideKey = `wingo:${durationKey}:${periodId}:result:override`;
        await getRedisHelper().set(overrideKey, JSON.stringify(result));

        // Create result record
        const betResult = await BetResultWingo.create({
            bet_number: periodId,
            result_of_number: result.number,
            result_of_color: result.color,
            result_of_size: result.size,
            duration: period.duration,
            timeline: timeline,
            is_override: true,
            override_by: req.user.user_id
        });

        // Update period status
        await period.update({
            is_completed: true,
            result_id: betResult.id
        });

        // 🔐 SAFE: Use the game logic service to process results properly
        console.log('🔐 [ADMIN_OVERRIDE] Using SAFE game logic service for result processing...');
        
        try {
            // Process results using the proper game logic service
            await gameLogicService.processGameResults(
                'wingo', 
                period.duration, 
                periodId, 
                timeline
            );
            
            console.log('🔐 [ADMIN_OVERRIDE] Result processed successfully using game logic service');
            
        } catch (gameLogicError) {
            console.error('🔐 [ADMIN_OVERRIDE] Game logic service error:', gameLogicError);
            
            // Fallback: Process manually but with proper win/loss logic
            console.log('🔐 [ADMIN_OVERRIDE] Using fallback processing...');
            
            const pendingBets = await BetRecordWingo.findAll({
                where: {
                    bet_number: periodId,
                    status: 'pending'
                }
            });

            console.log('🔐 [ADMIN_OVERRIDE] Found', pendingBets.length, 'pending bets');

            // Process each bet with proper win/loss logic
            for (const bet of pendingBets) {
                console.log('🔐 [ADMIN_OVERRIDE] Processing bet:', {
                    betId: bet.bet_id,
                    userId: bet.user_id,
                    betType: bet.bet_type,
                    betAmount: bet.bet_amount,
                    odds: bet.odds
                });
                
                let isWinner = false;
                let winAmount = 0;

                // Parse the correct bet format (COLOR:violet -> betType=COLOR, betValue=violet)
                const [betType, betValue] = bet.bet_type.split(':');
                console.log('🔐 [ADMIN_OVERRIDE] Parsed bet:', { betType, betValue });

                // PROPER WIN LOGIC
                if (betType === 'NUMBER') {
                    if (result.number === parseInt(betValue)) {
                        isWinner = true;
                        winAmount = bet.bet_amount * bet.odds;
                        console.log('🔐 [ADMIN_OVERRIDE] NUMBER WIN');
                    }
                } else if (betType === 'COLOR') {
                    if (betValue === 'violet') {
                        // Violet wins on 0 and 5 (red_violet and green_violet)
                        if (result.color === 'red_violet' || result.color === 'green_violet') {
                            isWinner = true;
                            winAmount = bet.bet_amount * bet.odds;
                            console.log('🔐 [ADMIN_OVERRIDE] VIOLET WIN');
                        }
                    } else if (betValue === 'red') {
                        if (result.color === 'red' || result.color === 'red_violet') {
                            isWinner = true;
                            winAmount = bet.bet_amount * bet.odds;
                            console.log('🔐 [ADMIN_OVERRIDE] RED WIN');
                        }
                    } else if (betValue === 'green') {
                        if (result.color === 'green' || result.color === 'green_violet') {
                            isWinner = true;
                            winAmount = bet.bet_amount * bet.odds;
                            console.log('🔐 [ADMIN_OVERRIDE] GREEN WIN');
                        }
                    }
                } else if (betType === 'SIZE') {
                    const isBig = result.number >= 5;
                    if ((betValue === 'big' && isBig) || (betValue === 'small' && !isBig)) {
                        isWinner = true;
                        winAmount = bet.bet_amount * bet.odds;
                        console.log('🔐 [ADMIN_OVERRIDE] SIZE WIN');
                    }
                }

                console.log('🔐 [ADMIN_OVERRIDE] Final result:', {
                    isWinner,
                    winAmount,
                    expected: isWinner ? 'WIN' : 'LOSE'
                });

                // Update bet status
                await bet.update({
                    status: isWinner ? 'won' : 'lost',
                    win_amount: isWinner ? winAmount : 0
                });

                // If bet is won, update user balance
                if (isWinner) {
                    const user = await User.findByPk(bet.user_id);
                    if (user) {
                        console.log('🔐 [ADMIN_OVERRIDE] Updating user balance by', winAmount);
                        await user.increment('wallet_balance', { by: winAmount });
                    }
                }
            }
        }

        // Broadcast result to WebSocket clients
        handleBetResult(periodId, {
            ...result,
            timeline: timeline
        });

        console.log('🔐 [ADMIN_OVERRIDE] ===== RESULT PROCESSING COMPLETE =====');
        console.log('🔐 [ADMIN_OVERRIDE] Admin override completed successfully');
        console.log('🔐 [ADMIN_OVERRIDE] All protection systems were respected');

        return res.status(200).json({
            success: true,
            message: 'Result set successfully',
            data: {
                period_id: periodId,
                result: result,
                timestamp: new Date(),
                processed_bets: true,
                timeRemaining: 0
            }
        });
    } catch (error) {
        console.error('🔐 [ADMIN_OVERRIDE] Error setting Wingo result:', error);
        return res.status(500).json({
            success: false,
            message: 'Error setting game result'
        });
    }
};

/**
 * 🔐 AUTOMATIC: Determine Wingo result color and size based on number
 * @param {number} number - The number (0-9)
 * @returns {object} - Complete result with number, color, and size
 */
const determineWingoResult = (number) => {
    let color, size;
    
    // Determine size (big = 5-9, small = 0-4)
    size = number >= 5 ? 'big' : 'small';
    
    // Determine color based on number
    switch (number) {
        case 0:
            color = 'red_violet';  // 0 is red-violet
            break;
        case 1:
        case 2:
        case 3:
        case 4:
            color = 'red';  // 1-4 are red
            break;
        case 5:
            color = 'green_violet';  // 5 is green-violet
            break;
        case 6:
        case 7:
        case 8:
        case 9:
            color = 'green';  // 6-9 are green
            break;
        default:
            color = 'red';  // fallback
    }
    
    return {
        number: number,
        color: color,
        size: size
    };
};

/**
 * 🔐 ADMIN: Get period status for override validation
 */
const getPeriodStatusForOverride = async (req, res) => {
    try {
        const { periodId } = req.params;
        
        if (!periodId) {
            return res.status(400).json({
                success: false,
                message: 'Period ID is required'
            });
        }

        // Get the period
        const period = await GamePeriod.findOne({
            where: {
                period_id: periodId,
                game_type: 'wingo'
            }
        });

        if (!period) {
            return res.status(404).json({
                success: false,
                message: 'Period not found'
            });
        }

        // Calculate time remaining
        const now = moment().tz('Asia/Kolkata');
        const periodEnd = moment(period.end_time);
        const timeRemaining = Math.max(0, periodEnd.diff(now, 'seconds'));

        // Get bet count for this period
        const betCount = await BetRecordWingo.count({
            where: {
                bet_number: periodId,
                status: 'pending'
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                period_id: periodId,
                start_time: period.start_time,
                end_time: period.end_time,
                duration: period.duration,
                is_completed: period.is_completed,
                time_remaining: timeRemaining,
                can_override: timeRemaining === 0 && !period.is_completed,
                bet_count: betCount,
                timeline: period.timeline || 'default'
            }
        });

    } catch (error) {
        console.error('🔐 [ADMIN_OVERRIDE] Error getting period status:', error);
        return res.status(500).json({
            success: false,
            message: 'Error getting period status'
        });
    }
};

module.exports = {
    initializeWebSocket,
    getActivePeriods,
    getCurrentPeriod,
    getRecentPeriods,
    getWingoStats,
    handleBetResult,
    setWingoResult,
    getPeriodStatusForOverride
}; 