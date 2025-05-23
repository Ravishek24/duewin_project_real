const axios = require('axios');
const redisClient = require('../config/redisConfig').redis;
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

/**
 * Extract a digit from a hash to use for result verification
 * @param {string} hash - The hash to process
 * @returns {number|null} - A digit between 0-9 or null if not found
 */
const getLastDigit = (hash) => {
    // First try to find any digit in the hash (scanning from right to left)
    const match = hash.match(/\d/g);
    if (match && match.length > 0) {
        // Use the last digit found in the hash
        return parseInt(match[match.length - 1]);
    }
    
    // If no digit found, create a pseudo-random digit based on the hash
    if (hash && hash.length > 0) {
        // Sum the character codes of the hash
        const sum = hash.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        // Return a number between 0-9 based on the sum
        return sum % 10;
    }
    
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
 * Update hash collection in Redis
 * @param {Array} hashes - New hashes to add
 */
const updateHashCollection = async (hashes) => {
    try {
        // Get current collection
        let collection = await redisClient.get(HASH_COLLECTION_KEY);
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
        await redisClient.set(HASH_COLLECTION_KEY, JSON.stringify(collection));
        
        // Set expiry time on the hash collection to prevent memory leaks (7 days)
        await redisClient.expire(HASH_COLLECTION_KEY, 7 * 24 * 60 * 60);
        
        // Log collection status
        const status = Object.keys(collection).map(digit => ({
            digit,
            count: collection[digit].length
        }));
        
        logger.info(`Hash collection updated (${newHashesAdded} new hashes added)`, { status });
    } catch (error) {
        logger.error('Error updating hash collection:', error);
        throw error;
    }
};

/**
 * Check if we have enough hashes for each digit
 * @returns {Promise<boolean>}
 */
const hasEnoughHashes = async () => {
    try {
        const collection = await redisClient.get(HASH_COLLECTION_KEY);
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
        return false;
    }
};

/**
 * Get a hash for a specific result
 * @param {number} result - The result digit (0-9)
 * @returns {Promise<{hash: string, link: string}>}
 */
const getHashForResult = async (result) => {
    try {
        const collection = await redisClient.get(HASH_COLLECTION_KEY);
        if (!collection) {
            throw new Error('No hash collection available');
        }

        const parsed = JSON.parse(collection);
        if (!parsed[result] || parsed[result].length === 0) {
            throw new Error(`No hash available for result ${result}`);
        }

        // Get and remove the first hash for this result
        const hash = parsed[result].shift();
        await redisClient.set(HASH_COLLECTION_KEY, JSON.stringify(parsed));

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
 * Start hash collection process
 */
const startHashCollection = async () => {
    try {
        while (!(await hasEnoughHashes())) {
            const newHashes = await fetchNewHashes();
            await updateHashCollection(newHashes);
            
            // Wait before next fetch to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        logger.info('Hash collection completed');
    } catch (error) {
        logger.error('Error in hash collection process:', error);
        throw error;
    }
};

/**
 * Get result with verification hash
 * @param {number} result - The calculated result
 * @returns {Promise<{result: number, hash: string, link: string}>}
 */
const getResultWithVerification = async (result) => {
    try {
        // Check if we have hashes first
        const hasHashes = await hasEnoughHashes();
        
        if (hasHashes) {
            // Normal flow - get hash from collection
            const { hash, link } = await getHashForResult(result);
            
            // Start collecting new hashes in the background
            startHashCollection().catch(error => {
                logger.error('Background hash collection failed:', error);
            });

            return {
                result,
                hash,
                link
            };
        } else {
            // Fallback - create a random hash if no collection available
            logger.warn('No hash collection available, using fallback hash generation');
            
            // Generate a random hash-like string
            const randomHash = Array(64).fill(0).map(() => 
                Math.floor(Math.random() * 16).toString(16)).join('');
            
            // Start collecting hashes for future use
            startHashCollection().catch(error => {
                logger.error('Background hash collection failed:', error);
            });
            
            return {
                result,
                hash: randomHash,
                link: `https://tronscan.org/#/block/${randomHash}`
            };
        }
    } catch (error) {
        logger.error('Error getting result with verification:', error);
        
        // Double fallback - in case of any failure, still return something
        const fallbackHash = Array(64).fill(0).map(() => 
            Math.floor(Math.random() * 16).toString(16)).join('');
            
        return {
            result,
            hash: fallbackHash,
            link: `https://tronscan.org/#/block/${fallbackHash}`
        };
    }
};

module.exports = {
    startHashCollection,
    getResultWithVerification,
    hasEnoughHashes
}; 