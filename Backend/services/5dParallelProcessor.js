const { Worker } = require('worker_threads');
const path = require('path');
const unifiedRedis = require('../config/unifiedRedisManager');

/**
 * 🚀 5D Parallel Processing Service
 * Coordinates worker threads for ultra-fast exposure calculation
 * Splits 100,000 combinations into 2 chunks of 50,000 each
 */

class FiveDParallelProcessor {
    constructor() {
        this.workerPath = path.join(__dirname, '../workers/5dExposureWorker.js');
        this.maxWorkers = 2; // 2 workers for 50,000 combinations each
        this.timeoutMs = 30000; // 30 second timeout
    }

    /**
     * Get optimal 5D result using parallel processing
     */
    async getOptimal5DResultParallel(duration, periodId, timeline) {
        try {
            console.log(`🚀 [5D_PARALLEL] Starting parallel processing for period ${periodId}`);
            
            const startTime = Date.now();
            
            // Step 1: Get all combinations and bet patterns
            const { combinations, betPattern } = await this.getProcessingData(duration, periodId, timeline);
            
            if (!combinations || combinations.length === 0) {
                throw new Error('No combinations available for processing');
            }
            
            console.log(`📊 [5D_PARALLEL] Processing ${combinations.length} combinations with ${Object.keys(betPattern).length} bet types`);
            
                         // 🚀 OPTIMIZATION: Early exit if no bets (all combinations will have zero exposure)
             if (!betPattern || Object.keys(betPattern).length === 0) {
                 console.log(`🚀 [5D_PARALLEL] No bets found - using instant zero exposure result`);
                 
                 // Return a random combination instantly (all have zero exposure)
                 const randomIndex = Math.floor(Math.random() * combinations.length);
                 const randomCombination = combinations[randomIndex];
                 
                 // Parse the combination string (format: "1,2,3,4,5")
                 const numbers = randomCombination.split(',').map(n => parseInt(n));
                 const sum = numbers.reduce((a, b) => a + b, 0);
                 const sumSize = sum < 22 ? 'small' : 'big';
                 const sumParity = sum % 2 === 0 ? 'even' : 'odd';
                 
                 const totalTime = Date.now() - startTime;
                 console.log(`✅ [5D_PARALLEL] Instant zero-exposure result in ${totalTime}ms`);
                 console.log(`📊 [5D_PARALLEL] Selected combination:`, {
                     A: numbers[0],
                     B: numbers[1],
                     C: numbers[2],
                     D: numbers[3],
                     E: numbers[4],
                     sum: sum,
                     sum_size: sumSize,
                     sum_parity: sumParity,
                     exposure: 0,
                     method: 'parallel_instant_zero'
                 });
                 
                 return {
                     A: numbers[0],
                     B: numbers[1],
                     C: numbers[2],
                     D: numbers[3],
                     E: numbers[4],
                     sum: sum,
                     sum_size: sumSize,
                     sum_parity: sumParity,
                     exposure: 0,
                     combination: randomCombination,
                     processingTime: totalTime,
                     totalCombinations: combinations.length,
                     zeroExposureCount: combinations.length,
                     method: 'parallel_instant_zero'
                 };
             }
            
            // Step 2: Split combinations into chunks
            const chunks = this.splitCombinationsIntoChunks(combinations);
            
            // Step 3: Process chunks in parallel
            const results = await this.processChunksInParallel(chunks, betPattern, duration, periodId, timeline);
            
            // Step 4: Aggregate results
            const optimalResult = this.aggregateResults(results);
            
            const totalTime = Date.now() - startTime;
            
            console.log(`✅ [5D_PARALLEL] Parallel processing completed in ${totalTime}ms`);
            console.log(`📊 [5D_PARALLEL] Final result: exposure = ${optimalResult.exposure}, combination = ${optimalResult.combination}`);
            
            return optimalResult;
            
        } catch (error) {
            console.error(`❌ [5D_PARALLEL] Error in parallel processing:`, error);
            throw error;
        }
    }

