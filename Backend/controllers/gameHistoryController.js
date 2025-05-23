const BetResultWingo = require('../models/BetResultWingo');
const BetResult5D = require('../models/BetResult5D');
const BetResultK3 = require('../models/BetResultK3');
const BetResultTrxWix = require('../models/BetResultTrxWix');
const { sequelize } = require('../config/db');
const { redis } = require('../config/redisConfig');
const winston = require('winston');
const path = require('path');

// Configure Winston logger
const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ 
            filename: path.join('logs', 'game-history.log') 
        }),
        new winston.transports.File({ 
            filename: path.join('logs', 'game-history-errors.log'),
            level: 'error'
        })
    ]
});

/**
 * Get game history from database or Redis
 * @param {string} gameType - Game type (wingo, fiveD, k3, trx_wix)
 * @param {number} duration - Duration in seconds
 * @param {number} limit - Limit of results to return
 * @param {number} offset - Offset for pagination
 * @returns {Object} - Game history
 */
const fetchGameHistory = async (gameType, duration, limit = 20, offset = 0) => {
    try {
        // Get duration key for Redis
        const durationKey = duration === 30 ? '30s' : 
                          duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';
        
        // Try to get from Redis first (for fast access)
        const redisKey = `${gameType}:${durationKey}:history`;
        const cachedHistory = await redis.get(redisKey);
        
        if (cachedHistory) {
            const historyData = JSON.parse(cachedHistory);
            
            // Apply pagination on cached data
            return {
                success: true,
                history: historyData.slice(offset, offset + limit),
                total: historyData.length
            };
        }
        
        // If not in Redis, fetch from database
        let results;
        let modelToUse;
        
        switch (gameType) {
            case 'wingo':
                modelToUse = BetResultWingo;
                break;
            case 'fiveD':
                modelToUse = BetResult5D;
                break;
            case 'k3':
                modelToUse = BetResultK3;
                break;
            case 'trx_wix':
                modelToUse = BetResultTrxWix;
                break;
            default:
                throw new Error(`Invalid game type: ${gameType}`);
        }
        
        // Filter by duration by checking period ID format
        // Period IDs are in format YYYYMMDDXXXXXXXXX where X is the sequence number
        // We'll find periods with the correct reset timing based on duration
        
        // Get all results from the database for this game type
        results = await modelToUse.findAll({
            order: [['created_at', 'DESC']],
            limit: 100 // Get more than needed for filtering
        });
        
        // Filter results by duration
        const filteredResults = results.filter(result => {
            // Extract period ID
            const periodId = result.bet_number;
            
            // Get sequence number from the last 9 digits
            const sequenceNumber = parseInt(periodId.substring(8), 10);
            
            // Check if this sequence number corresponds to the specified duration
            // For a given sequence number, its duration is determined by:
            // - If it's divisible by (600/duration), then it's a valid period for this duration
            const isDurationPeriod = sequenceNumber % Math.floor(600 / duration) === 0;
            
            return isDurationPeriod;
        });
        
        // Apply pagination
        const paginatedResults = filteredResults.slice(offset, offset + limit);
        
        // Cache results in Redis
        await redis.set(redisKey, JSON.stringify(filteredResults), 'EX', 300); // Cache for 5 minutes
        
        return {
            success: true,
            history: paginatedResults,
            total: filteredResults.length
        };
    } catch (error) {
        logger.error('Error fetching game history', {
            error: error.message,
            stack: error.stack,
            gameType,
            duration,
            limit,
            offset
        });
        
        return {
            success: false,
            message: 'Failed to fetch game history',
            error: error.message
        };
    }
};

// Controller methods for different game types and durations

