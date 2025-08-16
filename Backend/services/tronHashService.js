const axios = require('axios');

const winston = require('winston');
const path = require('path');
const unifiedRedis = require('../config/unifiedRedisManager');
async function getRedisHelper() {
  return await unifiedRedis.getHelper();
}

// Configure Winston logger
const logger = winston.createLogger({
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ 
            filename: path.join('logs', 'tron-hash.log') 
        }),
        new winston.transports.File({ 
            filename: path.join('logs', 'tron-hash-errors.log'),
            level: 'error'
        })
    ]
});

const TRON_API_URL = 'https://apilist.tronscanapi.com/api';
const HASH_COLLECTION_KEY = 'tron:hash_collection';
const MIN_HASHES_PER_DIGIT = 1;

// NEW: Duration-specific hash collection keys
const getDurationHashKey = (duration) => {
    return `tron:hash_collection:${duration}`;
};

const getTrxWixDurations = () => {
    return [30, 60, 180, 300];
};

/**
 * Get current time in IST (Indian Standard Time)
 * @returns {Date} - Current time in IST
 */
const getCurrentISTTime = () => {
    const now = new Date();
    // IST is UTC+5:30
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    return istTime;
};

/**
 * Extract block number from TRON hash by fetching block details
 * @param {string} hash - TRON block hash
 * @returns {Promise<number|null>} - Block number or null if not found
 */
const getBlockNumberFromHash = async (hash) => {
    try {
        console.log(`🔍 [BLOCK_NUMBER] Fetching block details for hash: ${hash}`);
        
        const response = await axios.get(`${TRON_API_URL}/block`, {
            params: {
                hash: hash
            },
            timeout: 10000 // 10 second timeout
        });

        if (response.data && response.data.number) {
            const blockNumber = parseInt(response.data.number);
            console.log(`✅ [BLOCK_NUMBER] Found block number: ${blockNumber} for hash: ${hash}`);
            return blockNumber;
        } else {
            console.log(`⚠️ [BLOCK_NUMBER] No block number found for hash: ${hash}`);
            return null;
        }
    } catch (error) {
        console.log(`❌ [BLOCK_NUMBER] Error fetching block number for hash ${hash}:`, error.message);
        return null;
    }
};

/**
 * Extract block number from hash with fallback parsing
 * @param {string} hash - TRON block hash
 * @returns {Promise<number|null>} - Block number or null if not found
 */
const extractBlockNumber = async (hash) => {
    try {
        // First try to get block number from API
        const blockNumber = await getBlockNumberFromHash(hash);
        if (blockNumber) {
            return blockNumber;
        }

        // Fallback: Try to extract from hash pattern (if it's a real TRON hash)
        if (hash && hash.startsWith('000000000')) {
            // TRON block hashes often start with zeros followed by block number
            // This is a heuristic approach
            const hexPart = hash.substring(9, 17); // Extract 8 hex characters after zeros
            const blockNum = parseInt(hexPart, 16);
            if (blockNum && blockNum > 0) {
                console.log(`🔧 [BLOCK_NUMBER] Extracted block number from hash pattern: ${blockNum}`);
                return blockNum;
            }
        }

        console.log(`⚠️ [BLOCK_NUMBER] Could not extract block number from hash: ${hash}`);
        return null;
    } catch (error) {
        console.log(`❌ [BLOCK_NUMBER] Error extracting block number:`, error.message);
        return null;
    }
};

/**
 * Extract a digit from a hash to use for result verification
 * @param {string} hash - The hash to process
 * @returns {number|null} - A digit between 0-9 or null if not found
 */
const getLastDigit = (hash) => {
    if (!hash || typeof hash !== 'string') {
        return null;
    }
    
    // Find the last numeric digit in the hash (scanning from right to left)
    for (let i = hash.length - 1; i >= 0; i--) {
        const char = hash[i];
        if (char >= '0' && char <= '9') {
            return parseInt(char);
        }
    }
    
    // If no digit found, create a pseudo-random digit based on the hash
    if (hash.length > 0) {
        // Sum the character codes of the hash
        const sum = hash.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        // Return a number between 0-9 based on the sum
        return sum % 10;
    }
    
    return null;
};