    /**
     * Get combinations and bet patterns from Redis
     */
    async getProcessingData(duration, periodId, timeline) {
        try {
            // Initialize UnifiedRedisManager if not already initialized
            if (!unifiedRedis.isInitialized) {
                await unifiedRedis.initialize();
            }
            
            const redis = unifiedRedis.getHelper();
            
            // Get combinations from Redis (using the correct key pattern from preload function)
            const combinationsKey = '5d_combinations_cache';
            console.log(`🔍 [5D_PARALLEL] Looking for combinations in Redis key: ${combinationsKey}`);
            const combinationsData = await redis.hgetall(combinationsKey);
            
            console.log(`📊 [5D_PARALLEL] Found ${Object.keys(combinationsData || {}).length} combinations in Redis`);
            
            if (!combinationsData || Object.keys(combinationsData).length === 0) {
                console.log(`⚠️ [5D_PARALLEL] No combinations found, trying to initialize...`);
                
                // Try to initialize combinations if not found
                try {
                    const { preload5DCombinationsToRedis } = require('./gameLogicService');
                    await preload5DCombinationsToRedis();
                    
                    // Try again after initialization
                    const retryData = await redis.hgetall(combinationsKey);
                    if (!retryData || Object.keys(retryData).length === 0) {
                        throw new Error('Failed to initialize combinations in Redis');
                    }
                    
                    console.log(`✅ [5D_PARALLEL] Successfully initialized ${Object.keys(retryData).length} combinations`);
                    combinationsData = retryData;
                    
                } catch (initError) {
                    console.error(`❌ [5D_PARALLEL] Failed to initialize combinations:`, initError.message);
                    throw new Error('No combinations available for processing');
                }
            }
            
            // Convert to array of combinations
            const combinations = Object.keys(combinationsData).map(key => {
                const combo = combinationsData[key];
                if (typeof combo === 'string') {
                    return combo;
                } else {
                    // If it's a JSON object, extract the combination string
                    const parsed = JSON.parse(combo);
                    if (parsed.dice_a !== undefined && parsed.dice_b !== undefined) {
                        // It's a full result object, extract the combination string
                        return `${parsed.dice_a},${parsed.dice_b},${parsed.dice_c},${parsed.dice_d},${parsed.dice_e}`;
                    } else {
                        // It's some other format, try to convert to string
                        return combo.toString();
                    }
                }
            });
            
            console.log(`📊 [5D_PARALLEL] Converted ${combinations.length} combinations for processing`);
            console.log(`📊 [5D_PARALLEL] Sample combinations:`, combinations.slice(0, 3));
            
            // Get bet patterns from Redis
            const exposureKey = `exposure:fiveD:${duration}:${timeline}:${periodId}`;
            console.log(`🔍 [5D_PARALLEL] Looking for bet patterns in Redis key: ${exposureKey}`);
            const betPattern = await redis.hgetall(exposureKey);
            
            console.log(`📊 [5D_PARALLEL] Found ${Object.keys(betPattern || {}).length} bet patterns`);
            
            if (!betPattern || Object.keys(betPattern).length === 0) {
                console.log(`⚠️ [5D_PARALLEL] No bet patterns found, using empty pattern`);
                return { combinations, betPattern: {} };
            }
            
            return { combinations, betPattern };
            
        } catch (error) {
            console.error(`❌ [5D_PARALLEL] Error getting processing data:`, error);
            throw error;
        }
    }

    /**
     * Split combinations into chunks for parallel processing
     */
    splitCombinationsIntoChunks(combinations) {
        const chunkSize = Math.ceil(combinations.length / this.maxWorkers);
        const chunks = [];
        
        for (let i = 0; i < this.maxWorkers; i++) {
            const startIndex = i * chunkSize;
            const endIndex = Math.min(startIndex + chunkSize, combinations.length);
            const chunk = combinations.slice(startIndex, endIndex);
            
            if (chunk.length > 0) {
                chunks.push(chunk);
            }
        }
        
        console.log(`📊 [5D_PARALLEL] Split ${combinations.length} combinations into ${chunks.length} chunks`);
        chunks.forEach((chunk, index) => {
            console.log(`   Chunk ${index + 1}: ${chunk.length} combinations`);
        });
        
        return chunks;
    }

