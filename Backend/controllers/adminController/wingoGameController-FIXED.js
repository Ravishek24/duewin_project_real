const { BetRecordWingo, BetResultWingo, User } = require('../../models');
const GamePeriod = require('../../models/GamePeriod');const { Op } = require('sequelize');
const moment = require('moment-timezone');
const WebSocket = require('ws');
const unifiedRedis = require('../../config/unifiedRedisManager');
const gameLogicService = require('../../services/gameLogicService');

// 🔧 FIXED: Ensure Redis is properly initialized
let redisHelper = null;
async function getRedisHelper() {
    if (!redisHelper) {
        await unifiedRedis.initialize();
        redisHelper = unifiedRedis.getHelper();
    }
    return redisHelper;
}

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
            numbers: {},
            colors: { red: 0, green: 0, violet: 0 },
            sizes: { big: 0, small: 0 },
            parities: { even: 0, odd: 0 }
        };

        // Initialize number stats
        for (let i = 0; i <= 9; i++) {
            bettingStats.numbers[i] = 0;
        }

        // Process each bet to build statistics
        periodBets.forEach(bet => {
            const [betType, betValue] = bet.bet_type.split(':');
            const betAmount = parseFloat(bet.bet_amount);

            switch (betType) {
                case 'NUMBER':
                    const number = parseInt(betValue);
                    bettingStats.numbers[number] += betAmount;
                    break;
                case 'COLOR':
                    bettingStats.colors[betValue.toLowerCase()] += betAmount;
                    break;
                case 'SIZE':
                    bettingStats.sizes[betValue.toLowerCase()] += betAmount;
                    break;
                case 'PARITY':
                    bettingStats.parities[betValue.toLowerCase()] += betAmount;
                    break;
            }
        });

        return res.status(200).json({
            success: true,
            data: {
                has_active_period: true,
                period: {
                    period_id: currentPeriod.period_id,
                    start_time: currentPeriod.start_time,
                    end_time: currentPeriod.end_time,
                    duration: currentPeriod.duration,
                    time_remaining: moment(currentPeriod.end_time).diff(now, 'seconds'),
                    timeline: timeline,
                    is_completed: currentPeriod.is_completed
                },
                betting: {
                    total_amount: totalBetAmount,
                    unique_bettors: uniqueBettors,
                    total_bets: periodBets.length,
                    statistics: bettingStats
                },
                bets: periodBets.map(bet => ({
                    bet_id: bet.bet_id,
                    user_id: bet.user_id,
                    user_name: bet.User?.user_name || 'Unknown',
                    user_phone: bet.User?.phone || 'Unknown',
                    bet_type: bet.bet_type,
                    bet_amount: bet.bet_amount,
                    status: bet.status,
                    created_at: bet.created_at,
                    bet_info: formatBetTypeInfo(bet)
                }))
            }
        });
    } catch (error) {
        console.error('Error getting current Wingo period:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching current Wingo period'
        });
    }
};