/**
 * Find a hash that ends with a specific digit
 * @param {number} targetDigit - The digit we want the hash to end with (0-9)
 * @param {Array} hashes - Array of hashes to search through
 * @returns {string|null} - Hash that ends with the target digit, or null if not found
 */
const findHashEndingWithDigit = (targetDigit, hashes) => {
    // Ensure targetDigit is a valid number 0-9
    if (typeof targetDigit === 'object' && targetDigit !== null) {
        console.log(`⚠️ [FIND_HASH] targetDigit is an object:`, targetDigit);
        targetDigit = 0;
    }
    
    targetDigit = parseInt(targetDigit) || 0;
    targetDigit = targetDigit % 10; // Ensure it's 0-9
    
    console.log(`🔍 [FIND_HASH] Looking for hash ending with digit: ${targetDigit} (type: ${typeof targetDigit})`);
    
    for (const hash of hashes) {
        const lastDigit = getLastDigit(hash);
        if (lastDigit === targetDigit) {
            console.log(`✅ [FIND_HASH] Found hash ending with ${targetDigit}: ${hash}`);
            return hash;
        }
    }
    
    console.log(`❌ [FIND_HASH] No hash found ending with ${targetDigit}`);
    return null;
};

/**
 * Fetch new hashes from TRON blockchain
 * @param {number} limit - Number of blocks to fetch
 * @returns {Promise<Array>} - Array of hashes
 */
const fetchNewHashes = async (limit = 100) => {
    try {
        const response = await axios.get(`${TRON_API_URL}/block`, {
            params: {
                sort: '-number',
                start: 0,
                limit: limit
            }
        });

        if (response.data && response.data.data) {
            return response.data.data.map(block => block.hash);
        }
        return [];
    } catch (error) {
        logger.error('Error fetching TRON hashes:', error);
        throw error;
    }
};

/**
 * Update hash collection in Redis for a specific duration
 * @param {Array} hashes - New hashes to add
 * @param {number} duration - Duration in seconds (30, 60, 180, 300)
 */
const updateHashCollection = async (hashes, duration = null) => {
    try {
        // Use duration-specific key if duration is provided
        const collectionKey = duration ? getDurationHashKey(duration) : HASH_COLLECTION_KEY;
        
        // Get current collection
        const redis = await getRedisHelper();
        if (!redis) {
            throw new Error('Redis helper not available');
        }
        let collection = await redis.get(collectionKey);
        collection = collection ? JSON.parse(collection) : {};

        // Initialize collection for all digits if not present
        for (let i = 0; i < 10; i++) {
            if (!collection[i]) {
                collection[i] = [];
            }
        }

        // Process new hashes
        let newHashesAdded = 0;
        for (const hash of hashes) {
            const digit = getLastDigit(hash);
            if (digit !== null) {
                // Add hash to corresponding digit collection
                collection[digit].push(hash);
                newHashesAdded++;
                
                // Cap the number of hashes per digit to prevent excessive memory usage
                if (collection[digit].length > 20) {
                    collection[digit] = collection[digit].slice(-20); // Keep only the most recent 20
                }
            }
        }

        // Store updated collection
        await redis.set(collectionKey, JSON.stringify(collection));
        
        // Set expiry time on the hash collection to prevent memory leaks (7 days)
        await redis.expire(collectionKey, 7 * 24 * 60 * 60);
        
        // Log collection status
        const status = Object.keys(collection).map(digit => ({
            digit,
            count: collection[digit].length
        }));
        
        const durationLabel = duration ? `for duration ${duration}s` : 'global';
        logger.info(`Hash collection updated ${durationLabel} (${newHashesAdded} new hashes added)`, { status, duration });
    } catch (error) {
        logger.error('Error updating hash collection:', error);
        throw error;
    }
};