// Wingo history controllers
const getWingoHistory30s = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        const results = await BetResultWingo.findAll({
            where: {
                duration: 30,
                timeline: '30s'
            },
            order: [['created_at', 'DESC']],
            limit: limit,
            offset: offset
        });

        return res.status(200).json({
            success: true,
            data: {
                results: results.map(result => ({
                    period_id: result.bet_number,
                    result: {
                        number: result.result_of_number,
                        size: result.result_of_size,
                        color: result.result_of_color
                    },
                    duration: result.duration,
                    timeline: result.timeline,
                    created_at: result.created_at
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching Wingo 30s history:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching game history'
        });
    }
};

const getWingoHistory60s = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        const results = await BetResultWingo.findAll({
            where: {
                duration: 60,
                timeline: '1m'
            },
            order: [['created_at', 'DESC']],
            limit: limit,
            offset: offset
        });

        return res.status(200).json({
            success: true,
            data: {
                results: results.map(result => ({
                    period_id: result.bet_number,
                    result: {
                        number: result.result_of_number,
                        size: result.result_of_size,
                        color: result.result_of_color
                    },
                    duration: result.duration,
                    timeline: result.timeline,
                    created_at: result.created_at
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching Wingo 60s history:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching game history'
        });
    }
};

const getWingoHistory180s = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        const results = await BetResultWingo.findAll({
            where: {
                duration: 180,
                timeline: '3m'
            },
            order: [['created_at', 'DESC']],
            limit: limit,
            offset: offset
        });

        return res.status(200).json({
            success: true,
            data: {
                results: results.map(result => ({
                    period_id: result.bet_number,
                    result: {
                        number: result.result_of_number,
                        size: result.result_of_size,
                        color: result.result_of_color
                    },
                    duration: result.duration,
                    timeline: result.timeline,
                    created_at: result.created_at
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching Wingo 180s history:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching game history'
        });
    }
};

const getWingoHistory300s = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const offset = parseInt(req.query.offset) || 0;
        
        const results = await BetResultWingo.findAll({
            where: {
                duration: 300,
                timeline: '5m'
            },
            order: [['created_at', 'DESC']],
            limit: limit,
            offset: offset
        });

        return res.status(200).json({
            success: true,
            data: {
                results: results.map(result => ({
                    period_id: result.bet_number,
                    result: {
                        number: result.result_of_number,
                        size: result.result_of_size,
                        color: result.result_of_color
                    },
                    duration: result.duration,
                    timeline: result.timeline,
                    created_at: result.created_at
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching Wingo 300s history:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching game history'
        });
    }
};

// K3 history controllers
const getK3History60s = async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await fetchGameHistory('k3', 60, limit, offset);
    
    if (result.success) {
        return res.status(200).json(result);
    } else {
        return res.status(500).json(result);
    }
};

const getK3History180s = async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await fetchGameHistory('k3', 180, limit, offset);
    
    if (result.success) {
        return res.status(200).json(result);
    } else {
        return res.status(500).json(result);
    }
};

const getK3History300s = async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await fetchGameHistory('k3', 300, limit, offset);
    
    if (result.success) {
        return res.status(200).json(result);
    } else {
        return res.status(500).json(result);
    }
};

const getK3History600s = async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await fetchGameHistory('k3', 600, limit, offset);
    
    if (result.success) {
        return res.status(200).json(result);
    } else {
        return res.status(500).json(result);
    }
};

// 5D history controllers
const get5DHistory60s = async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await fetchGameHistory('fiveD', 60, limit, offset);
    
    if (result.success) {
        return res.status(200).json(result);
    } else {
        return res.status(500).json(result);
    }
};

const get5DHistory180s = async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await fetchGameHistory('fiveD', 180, limit, offset);
    
    if (result.success) {
        return res.status(200).json(result);
    } else {
        return res.status(500).json(result);
    }
};

const get5DHistory300s = async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await fetchGameHistory('fiveD', 300, limit, offset);
    
    if (result.success) {
        return res.status(200).json(result);
    } else {
        return res.status(500).json(result);
    }
};

const get5DHistory600s = async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await fetchGameHistory('fiveD', 600, limit, offset);
    
    if (result.success) {
        return res.status(200).json(result);
    } else {
        return res.status(500).json(result);
    }
};

// TRX_WIX history controllers
const getTrxWixHistory30s = async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await fetchGameHistory('trx_wix', 30, limit, offset);
    
    if (result.success) {
        return res.status(200).json(result);
    } else {
        return res.status(500).json(result);
    }
};

const getTrxWixHistory60s = async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await fetchGameHistory('trx_wix', 60, limit, offset);
    
    if (result.success) {
        return res.status(200).json(result);
    } else {
        return res.status(500).json(result);
    }
};

const getTrxWixHistory180s = async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await fetchGameHistory('trx_wix', 180, limit, offset);
    
    if (result.success) {
        return res.status(200).json(result);
    } else {
        return res.status(500).json(result);
    }
};

const getTrxWixHistory300s = async (req, res) => {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    const result = await fetchGameHistory('trx_wix', 300, limit, offset);
    
    if (result.success) {
        return res.status(200).json(result);
    } else {
        return res.status(500).json(result);
    }
};

// Generic game history controller
const getGameHistory = async (req, res) => {
    const gameType = req.query.gameType;
    const duration = parseInt(req.query.duration) || 60;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;
    
    if (!gameType) {
        return res.status(400).json({
            success: false,
            message: 'Game type is required'
        });
    }
    
    // Validate game type
    if (!['wingo', 'fiveD', 'k3', 'trx_wix'].includes(gameType)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid game type'
        });
    }
    
    // Validate duration
    const validDurations = gameType === 'wingo' || gameType === 'trx_wix' 
        ? [30, 60, 180, 300] 
        : [60, 180, 300, 600];
    
    if (!validDurations.includes(duration)) {
        return res.status(400).json({
            success: false,
            message: `Invalid duration for ${gameType}. Valid durations are: ${validDurations.join(', ')}`
        });
    }
    
    const result = await fetchGameHistory(gameType, duration, limit, offset);
    
    if (result.success) {
        return res.status(200).json(result);
    } else {
        return res.status(500).json(result);
    }
};

module.exports = {
    getWingoHistory30s,
    getWingoHistory60s,
    getWingoHistory180s,
    getWingoHistory300s,
    getK3History60s,
    getK3History180s,
    getK3History300s,
    getK3History600s,
    get5DHistory60s,
    get5DHistory180s,
    get5DHistory300s,
    get5DHistory600s,
    getTrxWixHistory30s,
    getTrxWixHistory60s,
    getTrxWixHistory180s,
    getTrxWixHistory300s,
    getGameHistory
}; 