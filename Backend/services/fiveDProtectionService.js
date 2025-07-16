const redisHelper = require('../config/redis');
const redisClient = redisHelper.getClient();
const { Op, fn } = require('sequelize');
const models = require('../models');

class FiveDProtectionService {
    constructor() {
        this.ENHANCED_USER_THRESHOLD = 3; // Same as gameLogicService
    }

    /**
     * Initialize zero-exposure candidates for a period
     * Called at period start
     */
    async initializeZeroExposureCandidates(gameType, duration, periodId, timeline) {
        try {
            console.log(`🔄 [5D_PROTECTION] Initializing zero-exposure candidates for period: ${periodId}`);
            
            const setKey = this.getZeroExposureSetKey(gameType, duration, periodId, timeline);
            
            // Load all combinations from database
            const GameCombinations5D = models.GameCombinations5D;
            const combinations = await GameCombinations5D.findAll({
                attributes: ['dice_a', 'dice_b', 'dice_c', 'dice_d', 'dice_e', 'sum_value', 'sum_size', 'sum_parity'],
                raw: true
            });

            console.log(`📊 [5D_PROTECTION] Loaded ${combinations.length} combinations from database`);

            // Convert to combination keys and add to Redis set
            const combinationKeys = combinations.map(combo => this.combinationToKey(combo));
            
            if (combinationKeys.length > 0) {
                await redisClient.sadd(setKey, ...combinationKeys);
                await redisClient.expire(setKey, 3600); // 1 hour TTL
                
                console.log(`✅ [5D_PROTECTION] Added ${combinationKeys.length} zero-exposure candidates to Redis set`);
            }

            return combinationKeys.length;
        } catch (error) {
            console.error('❌ [5D_PROTECTION] Error initializing zero-exposure candidates:', error);
            throw error;
        }
    }

    /**
     * Remove combination from zero-exposure set when bet is placed
     * Called when a bet is placed
     */
    async removeCombinationFromZeroExposure(gameType, duration, periodId, timeline, betType, betValue) {
        try {
            const setKey = this.getZeroExposureSetKey(gameType, duration, periodId, timeline);
            
            // Generate all combinations that would win for this bet
            const winningCombinations = this.getWinningCombinationsForBet(betType, betValue);
            
            // Remove all winning combinations from zero-exposure set
            if (winningCombinations.length > 0) {
                const removedCount = await redisClient.srem(setKey, ...winningCombinations);
                console.log(`🗑️ [5D_PROTECTION] Removed ${removedCount} combinations from zero-exposure set for bet: ${betType}:${betValue}`);
            }

            return winningCombinations.length;
        } catch (error) {
            console.error('❌ [5D_PROTECTION] Error removing combination from zero-exposure:', error);
            throw error;
        }
    }

    /**
     * Get protected result using deterministic selection based on period ID
     */
    async getProtectedResult(gameType, duration, periodId, timeline) {
        try {
            console.log(`🛡️ [5D_PROTECTION] Getting protected result for period: ${periodId}`);
            
            // Create deterministic seed from period ID
            const seed = this.generateSeedFromPeriodId(periodId);
            
            // 60/40 logic using deterministic selection
            const useZeroExposure = (seed % 100) < 60;
            
            if (useZeroExposure) {
                console.log('🎯 [5D_PROTECTION] Using zero-exposure selection (60%)');
                return await this.getZeroExposureResult(gameType, duration, periodId, timeline, seed);
            } else {
                console.log('🎲 [5D_PROTECTION] Using random selection (40%)');
                return await this.getRandomResult(gameType, duration, periodId, timeline, seed);
            }
        } catch (error) {
            console.error('❌ [5D_PROTECTION] Error getting protected result:', error);
            throw error;
        }
    }

    /**
     * Generate deterministic seed from period ID
     */
    generateSeedFromPeriodId(periodId) {
        let hash = 0;
        for (let i = 0; i < periodId.length; i++) {
            const char = periodId.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash);
    }