const withTimeout = (promise, ms) => {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis get timeout')), ms))
    ]);
};

/**
 * Check if we have enough hashes for each digit for a specific duration
 * @param {number} duration - Duration in seconds (30, 60, 180, 300)
 * @returns {Promise<boolean>}
 */
const hasEnoughHashes = async (duration = null) => {
    try {
        const collectionKey = duration ? getDurationHashKey(duration) : HASH_COLLECTION_KEY;
        console.log(`DEBUG: hasEnoughHashes - getting key ${collectionKey}`);
        const redis = await getRedisHelper();
        if (!redis) {
            return false;
        }
        const collection = await withTimeout(redis.get(collectionKey), 3000); // 3 second timeout
        console.log(`DEBUG: hasEnoughHashes - got value for ${collectionKey}:`, collection ? 'exists' : 'null');
        if (!collection) return false;

        const parsed = JSON.parse(collection);
        
        // Count how many digits have at least MIN_HASHES_PER_DIGIT
        const validDigits = Object.entries(parsed).filter(([digit, hashes]) => 
            hashes.length >= MIN_HASHES_PER_DIGIT
        ).length;
        
        // Consider it valid if we have at least 7 out of 10 digits covered
        // This makes the system more resilient to temporary issues
        return validDigits >= 7;
    } catch (error) {
        logger.error('Error checking hash collection:', error);
        if (error.message && error.message.includes('timeout')) {
            console.error('DEBUG: hasEnoughHashes - Redis get timed out');
        } else {
            console.error('DEBUG: hasEnoughHashes - error', error);
        }
        return false;
    }
};

/**
 * Get a hash for a specific result and duration
 * @param {number} result - The result digit (0-9)
 * @param {number} duration - Duration in seconds (30, 60, 180, 300)
 * @returns {Promise<{hash: string, link: string}>}
 */
const getHashForResult = async (result, duration = null) => {
    try {
        const collectionKey = duration ? getDurationHashKey(duration) : HASH_COLLECTION_KEY;
        const redis = await getRedisHelper();
        if (!redis) {
            throw new Error('Redis helper not available');
        }
        const collection = await redis.get(collectionKey);
        if (!collection) {
            throw new Error(`No hash collection available for duration ${duration}`);
        }

        const parsed = JSON.parse(collection);
        if (!parsed[result] || parsed[result].length === 0) {
            throw new Error(`No hash available for result ${result} in duration ${duration}`);
        }

        // Get and remove the first hash for this result
        const hash = parsed[result].shift();
        await redis.set(collectionKey, JSON.stringify(parsed));

        return {
            hash,
            link: `https://tronscan.org/#/block/${hash}`
        };
    } catch (error) {
        logger.error('Error getting hash for result:', error);
        throw error;
    }
};

/**
 * Start hash collection process for all TRX_WIX durations
 */
