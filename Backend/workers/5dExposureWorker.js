const { parentPort, workerData } = require('worker_threads');
const unifiedRedis = require('../config/unifiedRedisManager');

/**
 * 🚀 5D Exposure Processing Worker Thread
 * This worker processes 50,000 combinations in parallel
 * Receives combinations and bet patterns, returns optimal result
 */

async function process5DExposureChunk(combinations, betPattern, duration, periodId, timeline) {
    try {
        console.log(`🔧 [5D_WORKER] Processing ${combinations.length} combinations...`);
        
        const startTime = Date.now();
        let lowestExposure = Infinity;
        let optimalCombination = null;
        let zeroExposureCombinations = [];
        
        // Process each combination in the chunk
        for (let i = 0; i < combinations.length; i++) {
            try {
                const combination = combinations[i];
                
                // Validate combination
                if (!combination || typeof combination !== 'string') {
                    console.warn(`⚠️ [5D_WORKER] Invalid combination at index ${i}:`, combination);
                    continue;
                }
                
                // Calculate exposure for this combination
                const exposure = calculateExposureForCombination(combination, betPattern);
                
                // Track zero exposure combinations
                if (exposure === 0) {
                    zeroExposureCombinations.push(extractCombinationString(combination));
                }
                
                // Track lowest exposure
                if (exposure < lowestExposure) {
                    lowestExposure = exposure;
                    optimalCombination = extractCombinationString(combination);
                }
                
                // Progress logging every 10,000 combinations
                if ((i + 1) % 25000 === 0) {
                    console.log(`📊 [5D_WORKER] Processed ${i + 1}/${combinations.length} combinations...`);
                }
            } catch (combinationError) {
                console.error(`❌ [5D_WORKER] Error processing combination at index ${i}:`, combinationError);
                console.error(`❌ [5D_WORKER] Combination data:`, combinations[i]);
                // Continue processing other combinations instead of failing completely
                continue;
            }
        }
        
        const endTime = Date.now();
        const processingTime = endTime - startTime;
        
        console.log(`✅ [5D_WORKER] Chunk processing completed in ${processingTime}ms`);
        console.log(`📊 [5D_WORKER] Results: lowest exposure = ${lowestExposure}, zero exposure count = ${zeroExposureCombinations.length}`);
        
        return {
            success: true,
            processingTime,
            lowestExposure,
            optimalCombination,
            zeroExposureCombinations,
            totalCombinations: combinations.length
        };
        
    } catch (error) {
        console.error(`❌ [5D_WORKER] Error processing chunk:`, error);
        return {
            success: false,
            error: error.message,
            processingTime: 0,
            lowestExposure: Infinity,
            optimalCombination: null,
            zeroExposureCombinations: [],
            totalCombinations: combinations.length
        };
    }
}

/**
 * Extract combination string from either JSON or string format
 */
function extractCombinationString(combination) {
    try {
        if (!combination || typeof combination !== 'string') {
            console.warn(`⚠️ [5D_WORKER] Invalid combination in extractCombinationString:`, combination);
            return '0,0,0,0,0'; // Return safe default
        }
        
        if (combination.startsWith('{')) {
            // It's a JSON object, extract dice values
            const parsed = JSON.parse(combination);
            if (parsed.dice_a !== undefined && parsed.dice_b !== undefined && 
                parsed.dice_c !== undefined && parsed.dice_d !== undefined && parsed.dice_e !== undefined) {
                return `${parsed.dice_a},${parsed.dice_b},${parsed.dice_c},${parsed.dice_d},${parsed.dice_e}`;
            } else {
                console.warn(`⚠️ [5D_WORKER] Invalid JSON structure in combination:`, combination);
                return '0,0,0,0,0'; // Return safe default
            }
        } else {
            // It's already a simple string
            return combination;
        }
    } catch (error) {
        console.error(`❌ [5D_WORKER] Error in extractCombinationString:`, error);
        console.error(`❌ [5D_WORKER] Combination that caused error:`, combination);
        return '0,0,0,0,0'; // Return safe default
    }
}

/**
 * Calculate exposure for a single combination against bet patterns
 */
