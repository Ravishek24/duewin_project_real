const redisHelper = require('../config/redis');
const redisClient = redisHelper.getClient();
const { Op, fn } = require('sequelize');
const models = require('../models');

class FiveDProtectionService {
    constructor() {
        this.ENHANCED_USER_THRESHOLD = 2; // Same as gameLogicService
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
            
            if (!zeroExposureCombinations || zeroExposureCombinations.length === 0) {
                console.log('⚠️ [5D_PROTECTION] No zero-exposure combinations left, falling back to lowest exposure');
                return await this.getLowestExposureResult(gameType, duration, periodId, timeline, seed);
            }

            // Filter out any invalid keys
            const validCombinations = zeroExposureCombinations.filter(key => 
                key && typeof key === 'string' && key.includes('_')
            );
            
            if (validCombinations.length === 0) {
                console.log('⚠️ [5D_PROTECTION] No valid zero-exposure combinations left, falling back to lowest exposure');
                return await this.getLowestExposureResult(gameType, duration, periodId, timeline, seed);
            }

            // Sort combinations for deterministic selection
            validCombinations.sort();
            
            // Select deterministic combination from zero-exposure set
            const selectedIndex = seed % validCombinations.length;
            const selectedKey = validCombinations[selectedIndex];
            
            if (!selectedKey) {
                console.log('⚠️ [5D_PROTECTION] Selected key is undefined, falling back to lowest exposure');
                return await this.getLowestExposureResult(gameType, duration, periodId, timeline, seed);
            }
            
            const combo = this.keyToCombination(selectedKey);
            
            // FIXED: Properly format the result for frontend consistency
            const result = {
                A: combo.dice_a,
                B: combo.dice_b,
                C: combo.dice_c,
                D: combo.dice_d,
                E: combo.dice_e,
                sum: combo.sum_value,
                dice_value: parseInt(`${combo.dice_a}${combo.dice_b}${combo.dice_c}${combo.dice_d}${combo.dice_e}`),
                sum_size: combo.sum_size,
                sum_parity: combo.sum_parity
            };
            
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

            // Get all combinations from database to calculate exposure for each
            const GameCombinations5D = models.GameCombinations5D;
            const allCombinations = await GameCombinations5D.findAll({
                attributes: ['dice_a', 'dice_b', 'dice_c', 'dice_d', 'dice_e', 'sum_value', 'sum_size', 'sum_parity', 'winning_conditions'],
                raw: true
                // REMOVED LIMIT - CHECK ALL 100,000 COMBINATIONS FOR OPTIMAL RESULT
            });

            console.log(`🔍 [5D_PROTECTION] Calculating exposure for ${allCombinations.length} combinations...`);

            // Calculate exposure for each combination
            let lowestExposure = Infinity;
            let lowestExposureCombinations = [];

            for (const combo of allCombinations) {
                // Calculate total exposure for this combination
                let totalExposure = 0;
                
                // Parse winning conditions
                let winningConditions;
                try {
                    winningConditions = typeof combo.winning_conditions === 'string' 
                        ? JSON.parse(combo.winning_conditions) 
                        : combo.winning_conditions;
                } catch (error) {
                    console.log('⚠️ [5D_PROTECTION] Error parsing winning conditions, skipping combination');
                    continue;
                }

                // Check each bet against this combination
                for (const [betKey, exposureStr] of Object.entries(allExposures)) {
                    if (!betKey.startsWith('bet:')) continue;
                    
                    const actualBetKey = betKey.replace('bet:', '');
                    const [betType, betValue] = actualBetKey.split(':');
                    
                    // Check if this combination wins for this bet
                    let wins = false;
                    
                    if (betType === 'POSITION') {
                        const [position, value] = betValue.split('_');
                        const numValue = parseInt(value);
                        const comboValue = combo[`dice_${position.toLowerCase()}`];
                        wins = comboValue === numValue;
                    } else if (betType === 'SUM_PARITY') {
                        const isEven = combo.sum_value % 2 === 0;
                        wins = (betValue === 'even' && isEven) || (betValue === 'odd' && !isEven);
                    } else if (betType === 'SUM_SIZE') {
                        const isBig = combo.sum_value >= 22; // FIXED: Use >= 22 for consistency with database
                        wins = (betValue === 'big' && isBig) || (betValue === 'small' && !isBig);
                    } else if (betType === 'SUM') {
                        wins = combo.sum_value === parseInt(betValue);
                    }
                    
                    if (wins) {
                        totalExposure += parseInt(exposureStr) || 0;
                    }
                }
                
                // Track lowest exposure combinations
                if (totalExposure < lowestExposure) {
                    lowestExposure = totalExposure;
                    lowestExposureCombinations = [combo];
                } else if (totalExposure === lowestExposure) {
                    lowestExposureCombinations.push(combo);
                }
            }

            if (lowestExposureCombinations.length === 0) {
                console.log('⚠️ [5D_PROTECTION] No lowest exposure found, using random result');
                return await this.getRandomResult(gameType, duration, periodId, timeline, seed);
            }

            // Sort combinations for deterministic selection
            lowestExposureCombinations.sort((a, b) => {
                const keyA = this.combinationToKey(a);
                const keyB = this.combinationToKey(b);
                return keyA.localeCompare(keyB);
            });
            
            // Select deterministic from lowest exposure combinations
            const selectedIndex = seed % lowestExposureCombinations.length;
            const selectedCombo = lowestExposureCombinations[selectedIndex];
            
            // FIXED: Properly format the result for frontend consistency
            const result = {
                A: selectedCombo.dice_a,
                B: selectedCombo.dice_b,
                C: selectedCombo.dice_c,
                D: selectedCombo.dice_d,
                E: selectedCombo.dice_e,
                sum: selectedCombo.sum_value,
                dice_value: selectedCombo.dice_value || parseInt(`${selectedCombo.dice_a}${selectedCombo.dice_b}${selectedCombo.dice_c}${selectedCombo.dice_d}${selectedCombo.dice_e}`),
                sum_size: selectedCombo.sum_size,
                sum_parity: selectedCombo.sum_parity
            };
            
            console.log(`✅ [5D_PROTECTION] Selected lowest exposure result (${lowestExposure} cents):`, result);
            
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

            // FIXED: Properly format the result for frontend consistency
            const result = {
                A: randomCombination.dice_a,
                B: randomCombination.dice_b,
                C: randomCombination.dice_c,
                D: randomCombination.dice_d,
                E: randomCombination.dice_e,
                sum: randomCombination.sum_value,
                dice_value: parseInt(`${randomCombination.dice_a}${randomCombination.dice_b}${randomCombination.dice_c}${randomCombination.dice_d}${randomCombination.dice_e}`),
                sum_size: randomCombination.sum_size,
                sum_parity: randomCombination.sum_parity
            };

            console.log(`🎲 [5D_PROTECTION] Selected random result:`, result);
            return result;
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
        if (!key || typeof key !== 'string') {
            throw new Error(`Invalid key provided to keyToCombination: ${key}`);
        }
        
        const parts = key.split('_');
        if (parts.length !== 5) {
            throw new Error(`Invalid key format: ${key}. Expected format: dice_a_dice_b_dice_c_dice_d_dice_e`);
        }
        
        const [dice_a, dice_b, dice_c, dice_d, dice_e] = parts.map(Number);
        
        // Validate that all values are valid numbers
        if ([dice_a, dice_b, dice_c, dice_d, dice_e].some(val => isNaN(val) || val < 0 || val > 9)) {
            throw new Error(`Invalid dice values in key: ${key}`);
        }
        
        const sum_value = dice_a + dice_b + dice_c + dice_d + dice_e;
        const sum_size = sum_value >= 22 ? 'big' : 'small'; // FIXED: Use >= 22 for consistency with database
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
        } else if (betType === 'SUM_PARITY') {
            // For sum parity bets, generate all combinations with that parity
            const isEven = betValue === 'even';
            
            for (let a = 0; a <= 9; a++) {
                for (let b = 0; b <= 9; b++) {
                    for (let c = 0; c <= 9; c++) {
                        for (let d = 0; d <= 9; d++) {
                            for (let e = 0; e <= 9; e++) {
                                const sum = a + b + c + d + e;
                                const comboIsEven = sum % 2 === 0;
                                if (comboIsEven === isEven) {
                                    combinations.push(`${a}_${b}_${c}_${d}_${e}`);
                                }
                            }
                        }
                    }
                }
            }
        } else if (betType === 'SUM_SIZE') {
            // For sum size bets, generate all combinations with that size
            const isBig = betValue === 'big';
            
            for (let a = 0; a <= 9; a++) {
                for (let b = 0; b <= 9; b++) {
                    for (let c = 0; c <= 9; c++) {
                        for (let d = 0; d <= 9; d++) {
                            for (let e = 0; e <= 9; e++) {
                                const sum = a + b + c + d + e;
                                const comboIsBig = sum >= 22; // FIXED: Use >= 22 for consistency with database
                                if (comboIsBig === isBig) {
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
            const sum_size = sum_value >= 22 ? 'big' : 'small'; // FIXED: Use >= 22 for consistency with database
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