    /**
     * Process chunks in parallel using worker threads
     */
    async processChunksInParallel(chunks, betPattern, duration, periodId, timeline) {
        try {
            const workerPromises = chunks.map((chunk, index) => {
                return this.processChunkWithWorker(chunk, betPattern, duration, periodId, timeline, index + 1);
            });
            
            console.log(`🚀 [5D_PARALLEL] Starting ${workerPromises.length} worker threads...`);
            
            // Wait for all workers to complete
            const results = await Promise.all(workerPromises);
            
            console.log(`✅ [5D_PARALLEL] All ${results.length} workers completed`);
            
            return results;
            
        } catch (error) {
            console.error(`❌ [5D_PARALLEL] Error in parallel processing:`, error);
            throw error;
        }
    }

    /**
     * Process a single chunk using a worker thread
     */
    async processChunkWithWorker(chunk, betPattern, duration, periodId, timeline, workerId) {
        return new Promise((resolve, reject) => {
            try {
                console.log(`🚀 [5D_PARALLEL] Starting worker ${workerId} with ${chunk.length} combinations`);
                
                // Create worker thread
                const worker = new Worker(this.workerPath, {
                    workerData: {
                        combinations: chunk,
                        betPattern,
                        duration,
                        periodId,
                        timeline,
                        workerId
                    }
                });
                
                // Set timeout
                const timeout = setTimeout(() => {
                    console.error(`⏰ [5D_PARALLEL] Worker ${workerId} timed out after ${this.timeoutMs}ms`);
                    worker.terminate();
                    reject(new Error(`Worker ${workerId} timed out`));
                }, this.timeoutMs);
                
                // Handle worker messages
                worker.on('message', (message) => {
                    clearTimeout(timeout);
                    
                    if (message.success) {
                        console.log(`✅ [5D_PARALLEL] Worker ${workerId} completed successfully in ${message.result.processingTime}ms`);
                        resolve(message.result);
                    } else {
                        console.error(`❌ [5D_PARALLEL] Worker ${workerId} failed:`, message.error);
                        reject(new Error(`Worker ${workerId} failed: ${message.error}`));
                    }
                    
                    worker.terminate();
                });
                
                // Handle worker errors
                worker.on('error', (error) => {
                    clearTimeout(timeout);
                    console.error(`❌ [5D_PARALLEL] Worker ${workerId} error:`, error);
                    reject(error);
                    worker.terminate();
                });
                
                // Handle worker exit
                worker.on('exit', (code) => {
                    clearTimeout(timeout);
                    if (code !== 0) {
                        console.error(`❌ [5D_PARALLEL] Worker ${workerId} exited with code ${code}`);
                        reject(new Error(`Worker ${workerId} exited with code ${code}`));
                    }
                });
                
            } catch (error) {
                console.error(`❌ [5D_PARALLEL] Error creating worker ${workerId}:`, error);
                reject(error);
            }
        });
    }

