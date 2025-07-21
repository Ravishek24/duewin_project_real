
const { sequelize } = require('../config/db');
const User = require('../models/User');
const BetRecordTrxWix = require('../models/BetRecordTrxWix');
const BetResultTrxWix = require('../models/BetResultTrxWix');
const { v4: uuidv4 } = require('uuid');
const winston = require('winston');
const path = require('path');
const tronHashService = require('./tronHashService');
const gameLogicService = require('./gameLogicService');
const { broadcastToGame } = require('./websocketService');

// Configure Winston logger
const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ 
            filename: path.join('logs', 'trx_wix-results.log') 
        }),
        new winston.transports.File({ 
            filename: path.join('logs', 'trx_wix-errors.log'),
            level: 'error'
        })
    ]
});

// Risk Management Constants
const RISK_LEVELS = {
    LOW: {
        maxPayoutPercent: 60,
        maxBetAmount: 1000,
        maxConsecutiveWins: 3
    },
    MEDIUM: {
        maxPayoutPercent: 70,
        maxBetAmount: 5000,
        maxConsecutiveWins: 5
    },
    HIGH: {
        maxPayoutPercent: 75,
        maxBetAmount: 10000,
        maxConsecutiveWins: 7
    }
};

/**
 * Process a bet for trx_wix game
 * @param {Object} betData - Bet data
 * @returns {Object} - Processing result
 */
const processBet = async (betData) => {
    // Use the main game logic service for bet processing
    return await gameLogicService.processBet({
        ...betData,
        gameType: 'trx_wix'
    });
};

/**
 * Calculate result with TRON hash verification
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Promise<Object>} - Result with verification
 */
const calculateResultWithVerification = async (duration, periodId) => {
    try {
        // Use the main game logic service for result calculation
        const result = await gameLogicService.calculateOptimizedResult('trx_wix', duration, periodId);
        
        // Get verification hash for the result
        const verification = await tronHashService.getResultWithVerification(result.optimalResult);
        
        // Store the result
        await storeResult(duration, periodId, {
            ...verification,
            result: result.optimalResult.result
        });
        
        // Check winners
        const winners = await checkWinners(duration, periodId, result.optimalResult.result);
        
        // Broadcast result to all connected clients
        const durationKey = duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';
        
        const broadcastData = {
            gameType: 'trx_wix',
            duration,
            periodId,
            result: {
                ...result.optimalResult.result,
                verification: {
                    hash: verification.hash,
                    link: verification.link,
                    block: verification.blockNumber,
                    time: verification.resultTime
                }
            },
            winners,
            riskLevel: result.optimalResult.riskLevel,
            houseEdgePercent: result.optimalResult.houseEdgePercent
        };
        
        // 💰 CRYPTO BROADCAST LOGGER - Track when results are sent to clients
        console.log('💰 [TRX_WIX_BROADCAST] Broadcasting result to clients:', {
            periodId: periodId,
            result: result.optimalResult.result,
            verification: {
                hash: verification.hash,
                link: verification.link,
                block: verification.blockNumber || 'NULL',
                time: verification.resultTime || 'DEFAULT'
            },
            duration: duration,
            winnersCount: winners.length,
            timestamp: new Date().toISOString()
        });
        
        broadcastToGame('trx_wix', duration, 'periodResult', broadcastData);
        
        return {
            result: result.optimalResult.result,
            verification: {
                hash: verification.hash,
                link: verification.link,
                block: verification.blockNumber,
                time: verification.resultTime
            },
            winners,
            riskLevel: result.optimalResult.riskLevel,
            houseEdgePercent: result.optimalResult.houseEdgePercent
        };
    } catch (error) {
        logger.error('Error calculating result with verification:', error);
        throw error;
    }
};

/**
 * Store result
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {Object} result - Result object
 */
const storeResult = async (duration, periodId, result) => {
    try {
        const durationKey = duration === 60 ? '1m' : 
                          duration === 180 ? '3m' : 
                          duration === 300 ? '5m' : '10m';
        
        // Store in Redis using game logic service
        await gameLogicService.storeTemporaryResult('trx_wix', duration, periodId, result);
        
        // Store in database
        const dbResult = await BetResultTrxWix.create({
            period: periodId,
            result: result.result,
            verification_hash: result.hash,
            verification_link: result.link,
            block_number: result.blockNumber || null,
            result_time: result.resultTime || new Date()
        });
        
        // 💰 CRYPTO RESULT LOGGER - Easy to identify new TRX_WIX results
        console.log('💰 [TRX_WIX_RESULT] New result generated and stored:', {
            periodId: periodId,
            result: result.result,
            hash: result.hash,
            link: result.link,
            blockNumber: result.blockNumber || 'NULL',
            resultTime: result.resultTime || 'DEFAULT',
            duration: duration,
            resultId: dbResult.result_id,
            timestamp: new Date().toISOString()
        });
        
        // Store result in Redis for history
        const historyKey = `trx_wix:${durationKey}:history`;
        await redisHelper.lpush(historyKey, JSON.stringify({
            periodId,
            result: result.result,
            verification: {
                hash: result.hash,
                link: result.link
            },
            timestamp: new Date().toISOString()
        }));
        
        // Keep only last 100 results in history
        await redisHelper.ltrim(historyKey, 0, 99);
        
    } catch (error) {
        logger.error('Error storing result:', error);
        throw error;
    }
};

/**
 * Check winners
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @param {Object} result - Result object
 * @returns {Promise<Array>} - Array of winners
 */
const checkWinners = async (duration, periodId, result) => {
    try {
        const winners = [];
        const bets = await BetRecordTrxWix.findAll({
            where: {
                period: periodId,
                status: 'pending'
            }
        });
        
        for (const bet of bets) {
            const [betType, betValue] = bet.bet_type.split(':');
            let isWinner = false;
            
            switch (betType) {
                case 'NUMBER':
                    isWinner = result.number === parseInt(betValue);
                    break;
                case 'COLOR':
                    isWinner = result.color === betValue;
                    break;
                case 'SIZE':
                    isWinner = result.size === betValue;
                    break;
                case 'PARITY':
                    const parity = result.number % 2 === 0 ? 'even' : 'odd';
                    isWinner = parity === betValue;
                    break;
            }
            
            if (isWinner) {
                const winAmount = bet.bet_amount * bet.odds;
                
                // Update user balance
                await User.increment('wallet_balance', {
                    by: winAmount,
                    where: { user_id: bet.user_id }
                });
                
                // Update bet status
                await bet.update({ status: 'won' });
                
                winners.push({
                    userId: bet.user_id,
                    betId: bet.bet_id,
                    winAmount
                });
            } else {
                await bet.update({ status: 'lost' });
            }
        }
        
        return winners;
    } catch (error) {
        logger.error('Error checking winners:', error);
        throw error;
    }
};

/**
 * End round and start new one
 * @param {number} duration - Duration in seconds
 * @param {string} periodId - Period ID
 * @returns {Promise<Object>} - Round end result
 */
const endRound = async (duration, periodId) => {
    try {
        // Use the main game logic service for ending round
        const result = await gameLogicService.endRound('trx_wix', duration, periodId);
        
        return {
            result: result.result,
            verification: result.verification,
            winners: result.winners
        };
    } catch (error) {
        logger.error('Error ending round:', error);
        throw error;
    }
};

// Export functions
module.exports = {
    processBet,
    calculateResultWithVerification: gameLogicService.calculateResultWithVerification,
    endRound
}; 