    /**
     * Get result with zero exposure using deterministic selection
     */
    async getZeroExposureResult(gameType, duration, periodId, timeline, seed) {
        try {
            const setKey = this.getZeroExposureSetKey(gameType, duration, periodId, timeline);
            
            // Get all remaining zero-exposure combinations
            const zeroExposureCombinations = await redisClient.smembers(setKey);
            
            if (zeroExposureCombinations.length === 0) {
                console.log('⚠️ [5D_PROTECTION] No zero-exposure combinations left, falling back to lowest exposure');
                return await this.getLowestExposureResult(gameType, duration, periodId, timeline, seed);
            }

            // Sort combinations for deterministic selection
            zeroExposureCombinations.sort();
            
            // Select deterministic combination from zero-exposure set
            const selectedIndex = seed % zeroExposureCombinations.length;
            const selectedKey = zeroExposureCombinations[selectedIndex];
            
            const result = this.keyToCombination(selectedKey);
            console.log(`✅ [5D_PROTECTION] Selected zero-exposure result:`, result);
            
            return result;
        } catch (error) {
            console.error('❌ [5D_PROTECTION] Error getting zero-exposure result:', error);
            throw error;
        }
    }

    /**
     * Get result with lowest exposure (fallback when no zero-exposure) using deterministic selection
     */
    async getLowestExposureResult(gameType, duration, periodId, timeline, seed) {
        try {
            console.log('🔍 [5D_PROTECTION] Finding lowest exposure result...');
            
            const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
            
            // Get all exposures
            const allExposures = await redisClient.hgetall(exposureKey);
            
            if (!allExposures || Object.keys(allExposures).length === 0) {
                console.log('⚠️ [5D_PROTECTION] No exposures found, using random result');
                return await this.getRandomResult(gameType, duration, periodId, timeline, seed);
            }

            // Find lowest exposure
            let lowestExposure = Infinity;
            let lowestExposureCombinations = [];

            for (const [key, exposureStr] of Object.entries(allExposures)) {
                const exposure = parseInt(exposureStr) || 0;
                
                if (exposure < lowestExposure) {
                    lowestExposure = exposure;
                    lowestExposureCombinations = [key];
                } else if (exposure === lowestExposure) {
                    lowestExposureCombinations.push(key);
                }
            }

            if (lowestExposureCombinations.length === 0) {
                console.log('⚠️ [5D_PROTECTION] No lowest exposure found, using random result');
                return await this.getRandomResult(gameType, duration, periodId, timeline, seed);
            }

            // Sort combinations for deterministic selection
            lowestExposureCombinations.sort();
            
            // Select deterministic from lowest exposure combinations
            const selectedIndex = seed % lowestExposureCombinations.length;
            const selectedKey = lowestExposureCombinations[selectedIndex];
            
            // Convert bet key to combination (this is simplified - you might need more complex logic)
            const result = this.betKeyToCombination(selectedKey);
            console.log(`✅ [5D_PROTECTION] Selected lowest exposure result (${lowestExposure}):`, result);
            
            return result;
        } catch (error) {
            console.error('❌ [5D_PROTECTION] Error getting lowest exposure result:', error);
            throw error;
        }
    }

    /**
     * Get completely random result (40% of the time) using deterministic selection
     */
    async getRandomResult(gameType, duration, periodId, timeline, seed) {
        try {
            // Get all combinations from database
            const GameCombinations5D = models.GameCombinations5D;
            const allCombinations = await GameCombinations5D.findAll({
                attributes: ['dice_a', 'dice_b', 'dice_c', 'dice_d', 'dice_e', 'sum_value', 'sum_size', 'sum_parity'],
                raw: true
            });

            if (!allCombinations || allCombinations.length === 0) {
                throw new Error('No combinations found in database');
            }

            // Select deterministic combination
            const selectedIndex = seed % allCombinations.length;
            const randomCombination = allCombinations[selectedIndex];

            console.log(`🎲 [5D_PROTECTION] Selected random result:`, randomCombination);
            return randomCombination;
        } catch (error) {
            console.error('❌ [5D_PROTECTION] Error getting random result:', error);
            throw error;
        }
    }

    /**
     * Get zero-exposure set key
     */
    getZeroExposureSetKey(gameType, duration, periodId, timeline) {
        return `zero_exposure:${gameType}:${duration}:${timeline}:${periodId}`;
    }

    /**
     * Convert combination to Redis key
     */
    combinationToKey(combination) {
        return `${combination.dice_a}_${combination.dice_b}_${combination.dice_c}_${combination.dice_d}_${combination.dice_e}`;
    }

    /**
     * Convert Redis key to combination
     */
    keyToCombination(key) {
        const [dice_a, dice_b, dice_c, dice_d, dice_e] = key.split('_').map(Number);
        const sum_value = dice_a + dice_b + dice_c + dice_d + dice_e;
        const sum_size = sum_value >= 23 ? 'big' : 'small';
        const sum_parity = sum_value % 2 === 0 ? 'even' : 'odd';
        
        return {
            dice_a, dice_b, dice_c, dice_d, dice_e,
            sum_value, sum_size, sum_parity
        };
    }