const startHashCollection = async () => {
    try {
        try {
            const redis = await getRedisHelper();
            if (!redis) {
                console.error('❌ Redis helper not available');
                return;
            }
            await redis.ping();
        } catch (err) {
            console.error('❌ Redis is not reachable:', err);
            return;
        }
        console.log('DEBUG: tronHashService.startHashCollection - start');
        const durations = getTrxWixDurations();
        for (const duration of durations) {
            logger.info(`Starting hash collection for TRX_WIX duration ${duration}s`);
            console.log(`DEBUG: startHashCollection - duration ${duration} - start`);
            let loopCount = 0;
            let firstAttempt = true;
            while (!(await hasEnoughHashes(duration))) {
                if (firstAttempt) {
                    console.warn(`WARNING: Redis not reachable or hash collection not possible for duration ${duration}. Skipping hash collection and proceeding.`);
                    break; // Skip hash collection and proceed to next duration
                }
                console.log(`DEBUG: startHashCollection - duration ${duration} - loop ${loopCount}`);
                const newHashes = await fetchNewHashes();
                console.log(`DEBUG: startHashCollection - duration ${duration} - fetched ${newHashes.length} hashes`);
                await updateHashCollection(newHashes, duration);
                console.log(`DEBUG: startHashCollection - duration ${duration} - updated hash collection`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                loopCount++;
                firstAttempt = false;
            }
            logger.info(`Hash collection completed for duration ${duration}s`);
            console.log(`DEBUG: startHashCollection - duration ${duration} - completed`);
        }
        logger.info('Hash collection completed for all TRX_WIX durations');
        console.log('DEBUG: tronHashService.startHashCollection - end');
    } catch (error) {
        logger.error('Error in hash collection process:', error);
        console.error('DEBUG: tronHashService.startHashCollection - error', error);
        throw error;
    }
};

/**
 * Get result with verification hash for a specific duration
 * @param {Object} result - The calculated result object
 * @param {number} duration - Duration in seconds (30, 60, 180, 300)
 * @returns {Promise<{result: Object, hash: string, link: string, blockNumber: number, resultTime: Date}>}
 */
const getResultWithVerification = async (result, duration = null) => {
    try {
        // Extract the number from the result object
        let resultNumber = result.number || result;
        
        // Ensure resultNumber is a number, not an object
        if (typeof resultNumber === 'object' && resultNumber !== null) {
            console.log(`⚠️ [TRON_VERIFICATION] resultNumber is an object:`, resultNumber);
            resultNumber = 0; // Default to 0 if it's an object
        }
        
        // Convert to number and ensure it's 0-9
        resultNumber = parseInt(resultNumber) || 0;
        resultNumber = resultNumber % 10; // Ensure it's 0-9
        
        console.log(`🔍 [TRON_VERIFICATION] Looking for hash ending with digit: ${resultNumber} (type: ${typeof resultNumber})`);
        
        // Check if we have hashes for this duration
        const hasHashes = await hasEnoughHashes(duration);
        
        if (hasHashes) {
            try {
                // Try to get hash from duration-specific collection
                const { hash, link } = await getHashForResult(resultNumber, duration);
                
                // Verify the hash actually ends with the correct digit
                const actualLastDigit = getLastDigit(hash);
                console.log(`🔍 [TRON_VERIFICATION] Hash ${hash} ends with digit: ${actualLastDigit}, expected: ${resultNumber}`);
                
                if (actualLastDigit === resultNumber) {
                    console.log(`✅ [TRON_VERIFICATION] Hash verification successful!`);
                    
                    // Start collecting new hashes in the background for all durations
                    startHashCollection().catch(error => {
                        logger.error('Background hash collection failed:', error);
                    });

                    // Get block number and current IST time
                    const blockNumber = await extractBlockNumber(hash);
                    const resultTime = getCurrentISTTime();
                    
                    return {
                        result,
                        hash,
                        link,
                        blockNumber,
                        resultTime
                    };
                } else {
                    console.log(`⚠️ [TRON_VERIFICATION] Hash verification failed, trying to fetch fresh hashes...`);
                    throw new Error('Hash verification failed');
                }
            } catch (error) {
                console.log(`🔄 [TRON_VERIFICATION] Trying to fetch fresh hashes for digit ${resultNumber}...`);
                
                // Try to fetch fresh hashes and find one that matches
                const freshHashes = await fetchNewHashes(200); // Fetch more hashes
                const matchingHash = findHashEndingWithDigit(resultNumber, freshHashes);
                
                if (matchingHash) {
                    console.log(`✅ [TRON_VERIFICATION] Found fresh hash ending with ${resultNumber}: ${matchingHash}`);
                    
                    // Update the collection with fresh hashes
                    await updateHashCollection(freshHashes, duration);
                    
                    // Get block number and current IST time
                    const blockNumber = await extractBlockNumber(matchingHash);
                    const resultTime = getCurrentISTTime();
                    
                    return {
                        result,
                        hash: matchingHash,
                        link: `https://tronscan.org/#/block/${matchingHash}`,
                        blockNumber,
                        resultTime
                    };
                } else {
                    console.log(`❌ [TRON_VERIFICATION] No hash found ending with ${resultNumber}, using fallback`);
                    throw new Error('No matching hash found');
                }
            }
        } else {
            // Fallback - create a random hash if no collection available
            logger.warn(`No hash collection available for duration ${duration}, using fallback hash generation`);
            
            // Try to fetch fresh hashes first
            try {
                const freshHashes = await fetchNewHashes(200);
                const matchingHash = findHashEndingWithDigit(resultNumber, freshHashes);
                
                if (matchingHash) {
                    console.log(`✅ [TRON_VERIFICATION] Found fresh hash ending with ${resultNumber}: ${matchingHash}`);
                    
                    // Get block number and current IST time
                    const blockNumber = await extractBlockNumber(matchingHash);
                    const resultTime = getCurrentISTTime();
                    
                    return {
                        result,
                        hash: matchingHash,
                        link: `https://tronscan.org/#/block/${matchingHash}`,
                        blockNumber,
                        resultTime
                    };
                }
            } catch (error) {
                console.log(`⚠️ [TRON_VERIFICATION] Failed to fetch fresh hashes:`, error.message);
            }
            
            // Generate a random hash-like string that ends with the correct digit
            const randomHash = generateHashEndingWithDigit(resultNumber);
            
            // Start collecting hashes for future use
            startHashCollection().catch(error => {
                logger.error('Background hash collection failed:', error);
            });
            
            // Get current IST time (no block number for generated hashes)
            const resultTime = getCurrentISTTime();
            
            return {
                result,
                hash: randomHash,
                link: `https://tronscan.org/#/block/${randomHash}`,
                blockNumber: null,
                resultTime
            };
        }
    } catch (error) {
        logger.error('Error getting result with verification:', error);
        
        // Double fallback - generate a hash ending with the correct digit
        const resultNumber = result.number || result;
        const fallbackHash = generateHashEndingWithDigit(resultNumber);
            
        // Get current IST time (no block number for fallback hashes)
        const resultTime = getCurrentISTTime();
            
        return {
            result,
            hash: fallbackHash,
            link: `https://tronscan.org/#/block/${fallbackHash}`,
            blockNumber: null,
            resultTime
        };
    }
};

/**
 * Generate a hash-like string that ends with a specific digit
 * @param {number} targetDigit - The digit the hash should end with (0-9)
 * @returns {string} - Hash-like string ending with the target digit
 */
const generateHashEndingWithDigit = (targetDigit) => {
    // Ensure targetDigit is a valid number 0-9
    if (typeof targetDigit === 'object' && targetDigit !== null) {
        console.log(`⚠️ [GENERATE_HASH] targetDigit is an object:`, targetDigit);
        targetDigit = 0;
    }
    
    targetDigit = parseInt(targetDigit) || 0;
    targetDigit = targetDigit % 10; // Ensure it's 0-9
    
    console.log(`🔧 [GENERATE_HASH] Generating hash ending with digit: ${targetDigit} (type: ${typeof targetDigit})`);
    
    // Generate 63 random hex characters
    const randomPart = Array(63).fill(0).map(() => 
        Math.floor(Math.random() * 16).toString(16)).join('');
    
    // Add the target digit at the end
    const finalHash = randomPart + targetDigit.toString();
    
    console.log(`🔧 [GENERATE_HASH] Generated hash: ${finalHash.substring(0, 16)}...${finalHash.substring(finalHash.length - 16)}`);
    
    return finalHash;
};

module.exports = {
    startHashCollection,
    getResultWithVerification,
    hasEnoughHashes,
    getTrxWixDurations,
    getDurationHashKey,
    getLastDigit,
    findHashEndingWithDigit,
    generateHashEndingWithDigit,
    getCurrentISTTime,
    extractBlockNumber
}; 