// Get recent completed Wingo periods
const getRecentPeriods = async (req, res) => {
    try {
        const { timeline = 'default', limit = 10 } = req.query;
        
        // Find recent completed periods
        const recentPeriods = await GamePeriod.findAll({
            where: {
                game_type: 'wingo',
                timeline: timeline,
                is_completed: true
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

        // Create a map of results
        const resultsMap = {};
        periodResults.forEach(result => {
            resultsMap[result.bet_number] = result;
        });

        // Format the response
        const formattedPeriods = recentPeriods.map(period => {
            const result = resultsMap[period.period_id];
            return {
                period_id: period.period_id,
                start_time: period.start_time,
                end_time: period.end_time,
                duration: period.duration,
                timeline: period.timeline,
                is_completed: period.is_completed,
                total_bet_amount: period.total_bet_amount,
                total_payout_amount: period.total_payout_amount,
                unique_bettors: period.unique_bettors,
                result: result ? {
                    number: result.result_of_number,
                    color: result.result_of_color,
                    size: result.result_of_size
                } : null
            };
        });

        return res.status(200).json({
            success: true,
            data: {
                periods: formattedPeriods,
                timeline: timeline,
                total_count: formattedPeriods.length
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
        const { timeline = 'default', days = 7 } = req.query;
        const startDate = moment().tz('Asia/Kolkata').subtract(days, 'days').startOf('day');
        const endDate = moment().tz('Asia/Kolkata').endOf('day');

        // Get total bets today
        const todayBets = await BetRecordWingo.sum('bet_amount', {
            where: {
                timeline: timeline,
                created_at: {
                    [Op.gte]: moment().tz('Asia/Kolkata').startOf('day').toDate(),
                    [Op.lte]: moment().tz('Asia/Kolkata').endOf('day').toDate()
                }
            }
        });

        // Get total payouts today (won bets only)
        const todayPayouts = await BetRecordWingo.sum('bet_amount', {
            where: {
                timeline: timeline,
                status: 'won',
                created_at: {
                    [Op.gte]: moment().tz('Asia/Kolkata').startOf('day').toDate(),
                    [Op.lte]: moment().tz('Asia/Kolkata').endOf('day').toDate()
                }
            },
            include: [{
                model: BetResultWingo,
                where: {
                    created_at: {
                        [Op.gte]: moment().tz('Asia/Kolkata').startOf('day').toDate(),
                        [Op.lte]: moment().tz('Asia/Kolkata').endOf('day').toDate()
                    }
                }
            }]
        });

        // Get bet type distribution
        const betTypeDistribution = await BetRecordWingo.findAll({
            attributes: [
                'bet_type',
                [sequelize.fn('COUNT', sequelize.col('bet_id')), 'count'],
                [sequelize.fn('SUM', sequelize.col('bet_amount')), 'total_amount']
            ],
            where: {
                timeline: timeline,
                created_at: {
                    [Op.gte]: startDate.toDate(),
                    [Op.lte]: endDate.toDate()
                }
            },
            group: ['bet_type'],
            order: [[sequelize.fn('COUNT', sequelize.col('bet_id')), 'DESC']]
        });

        return res.status(200).json({
            success: true,
            data: {
                timeline: timeline,
                period: `${days} days`,
                today: {
                    total_bets: todayBets || 0,
                    total_payouts: todayPayouts || 0,
                    profit: (todayBets || 0) - (todayPayouts || 0)
                },
                bet_distribution: betTypeDistribution.map(item => ({
                    bet_type: item.bet_type,
                    count: parseInt(item.getDataValue('count')),
                    total_amount: parseFloat(item.getDataValue('total_amount'))
                }))
            }
        });
    } catch (error) {
        console.error('Error getting Wingo statistics:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching Wingo statistics'
        });
    }
};


const setWingoResult = async (req, res) => {
    const requestId = `ADM-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();
    
    console.log('\n🔐 [ADMIN_OVERRIDE] ============================================');
    console.log(`🔐 [ADMIN_OVERRIDE] REQUEST ID: ${requestId}`);
    console.log('🔐 [ADMIN_OVERRIDE] ===== ADMIN SET RESULT INITIATED =====');
    console.log('🔐 [ADMIN_OVERRIDE] Timestamp:', new Date().toISOString());
    console.log('🔐 [ADMIN_OVERRIDE] Admin User ID:', req.user?.user_id);
    console.log('🔐 [ADMIN_OVERRIDE] Admin Email:', req.user?.email);
    console.log('🔐 [ADMIN_OVERRIDE] Request Body:', JSON.stringify(req.body, null, 2));
    console.log('🔐 [ADMIN_OVERRIDE] Request Headers:', {
        'user-agent': req.headers['user-agent'],
        'x-forwarded-for': req.headers['x-forwarded-for'],
        'authorization': req.headers.authorization ? 'Bearer ***' : 'None'
    });
    console.log('🔐 [ADMIN_OVERRIDE] IP Address:', req.ip || req.connection.remoteAddress);
    
    try {
        const { periodId, number, duration, timeline = 'default' } = req.body;
        
        console.log('\n🔐 [ADMIN_OVERRIDE] === STEP 1: INPUT VALIDATION ===');

        // Validate required fields
        console.log('🔐 [ADMIN_OVERRIDE] Validating input fields...');
        console.log('🔐 [ADMIN_OVERRIDE] Period ID:', periodId);
        console.log('🔐 [ADMIN_OVERRIDE] Number:', number);
        console.log('🔐 [ADMIN_OVERRIDE] Duration:', duration);
        console.log('🔐 [ADMIN_OVERRIDE] Timeline:', timeline);
        
        if (!periodId || number === undefined) {
            console.log('❌ [ADMIN_OVERRIDE] VALIDATION FAILED: Missing required fields');
            console.log('❌ [ADMIN_OVERRIDE] Period ID provided:', !!periodId);
            console.log('❌ [ADMIN_OVERRIDE] Number provided:', number !== undefined);
            return res.status(400).json({
                success: false,
                message: 'Period ID and number are required',
                requestId: requestId,
                debug: {
                    periodId: !!periodId,
                    numberProvided: number !== undefined
                }
            });
        }

        // Validate number (0-9)
        if (number < 0 || number > 9) {
            console.log('❌ [ADMIN_OVERRIDE] VALIDATION FAILED: Invalid number range');
            console.log('❌ [ADMIN_OVERRIDE] Number provided:', number);
            console.log('❌ [ADMIN_OVERRIDE] Valid range: 0-9');
            return res.status(400).json({
                success: false,
                message: 'Number must be between 0 and 9',
                requestId: requestId,
                debug: {
                    numberProvided: number,
                    validRange: '0-9'
                }
            });
        }
        
        console.log('✅ [ADMIN_OVERRIDE] Input validation passed');

        console.log('\n🔐 [ADMIN_OVERRIDE] === STEP 2: PERIOD VALIDATION (REDIS-BASED) ===');
        
        // Extract duration from period ID and check Redis for period existence
        console.log('🔐 [ADMIN_OVERRIDE] Extracting period information from ID...');
        const dateStr = periodId.substring(0, 8);
        console.log('🔐 [ADMIN_OVERRIDE] Period date:', dateStr);
        console.log('🔐 [ADMIN_OVERRIDE] Using duration from request or default:', duration || 30);
        
        // Use provided duration or default to 30 seconds
        const periodDuration = duration || 30;
        const redisKey = periodDuration === 30 ? '30s' : 
                          periodDuration === 60 ? '1m' : 
                          periodDuration === 180 ? '3m' : 
                          periodDuration === 300 ? '5m' : '10m';
        
        console.log('🔐 [ADMIN_OVERRIDE] Duration key:', redisKey);
        
        // 🔧 FIXED: Get Redis helper properly
        console.log('🔐 [ADMIN_OVERRIDE] Initializing Redis connection...');
        const helper = await getRedisHelper();
        console.log('✅ [ADMIN_OVERRIDE] Redis helper initialized');
        
        // Check if period exists in Redis
        console.log('🔐 [ADMIN_OVERRIDE] Checking period existence in Redis...');
        const periodKey = `wingo:${redisKey}:${periodId}`;
        const periodData = await helper.get(periodKey);
        
        // Check if period already has a result
        const existingResultKeys = [
            `wingo:${redisKey}:${periodId}:result`,
            `wingo:${redisKey}:${periodId}:result:override`
        ];
        
        let hasExistingResult = false;
        for (const resultKey of existingResultKeys) {
            const existingResult = await helper.get(resultKey);
            if (existingResult) {
                hasExistingResult = true;
                console.log('🔐 [ADMIN_OVERRIDE] Found existing result at key:', resultKey);
                break;
            }
        }
        
        if (hasExistingResult) {
            console.log('❌ [ADMIN_OVERRIDE] PERIOD ALREADY HAS RESULT');
            console.log('❌ [ADMIN_OVERRIDE] Cannot override a period that already has a result');
            return res.status(400).json({
                success: false,
                message: 'Period already has a result set',
                requestId: requestId,
                debug: {
                    periodId: periodId,
                    hasExistingResult: true,
                    checkedKeys: existingResultKeys
                }
            });
        }
        
        // Calculate period timing based on period ID
        console.log('🔐 [ADMIN_OVERRIDE] Calculating period timing...');
        const sequenceStr = periodId.substring(8);
        const sequenceNumber = parseInt(sequenceStr, 10);
        
        // Calculate start time: date + sequence * duration
        const periodStart = moment.tz(`${dateStr}`, 'YYYYMMDD', 'Asia/Kolkata')
            .add(sequenceNumber * periodDuration, 'seconds');
        const periodEnd = moment(periodStart).add(periodDuration, 'seconds');
        
        console.log('🔐 [ADMIN_OVERRIDE] Calculated period times:');
        console.log('🔐 [ADMIN_OVERRIDE] - Start time:', periodStart.format('YYYY-MM-DD HH:mm:ss'));
        console.log('🔐 [ADMIN_OVERRIDE] - End time:', periodEnd.format('YYYY-MM-DD HH:mm:ss'));
        console.log('🔐 [ADMIN_OVERRIDE] - Sequence number:', sequenceNumber);
        
        console.log('✅ [ADMIN_OVERRIDE] Period validation passed (Redis-based)');

        // 🔐 CRITICAL: Check if period has ended (countdown = 0)
        console.log('\n🔐 [ADMIN_OVERRIDE] === STEP 3: TIME VALIDATION ===');
        const now = moment().tz('Asia/Kolkata');
        const timeRemaining = Math.max(0, periodEnd.diff(now, 'seconds'));
        
        console.log('🔐 [ADMIN_OVERRIDE] Current time (IST):', now.format('YYYY-MM-DD HH:mm:ss'));
        console.log('🔐 [ADMIN_OVERRIDE] Period end time:', periodEnd.format('YYYY-MM-DD HH:mm:ss'));
        console.log('🔐 [ADMIN_OVERRIDE] Time remaining (seconds):', timeRemaining);

        if (timeRemaining > 0) {
            console.log('❌ [ADMIN_OVERRIDE] PERIOD NOT ENDED YET');
            console.log('❌ [ADMIN_OVERRIDE] Cannot override while period is active');
            console.log('❌ [ADMIN_OVERRIDE] Time remaining:', timeRemaining, 'seconds');
            return res.status(400).json({
                success: false,
                message: `Period has not ended yet. Time remaining: ${timeRemaining} seconds`,
                requestId: requestId,
                timeRemaining: timeRemaining,
                debug: {
                    currentTime: now.toISOString(),
                    periodEndTime: periodEnd.toISOString(),
                    timeRemainingSeconds: timeRemaining
                }
            });
        }
        
        console.log('✅ [ADMIN_OVERRIDE] Period has ended, override allowed');
        
        // Create a period object for compatibility with rest of the code
        const period = {
            period_id: periodId,
            duration: periodDuration,
            start_time: periodStart.toDate(),
            end_time: periodEnd.toDate(),
            is_completed: false,
            timeline: timeline,
            source: 'redis_calculated'
        };

        console.log('\n🔐 [ADMIN_OVERRIDE] === STEP 4: RESULT CALCULATION ===');
        
        // 🔐 AUTOMATIC: Determine color and size based on number
        console.log('🔐 [ADMIN_OVERRIDE] Calculating result for number:', number);
        const result = determineWingoResult(number);
        console.log('🔐 [ADMIN_OVERRIDE] ✅ Result calculated successfully:', {
            number: result.number,
            color: result.color,
            size: result.size
        });

        console.log('\n🔐 [ADMIN_OVERRIDE] === STEP 5: REDIS OVERRIDE SETUP ===');
        
        // Store result in Redis for override - CRITICAL FOR ENSURING ADMIN RESULT TAKES PRECEDENCE
        const resultDurationKey = period.duration === 30 ? '30s' : 
                          period.duration === 60 ? '1m' : 
                          period.duration === 180 ? '3m' : 
                          period.duration === 300 ? '5m' : '10m';
        
        console.log('🔐 [ADMIN_OVERRIDE] Duration mapping:', {
            actualDuration: period.duration,
            durationKey: resultDurationKey
        });
        
        const overrideKey = `wingo:${resultDurationKey}:${periodId}:result:override`;
        console.log('🔐 [ADMIN_OVERRIDE] Redis override key:', overrideKey);
        console.log('🔐 [ADMIN_OVERRIDE] Storing override in Redis...');
        
        await helper.set(overrideKey, JSON.stringify(result));
        console.log('✅ [ADMIN_OVERRIDE] Override stored in Redis successfully');
        
        // Additional override keys to ensure complete coverage
        const additionalOverrideKeys = [
            `wingo:${periodId}:admin:override`,
            `wingo:result:${periodId}:forced`,
            `game:wingo:${resultDurationKey}:${periodId}:admin_result`
        ];
        
        console.log('🔐 [ADMIN_OVERRIDE] Setting additional override keys for maximum coverage...');
        for (const key of additionalOverrideKeys) {
            await helper.set(key, JSON.stringify({
                ...result,
                isAdminOverride: true,
                adminUserId: req.user.user_id,
                overrideTimestamp: new Date().toISOString(),
                requestId: requestId
            }));
            console.log(`✅ [ADMIN_OVERRIDE] Set override key: ${key}`);
        }

        console.log('\n🔐 [ADMIN_OVERRIDE] === STEP 6: REDIS RESULT STORAGE (SCHEDULER WILL HANDLE DB) ===');
        
        // Store the admin result in Redis for scheduler to pick up
        console.log('🔐 [ADMIN_OVERRIDE] Storing admin result for scheduler to process...');
        const resultKey = `wingo:${resultDurationKey}:${periodId}:result`;
        const adminResultData = {
            ...result,
            isAdminOverride: true,
            adminUserId: req.user.user_id,
            overrideTimestamp: new Date().toISOString(),
            requestId: requestId,
            duration: period.duration,
            timeline: timeline,
            periodId: periodId
        };
        
        // Store the result that scheduler will use
        await helper.set(resultKey, JSON.stringify(adminResultData));
        console.log('✅ [ADMIN_OVERRIDE] Admin result stored for scheduler at key:', resultKey);
        
        // Mark the period as having an admin override
        const adminMetaKey = `wingo:${resultDurationKey}:${periodId}:admin_meta`;
        await helper.set(adminMetaKey, JSON.stringify({
            isAdminOverride: true,
            adminUserId: req.user.user_id,
            setAt: new Date().toISOString(),
            requestId: requestId
        }));
        
        console.log('✅ [ADMIN_OVERRIDE] Admin metadata stored at key:', adminMetaKey);
        console.log('🔐 [ADMIN_OVERRIDE] Scheduler will handle database storage when processing this period');

        console.log('\n🔐 [ADMIN_OVERRIDE] === STEP 7: SCHEDULER NOTIFICATION ===');
        
        // Skip bet processing - let the scheduler handle it when it processes this period
        console.log('🔐 [ADMIN_OVERRIDE] SKIPPING bet processing - scheduler will handle this');
        console.log('🔐 [ADMIN_OVERRIDE] When scheduler processes period', periodId, 'it will:');
        console.log('🔐 [ADMIN_OVERRIDE] 1. Find the admin-set result in Redis');
        console.log('🔐 [ADMIN_OVERRIDE] 2. Use the admin result instead of generating one');
        console.log('🔐 [ADMIN_OVERRIDE] 3. Process all bets with proper win/loss logic');
        console.log('🔐 [ADMIN_OVERRIDE] 4. Update user balances');
        console.log('🔐 [ADMIN_OVERRIDE] 5. Store everything in the database');
        console.log('🔐 [ADMIN_OVERRIDE] 6. Broadcast results to WebSocket clients');
        
        console.log('✅ [ADMIN_OVERRIDE] Admin result successfully prepared for scheduler');

        console.log('\n🔐 [ADMIN_OVERRIDE] === STEP 8: RESPONSE PREPARATION ===');
        
        // Skip WebSocket broadcast - scheduler will handle this when processing
        console.log('🔐 [ADMIN_OVERRIDE] SKIPPING WebSocket broadcast - scheduler will handle this');
        console.log('🔐 [ADMIN_OVERRIDE] WebSocket clients will be notified when scheduler processes the period');

        const totalDuration = Date.now() - startTime;
        
        console.log('\n🔐 [ADMIN_OVERRIDE] =====================================');
        console.log('🔐 [ADMIN_OVERRIDE] ===== ADMIN OVERRIDE SETUP COMPLETED =====');
        console.log('🔐 [ADMIN_OVERRIDE] =====================================');
        console.log('✅ [ADMIN_OVERRIDE] Status: SUCCESS - READY FOR SCHEDULER');
        console.log('✅ [ADMIN_OVERRIDE] Request ID:', requestId);
        console.log('✅ [ADMIN_OVERRIDE] Total Duration:', totalDuration, 'ms');
        console.log('✅ [ADMIN_OVERRIDE] Admin User:', req.user.user_id);
        console.log('✅ [ADMIN_OVERRIDE] Period:', periodId);
        console.log('✅ [ADMIN_OVERRIDE] Result:', result);
        console.log('✅ [ADMIN_OVERRIDE] Result stored in Redis for scheduler');
        console.log('✅ [ADMIN_OVERRIDE] Scheduler will process bets and update balances');
        console.log('✅ [ADMIN_OVERRIDE] Scheduler will store in database');
        console.log('✅ [ADMIN_OVERRIDE] Scheduler will broadcast to WebSocket clients');
        console.log('🔐 [ADMIN_OVERRIDE] =====================================\n');

        return res.status(200).json({
            success: true,
            message: 'Admin result set successfully - scheduler will process when period ends',
            requestId: requestId,
            data: {
                period_id: periodId,
                result: result,
                timestamp: new Date(),
                stored_in_redis: true,
                will_be_processed_by_scheduler: true,
                timeRemaining: 0,
                isAdminOverride: true,
                adminUserId: req.user.user_id,
                setupDurationMs: totalDuration,
                redisKeys: {
                    resultKey: `wingo:${resultDurationKey}:${periodId}:result`,
                    metaKey: `wingo:${resultDurationKey}:${periodId}:admin_meta`,
                    overrideKeys: [
                        `wingo:${resultDurationKey}:${periodId}:result:override`,
                        `wingo:${periodId}:admin:override`,
                        `wingo:result:${periodId}:forced`,
                        `game:wingo:${resultDurationKey}:${periodId}:admin_result`
                    ]
                }
            }
        });
    } catch (error) {
        const totalDuration = Date.now() - startTime;
        
        console.log('\n❌ [ADMIN_OVERRIDE] =====================================');
        console.log('❌ [ADMIN_OVERRIDE] ===== ADMIN OVERRIDE FAILED =====');
        console.log('❌ [ADMIN_OVERRIDE] =====================================');
        console.error('❌ [ADMIN_OVERRIDE] Request ID:', requestId);
        console.error('❌ [ADMIN_OVERRIDE] Duration before failure:', totalDuration, 'ms');
        console.error('❌ [ADMIN_OVERRIDE] Error message:', error.message);
        console.error('❌ [ADMIN_OVERRIDE] Error stack:', error.stack);
        console.error('❌ [ADMIN_OVERRIDE] Admin User:', req.user?.user_id);
        console.error('❌ [ADMIN_OVERRIDE] Request body:', JSON.stringify(req.body, null, 2));
        console.log('❌ [ADMIN_OVERRIDE] =====================================\n');
        
        return res.status(500).json({
            success: false,
            message: 'Error setting game result',
            requestId: requestId,
            error: error.message,
            duration: totalDuration
        });
    }
};

/**
 * 🔐 FIXED: Determine Wingo result color and size based on number
 * Uses the SAME color mapping as gameLogicService to ensure consistency
 * @param {number} number - The number (0-9)
 * @returns {object} - Complete result with number, color, and size
 */
const determineWingoResult = (number) => {
    // Use the CORRECT color mapping (same as gameLogicService.js)
    const colorMap = {
        0: 'red_violet',    // 0 is red + violet
        1: 'green',         // 1 is green
        2: 'red',           // 2 is red
        3: 'green',         // 3 is green
        4: 'red',           // 4 is red
        5: 'green_violet',  // 5 is green + violet
        6: 'red',           // 6 is red ✅ FIXED
        7: 'green',         // 7 is green
        8: 'red',           // 8 is red
        9: 'green'          // 9 is green
    };
    
    const color = colorMap[number] || 'red'; // fallback to red
    const size = number >= 5 ? 'big' : 'small';
    
    console.log(`🎨 [ADMIN_COLOR_FIX] Number ${number} -> color: ${color}, size: ${size}`);
    
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
        const { duration = 30 } = req.query; // Allow duration to be specified
        
        if (!periodId) {
            return res.status(400).json({
                success: false,
                message: 'Period ID is required'
            });
        }

        console.log('🔐 [PERIOD_STATUS] Checking period status for:', periodId);
        console.log('🔐 [PERIOD_STATUS] Duration:', duration);

        // Extract period info and calculate timing (Redis-based approach)
        const dateStr = periodId.substring(0, 8);
        const sequenceStr = periodId.substring(8);
        const sequenceNumber = parseInt(sequenceStr, 10);
        const periodDuration = parseInt(duration);
        
        const statusDurationKey = periodDuration === 30 ? '30s' : 
                          periodDuration === 60 ? '1m' : 
                          periodDuration === 180 ? '3m' : 
                          periodDuration === 300 ? '5m' : '10m';

        // Calculate period timing
        const periodStart = moment.tz(`${dateStr}`, 'YYYYMMDD', 'Asia/Kolkata')
            .add(sequenceNumber * periodDuration, 'seconds');
        const periodEnd = moment(periodStart).add(periodDuration, 'seconds');

        // Calculate time remaining
        const now = moment().tz('Asia/Kolkata');
        const timeRemaining = Math.max(0, periodEnd.diff(now, 'seconds'));

        // 🔧 FIXED: Get Redis helper properly
        const helper = await getRedisHelper();

        // Check if period already has a result in Redis
        const existingResultKeys = [
            `wingo:${statusDurationKey}:${periodId}:result`,
            `wingo:${statusDurationKey}:${periodId}:result:override`
        ];
        
        let hasExistingResult = false;
        let resultSource = null;
        for (const resultKey of existingResultKeys) {
            const existingResult = await helper.get(resultKey);
            if (existingResult) {
                hasExistingResult = true;
                resultSource = resultKey;
                console.log('🔐 [PERIOD_STATUS] Found existing result at key:', resultKey);
                break;
            }
        }

        // Determine if override is allowed
        const canOverride = timeRemaining <= 0 && !hasExistingResult;

        return res.status(200).json({
            success: true,
            data: {
                period_id: periodId,
                duration: periodDuration,
                start_time: periodStart.toISOString(),
                end_time: periodEnd.toISOString(),
                time_remaining: timeRemaining,
                has_ended: timeRemaining <= 0,
                has_existing_result: hasExistingResult,
                result_source: resultSource,
                can_override: canOverride,
                status: timeRemaining > 0 ? 'active' : 
                       hasExistingResult ? 'completed' : 'ready_for_override'
            }
        });
    } catch (error) {
        console.error('🔐 [PERIOD_STATUS] Error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error checking period status',
            error: error.message
        });
    }
};

module.exports = {
    initializeWebSocket,
    getActivePeriods,
    getCurrentPeriod,
    getRecentPeriods,
    getWingoStats,
    setWingoResult,
    getPeriodStatusForOverride
};