    /**
     * Aggregate results from all workers to find optimal result
     */
    aggregateResults(workerResults) {
        try {
            console.log(`🔄 [5D_PARALLEL] Aggregating results from ${workerResults.length} workers...`);
            
            let globalLowestExposure = Infinity;
            let globalOptimalCombination = null;
            let globalZeroExposureCombinations = [];
            let totalProcessingTime = 0;
            let totalCombinations = 0;
            
            // Process each worker result
            for (const result of workerResults) {
                if (!result.success) {
                    console.error(`❌ [5D_PARALLEL] Worker result failed:`, result.error);
                    continue;
                }
                
                totalProcessingTime += result.processingTime;
                totalCombinations += result.totalCombinations;
                
                // Track lowest exposure across all workers
                if (result.lowestExposure < globalLowestExposure) {
                    globalLowestExposure = result.lowestExposure;
                    globalOptimalCombination = result.optimalCombination;
                }
                
                // Collect zero exposure combinations
                globalZeroExposureCombinations.push(...result.zeroExposureCombinations);
            }
            
            // If we found zero exposure combinations, randomly select one
            if (globalZeroExposureCombinations.length > 0) {
                const randomIndex = Math.floor(Math.random() * globalZeroExposureCombinations.length);
                globalOptimalCombination = globalZeroExposureCombinations[randomIndex];
                globalLowestExposure = 0;
            }
            
            console.log(`📊 [5D_PARALLEL] Aggregation results:`);
            console.log(`   - Total combinations processed: ${totalCombinations}`);
            console.log(`   - Total processing time: ${totalProcessingTime}ms`);
            console.log(`   - Zero exposure combinations found: ${globalZeroExposureCombinations.length}`);
            console.log(`   - Optimal exposure: ${globalLowestExposure}`);
            console.log(`   - Optimal combination: ${globalOptimalCombination}`);
            
            // 🎯 DETAILED LOGGING: Show the final chosen result
            console.log(`🎯 [5D_PARALLEL] FINAL CHOSEN RESULT:`);
            console.log(`   - Raw combination string: ${globalOptimalCombination}`);
            console.log(`   - Zero exposure combinations available: ${globalZeroExposureCombinations.length}`);
            console.log(`   - Was zero exposure selected: ${globalZeroExposureCombinations.length > 0 ? 'YES' : 'NO'}`);
            if (globalZeroExposureCombinations.length > 0) {
                console.log(`   - Random zero exposure index: ${Math.floor(Math.random() * globalZeroExposureCombinations.length)}`);
            }
            
            // Parse the optimal combination
            if (!globalOptimalCombination) {
                console.error(`❌ [5D_PARALLEL] No optimal combination found! This should not happen.`);
                throw new Error('No optimal combination found in parallel processing');
            }
            
            const numbers = globalOptimalCombination.split(',').map(n => parseInt(n));
            const sum = numbers.reduce((a, b) => a + b, 0);
            const sumSize = sum < 22 ? 'small' : 'big';
            const sumParity = sum % 2 === 0 ? 'even' : 'odd';
            
            // 🎯 DETAILED LOGGING: Show the parsed final result
            console.log(`🎯 [5D_PARALLEL] PARSED FINAL RESULT:`);
            console.log(`   - Numbers: [${numbers.join(', ')}]`);
            console.log(`   - Sum: ${sum} (${sumSize}, ${sumParity})`);
            console.log(`   - Exposure: ${globalLowestExposure}`);
            console.log(`   - Method: parallel_worker_threads`);
            console.log(`   - Processing time: ${totalProcessingTime}ms`);
            console.log(`   - Total combinations: ${totalCombinations}`);
            console.log(`   - Zero exposure count: ${globalZeroExposureCombinations.length}`);
            
            return {
                A: numbers[0],
                B: numbers[1],
                C: numbers[2],
                D: numbers[3],
                E: numbers[4],
                sum,
                sum_size: sumSize,
                sum_parity: sumParity,
                exposure: globalLowestExposure,
                combination: globalOptimalCombination,
                processingTime: totalProcessingTime,
                totalCombinations,
                zeroExposureCount: globalZeroExposureCombinations.length,
                method: 'parallel_worker_threads'
            };
            
        } catch (error) {
            console.error(`❌ [5D_PARALLEL] Error aggregating results:`, error);
            throw error;
        }
    }

    /**
     * Fallback to sequential processing if parallel processing fails
     */
    async fallbackToSequential(duration, periodId, timeline) {
        try {
            console.log(`🔄 [5D_PARALLEL] Falling back to sequential processing...`);
            
            // Import the original sequential method
            const { getOptimal5DResultByExposureSortedSet } = require('./5dSortedSetService');
            
            const result = await getOptimal5DResultByExposureSortedSet(duration, periodId, timeline);
            
            console.log(`✅ [5D_PARALLEL] Sequential fallback completed`);
            
            return {
                ...result,
                method: 'sequential_fallback'
            };
            
        } catch (error) {
            console.error(`❌ [5D_PARALLEL] Sequential fallback also failed:`, error);
            throw error;
        }
    }
}

// Create singleton instance
const fiveDParallelProcessor = new FiveDParallelProcessor();

module.exports = {
    FiveDParallelProcessor,
    fiveDParallelProcessor,
    getOptimal5DResultParallel: (duration, periodId, timeline) => 
        fiveDParallelProcessor.getOptimal5DResultParallel(duration, periodId, timeline)
}; 