    /**
     * Get all combinations that would win for a specific bet
     */
    getWinningCombinationsForBet(betType, betValue) {
        const combinations = [];
        
        if (betType === 'POSITION') {
            // For position bets, generate all combinations where that position wins
            const [position, value] = betValue.split('_');
            const numValue = parseInt(value);
            
            // Generate all combinations where the specified position equals the value
            for (let a = 0; a <= 9; a++) {
                for (let b = 0; b <= 9; b++) {
                    for (let c = 0; c <= 9; c++) {
                        for (let d = 0; d <= 9; d++) {
                            for (let e = 0; e <= 9; e++) {
                                let diceValue;
                                switch (position) {
                                    case 'A': diceValue = a; break;
                                    case 'B': diceValue = b; break;
                                    case 'C': diceValue = c; break;
                                    case 'D': diceValue = d; break;
                                    case 'E': diceValue = e; break;
                                    default: continue;
                                }
                                
                                if (diceValue === numValue) {
                                    combinations.push(`${a}_${b}_${c}_${d}_${e}`);
                                }
                            }
                        }
                    }
                }
            }
        } else if (betType === 'SUM') {
            // For sum bets, generate all combinations with that sum
            const sumValue = parseInt(betValue);
            
            for (let a = 0; a <= 9; a++) {
                for (let b = 0; b <= 9; b++) {
                    for (let c = 0; c <= 9; c++) {
                        for (let d = 0; d <= 9; d++) {
                            for (let e = 0; e <= 9; e++) {
                                if (a + b + c + d + e === sumValue) {
                                    combinations.push(`${a}_${b}_${c}_${d}_${e}`);
                                }
                            }
                        }
                    }
                }
            }
        }
        
        return combinations;
    }

    /**
     * Convert bet key to combination (simplified)
     */
    betKeyToCombination(betKey) {
        // This is a simplified conversion - you might need more complex logic
        // based on your actual bet key format
        const [betType, betValue] = betKey.split(':');
        
        if (betType === 'bet' && betValue.startsWith('POSITION:')) {
            const position = betValue.split(':')[1];
            const [pos, value] = position.split('_');
            const numValue = parseInt(value);
            
            // Generate a random combination where this position equals the value
            const dice_a = pos === 'A' ? numValue : Math.floor(Math.random() * 10);
            const dice_b = pos === 'B' ? numValue : Math.floor(Math.random() * 10);
            const dice_c = pos === 'C' ? numValue : Math.floor(Math.random() * 10);
            const dice_d = pos === 'D' ? numValue : Math.floor(Math.random() * 10);
            const dice_e = pos === 'E' ? numValue : Math.floor(Math.random() * 10);
            
            const sum_value = dice_a + dice_b + dice_c + dice_d + dice_e;
            const sum_size = sum_value >= 23 ? 'big' : 'small';
            const sum_parity = sum_value % 2 === 0 ? 'even' : 'odd';
            
            return { dice_a, dice_b, dice_c, dice_d, dice_e, sum_value, sum_size, sum_parity };
        }
        
        // Fallback to random combination
        return this.getRandomResult();
    }

    /**
     * Check if the enhanced system is ready
     */
    async isSystemReady() {
        try {
            // Check if Redis is available
            const testKey = '5d_health_check';
            await redisClient.set(testKey, 'test', 'EX', 10);
            await redisClient.del(testKey);
            
            // Check if database connection is available
            const GameCombinations5D = models.GameCombinations5D;
            await GameCombinations5D.findOne({ limit: 1 });
            
            console.log('✅ [5D_PROTECTION] Enhanced system health check passed');
            return true;
        } catch (error) {
            console.log('❌ [5D_PROTECTION] Enhanced system health check failed:', error.message);
            return false;
        }
    }

    /**
     * Get statistics for debugging
     */
    async getProtectionStats(gameType, duration, periodId, timeline) {
        try {
            const setKey = this.getZeroExposureSetKey(gameType, duration, periodId, timeline);
            const exposureKey = `exposure:${gameType}:${duration}:${timeline}:${periodId}`;
            
            const zeroExposureCount = await redisClient.scard(setKey);
            const exposureCount = await redisClient.hlen(exposureKey);
            
            return {
                zeroExposureCount,
                exposureCount,
                totalCombinations: 100000,
                remainingZeroExposure: zeroExposureCount
            };
        } catch (error) {
            console.error('❌ [5D_PROTECTION] Error getting stats:', error);
            throw error;
        }
    }
}

module.exports = new FiveDProtectionService(); 