function calculateExposureForCombination(combination, betPattern) {
    try {
        let totalExposure = 0;
        
        // Validate inputs
        if (!combination || typeof combination !== 'string') {
            console.warn(`⚠️ [5D_WORKER] Invalid combination in calculateExposureForCombination:`, combination);
            return Infinity;
        }
        
        if (!betPattern || typeof betPattern !== 'object') {
            console.warn(`⚠️ [5D_WORKER] Invalid betPattern in calculateExposureForCombination:`, betPattern);
            return Infinity;
        }
        
        // Parse combination - handle both JSON and string formats
        let numbers, sum, sumSize, sumParity;
        
        if (combination.startsWith('{')) {
            // It's a JSON object, parse it
            const parsed = JSON.parse(combination);
            if (parsed.dice_a !== undefined && parsed.dice_b !== undefined && 
                parsed.dice_c !== undefined && parsed.dice_d !== undefined && parsed.dice_e !== undefined) {
                numbers = [parsed.dice_a, parsed.dice_b, parsed.dice_c, parsed.dice_d, parsed.dice_e];
                sum = numbers.reduce((a, b) => a + b, 0);
                sumSize = sum < 22 ? 'small' : 'big';
                sumParity = sum % 2 === 0 ? 'even' : 'odd';
            } else {
                console.warn(`⚠️ [5D_WORKER] Invalid JSON structure in calculateExposureForCombination:`, combination);
                return Infinity;
            }
        } else {
            // It's a simple string like "1,2,3,4,5"
            numbers = combination.split(',').map(n => parseInt(n));
            if (numbers.length !== 5 || numbers.some(n => isNaN(n))) {
                console.warn(`⚠️ [5D_WORKER] Invalid combination format in calculateExposureForCombination:`, combination);
                return Infinity;
            }
            sum = numbers.reduce((a, b) => a + b, 0);
            sumSize = sum < 22 ? 'small' : 'big';
            sumParity = sum % 2 === 0 ? 'even' : 'odd';
        }
        
        // Calculate exposure for each bet type
        for (const [betKey, betAmount] of Object.entries(betPattern)) {
            try {
                let wins = false;
                
                // Validate bet key and amount
                if (!betKey || typeof betKey !== 'string') {
                    console.warn(`⚠️ [5D_WORKER] Invalid bet key:`, betKey);
                    continue;
                }
                
                const amount = parseInt(betAmount);
                if (isNaN(amount)) {
                    console.warn(`⚠️ [5D_WORKER] Invalid bet amount for key ${betKey}:`, betAmount);
                    continue;
                }
                
                // SUM_SIZE bets
                if (betKey.includes('SUM_SIZE')) {
                    if (betKey.includes('SUM_small') && sumSize === 'small') wins = true;
                    if (betKey.includes('SUM_big') && sumSize === 'big') wins = true;
                }
                
                // SUM_PARITY bets
                if (betKey.includes('SUM_PARITY')) {
                    if (betKey.includes('SUM_even') && sumParity === 'even') wins = true;
                    if (betKey.includes('SUM_odd') && sumParity === 'odd') wins = true;
                }
                
                // SUM_EXACT bets
                if (betKey.includes('SUM_EXACT')) {
                    const targetSum = parseInt(betKey.split(':')[1]);
                    if (!isNaN(targetSum) && sum === targetSum) wins = true;
                }
                
                // POSITION bets
                if (betKey.includes('POSITION')) {
                    const parts = betKey.split(':');
                    if (parts.length >= 3) {
                        const [position, type, value] = parts;
                        const positionIndex = position.charCodeAt(0) - 65; // A=0, B=1, etc.
                        
                        if (positionIndex >= 0 && positionIndex < 5) {
                            const positionValue = numbers[positionIndex];
                            
                            if (type === 'PARITY') {
                                if (value === 'even' && positionValue % 2 === 0) wins = true;
                                if (value === 'odd' && positionValue % 2 === 1) wins = true;
                            }
                            
                            if (type === 'SIZE') {
                                if (value === 'small' && positionValue < 5) wins = true;
                                if (value === 'big' && positionValue >= 5) wins = true;
                            }
                            
                            if (type === 'EXACT') {
                                const targetValue = parseInt(value);
                                if (!isNaN(targetValue) && positionValue === targetValue) wins = true;
                            }
                        }
                    }
                }
                
                // Add to total exposure if bet wins
                if (wins) {
                    totalExposure += amount;
                }
            } catch (betError) {
                console.error(`❌ [5D_WORKER] Error processing bet ${betKey}:`, betError);
                continue; // Skip this bet and continue with others
            }
        }
        
        return totalExposure;
        
    } catch (error) {
        console.error(`❌ [5D_WORKER] Error calculating exposure for combination ${combination}:`, error);
        return Infinity; // Return high exposure on error
    }
}

/**
 * Main worker thread handler
 */
async function handleWorkerMessage() {
    try {
        // Get worker data
        const { combinations, betPattern, duration, periodId, timeline, workerId } = workerData;
        
        console.log(`🚀 [5D_WORKER_${workerId}] Starting worker with ${combinations.length} combinations`);
        
        // Process the chunk
        const result = await process5DExposureChunk(combinations, betPattern, duration, periodId, timeline);
        
        // Send result back to main thread
        parentPort.postMessage({
            workerId,
            success: true,
            result
        });
        
    } catch (error) {
        console.error(`❌ [5D_WORKER] Worker error:`, error);
        
        // Send error back to main thread
        parentPort.postMessage({
            workerId: workerData.workerId,
            success: false,
            error: error.message
        });
    }
}

// Start the worker when this file is executed as a worker thread
if (parentPort) {
    // Add global error handlers
    process.on('uncaughtException', (error) => {
        console.error(`❌ [5D_WORKER] Uncaught Exception:`, error);
        parentPort.postMessage({
            workerId: workerData?.workerId || 'unknown',
            success: false,
            error: `Uncaught Exception: ${error.message}`
        });
        process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error(`❌ [5D_WORKER] Unhandled Rejection at:`, promise, 'reason:', reason);
        parentPort.postMessage({
            workerId: workerData?.workerId || 'unknown',
            success: false,
            error: `Unhandled Rejection: ${reason}`
        });
        process.exit(1);
    });

    handleWorkerMessage().catch((error) => {
        console.error(`❌ [5D_WORKER] Top-level error:`, error);
        parentPort.postMessage({
            workerId: workerData?.workerId || 'unknown',
            success: false,
            error: `Top-level error: ${error.message}`
        });
        process.exit(1);
    });
}

module.exports = {
    process5DExposureChunk,
    calculateExposureForCombination
}; 