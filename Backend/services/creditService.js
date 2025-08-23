// Backend/services/creditService.js - Lock-Aware Version with Proper Transaction Management

const { getSequelizeInstance } = require('../config/db');
const { Op, fn, col } = require('sequelize');

// Import models
const User = require('../models/User');
const CreditTransaction = require('../models/CreditTransaction');

/**
 * Queue to prevent concurrent credit transactions for the same user
 */
const userCreditQueue = new Map();

/**
 * Processing status to prevent duplicate processing
 */
const userProcessingStatus = new Map();

/**
 * Active operations tracking for proper timeout handling
 */
const activeOperations = new Map();

/**
 * SIMPLIFIED TIMEOUT CONFIGURATION - Aligned with database settings
 */
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 100,     // Quick retries for deadlocks
    maxDelay: 1000,     // Max 1 second delay
    backoffMultiplier: 2
};

/**
 * REASONABLE TIMEOUTS - Aligned with database lock timeout (30s)
 */
const PROCESSING_TIMEOUT = 45000; // 45 seconds (longer than MySQL's 30s timeout)
const INDIVIDUAL_OPERATION_TIMEOUT = 35000; // 35 seconds 
const CONNECTION_ACQUIRE_TIMEOUT = 10000; // 10 seconds for connection acquisition

/**
 * Start periodic cleanup to prevent stuck operations
 */
const startPeriodicCleanup = () => {
    // Clean up stale processing status every 30 seconds
    setInterval(() => {
        CreditService.cleanupStaleProcessingStatus();
    }, 30000);

    // Clean up stuck active operations every 60 seconds
    setInterval(() => {
        CreditService.cleanupStaleActiveOperations();
    }, 60000);

    // NEW: Monitor connection pool health every 30 seconds
    setInterval(() => {
        CreditService.monitorConnectionPool();
    }, 30000);

    console.log('🔄 [CREDIT_SERVICE] Periodic cleanup and monitoring started');
};

/**
 * Get or create queue for a specific user
 */
const getUserCreditQueue = (userId) => {
    if (!userCreditQueue.has(userId)) {
        userCreditQueue.set(userId, []);
    }
    return userCreditQueue.get(userId);
};

/**
 * Check if user is currently being processed
 */
const isUserProcessing = (userId) => {
    return userProcessingStatus.has(userId) && userProcessingStatus.get(userId)?.processing;
};

/**
 * Set user processing status
 */
const setUserProcessing = (userId, status) => {
    userProcessingStatus.set(userId, {
        processing: status,
        timestamp: Date.now()
    });
};

/**
 * IMPROVED queue processing with lock-aware timeouts
 */
const processUserCreditQueue = async (userId) => {
    // Double-check to prevent concurrent processing
    if (isUserProcessing(userId)) {
        console.log(`⚠️ [CREDIT_SERVICE] User ${userId} is already being processed, skipping...`);
        return;
    }
    
    setUserProcessing(userId, true);
    const queue = getUserCreditQueue(userId);
    
    try {
        console.log(`🚀 [CREDIT_SERVICE] Starting queue processing for user ${userId}, queue length: ${queue.length}`);
        
        while (queue.length > 0) {
            const queueItem = queue.shift();
            if (!queueItem) continue;
            
            const { resolve, reject, params } = queueItem;
            
            try {
                console.log(`🔄 [CREDIT_SERVICE] Processing credit for user ${userId}, queue length: ${queue.length}`);
                
                // Create operation with realistic timeout (longer than MySQL lock timeout)
                const operationPromise = CreditService.addCreditInternal(...params);
                const operationId = `op_${userId}_${Date.now()}`;
                
                // Store the operation for tracking
                activeOperations.set(operationId, {
                    promise: operationPromise,
                    userId: userId,
                    startTime: Date.now()
                });
                
                // INCREASED timeout to 60 seconds (longer than MySQL's 50s lock timeout)
                const timeoutPromise = new Promise((_, timeoutReject) => {
                    setTimeout(() => {
                        console.error(`⏰ [CREDIT_SERVICE] Individual operation timeout for user ${userId} after ${INDIVIDUAL_OPERATION_TIMEOUT}ms`);
                        timeoutReject(new Error(`Individual credit operation timeout for user ${userId}`));
                    }, INDIVIDUAL_OPERATION_TIMEOUT);
                });
                
                try {
                    // Race between operation and timeout
                    const result = await Promise.race([operationPromise, timeoutPromise]);
                    
                    // Clear the operation from tracking
                    activeOperations.delete(operationId);
                    
                    resolve(result);
                    console.log(`✅ [CREDIT_SERVICE] Credit processed successfully for user ${userId}`);
                    
                } catch (error) {
                    // Clear the operation from tracking
                    activeOperations.delete(operationId);
                    
                    // Enhanced error logging with lock detection
                    if (error.message.includes('Lock wait timeout exceeded')) {
                        console.error(`🔒 [CREDIT_SERVICE] MySQL lock timeout for user ${userId}:`, error.message);
                        await CreditService.logConnectionPoolStatus();
                    } else if (error.message.includes('timeout')) {
                        console.error(`⏰ [CREDIT_SERVICE] Operation timeout for user ${userId}:`, error.message);
                        await CreditService.logConnectionPoolStatus();
                    }
                    
                    throw error;
                }
                
            } catch (error) {
                console.error(`❌ [CREDIT_SERVICE] Error processing credit for user ${userId}:`, error.message);
                reject(error);
                
                // For timeout errors, stop processing the queue
                if (error.message.includes('timeout') || error.message.includes('Lock wait timeout exceeded')) {
                    console.log(`⚠️ [CREDIT_SERVICE] Stopping queue processing due to ${error.message.includes('Lock') ? 'database lock' : 'timeout'} for user ${userId}`);
                    break;
                }
            }
        }
    } catch (error) {
        console.error(`💥 [CREDIT_SERVICE] Critical error in queue processing for user ${userId}:`, error.message);
    } finally {
        // Always reset processing status
        setUserProcessing(userId, false);
        console.log(`✅ [CREDIT_SERVICE] Finished processing queue for user ${userId}`);
        
        // Clean up empty queues
        if (queue.length === 0) {
            userCreditQueue.delete(userId);
            userProcessingStatus.delete(userId);
            console.log(`🧹 [CREDIT_SERVICE] Cleaned up queue for user ${userId}`);
        }
    }
};

/**
 * IMPROVED queue processing with proper promise handling and increased timeout
 */
const queueCreditProcessing = async (userId, amount, creditType, source, referenceId = null, description = null) => {
    return new Promise((resolve, reject) => {
        const queue = getUserCreditQueue(userId);
        
        // Create timeout with INCREASED duration (longer than MySQL lock timeout)
        const timeoutId = setTimeout(() => {
            console.error(`⏰ [CREDIT_SERVICE] Credit processing timeout for user ${userId} after ${PROCESSING_TIMEOUT}ms`);
            
            // Remove this item from the queue if it's still there
            const index = queue.findIndex(item => item.originalResolve === resolve);
            if (index !== -1) {
                queue.splice(index, 1);
                console.log(`🗑️ [CREDIT_SERVICE] Removed timed out request from queue for user ${userId}`);
            }
            
            reject(new Error(`Credit processing timeout for user ${userId} after ${PROCESSING_TIMEOUT}ms`));
        }, PROCESSING_TIMEOUT);
        
        // Wrap resolve and reject to clean up timeout
        const wrappedResolve = (value) => {
            clearTimeout(timeoutId);
            console.log(`✅ [CREDIT_SERVICE] Credit request resolved for user ${userId}`);
            resolve(value);
        };
        
        const wrappedReject = (error) => {
            clearTimeout(timeoutId);
            console.log(`❌ [CREDIT_SERVICE] Credit request rejected for user ${userId}: ${error.message}`);
            reject(error);
        };
        
        // Add the request to the queue with wrapped handlers
        queue.push({
            resolve: wrappedResolve,
            reject: wrappedReject,
            originalResolve: resolve, // Keep reference for timeout cleanup
            params: [userId, amount, creditType, source, referenceId, description]
        });
        
        console.log(`📥 [CREDIT_SERVICE] Queued credit request for user ${userId}, queue length: ${queue.length}`);
        
        // Process queue if this is the only item (and user is not already processing)
        if (queue.length === 1 && !isUserProcessing(userId)) {
            console.log(`🚀 [CREDIT_SERVICE] Starting queue processing for user ${userId}`);
            // Use setImmediate to avoid potential stack overflow
            setImmediate(() => processUserCreditQueue(userId));
        }
    });
};

/**
 * Calculate delay for retry attempts
 */
const calculateRetryDelay = (attempt) => {
    const delay = RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1);
    return Math.min(delay, RETRY_CONFIG.maxDelay);
};

/**
 * Credit Service Class
 */
class CreditService {
    /**
     * ENHANCED getModels with connection monitoring and pool validation
     */
    static async getModels() {
        const startTime = Date.now();
        
        try {
            // Add timeout to connection acquisition
            const sequelize = await Promise.race([
                getSequelizeInstance(),
                new Promise((_, reject) => {
                    setTimeout(() => {
                        reject(new Error(`Connection acquisition timeout after ${CONNECTION_ACQUIRE_TIMEOUT}ms`));
                    }, CONNECTION_ACQUIRE_TIMEOUT);
                })
            ]);
            
            const acquireTime = Date.now() - startTime;
            
            if (acquireTime > 5000) {
                console.warn(`⏰ [CONNECTION] Slow connection acquisition: ${acquireTime}ms`);
            }
            
            // SIMPLIFIED: Basic pool monitoring (non-critical)
            const pool = sequelize.connectionManager.pool;
            if (pool) {
                const poolInfo = {
                    max: pool.max || pool._factory?.max || 'auto',
                    size: pool.size || pool._count || 'unknown',
                    available: pool.available || pool._availableObjects?.length || 'unknown',
                    using: pool.using || pool._inUseObjects?.length || 'unknown',
                    waiting: pool.waiting || pool._waitingClients?.length || 0
                };
                
                // Log pool status but don't fail if it's unclear
                if (acquireTime > 1000) {
                    console.log(`📊 [CONNECTION_POOL] Status: Max=${poolInfo.max}, Available=${poolInfo.available}, Using=${poolInfo.using}, Waiting=${poolInfo.waiting}`);
                }
            }
            
            return {
                User,
                CreditTransaction,
                sequelize,
                acquireTime
            };
        } catch (error) {
            const acquireTime = Date.now() - startTime;
            console.error(`❌ [CONNECTION] Error getting models after ${acquireTime}ms:`, error.message);
            
            // If it's a pool configuration error, try to reinitialize
            if (error.message.includes('pool') || error.message.includes('configuration')) {
                console.log(`🔄 [CONNECTION] Attempting to reinitialize database connection...`);
                try {
                    // Force reconnection (this should be imported from your db.js)
                    const { cleanupIdleConnections } = require('../config/db');
                    if (cleanupIdleConnections) {
                        await cleanupIdleConnections();
                    }
                } catch (cleanupError) {
                    console.error(`❌ [CONNECTION] Cleanup failed:`, cleanupError.message);
                }
            }
            
            throw error;
        }
    }

    /**
     * Add credit to user wallet with deadlock prevention and retry logic
     */
    static async addCredit(userId, amount, creditType, source, referenceId = null, description = null) {
        // Use queue to prevent concurrent processing for the same user
        return await queueCreditProcessing(userId, amount, creditType, source, referenceId, description);
    }

    /**
     * ENHANCED addCreditInternal with proper transaction management and lock awareness
     */
    static async addCreditInternal(userId, amount, creditType, source, referenceId = null, description = null) {
        let lastError = null;
        const startTime = Date.now();

        for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
            let transaction = null;
            const attemptStartTime = Date.now();

            try {
                console.log(`💰 [CREDIT_SERVICE] Adding credit for user ${userId}, attempt ${attempt}/${RETRY_CONFIG.maxRetries}`);

                // Get models with connection monitoring
                const models = await CreditService.getModels();
                const connectionTime = models.acquireTime;

                // Start transaction with reasonable timeout aligned with database
                transaction = await models.sequelize.transaction({
                    timeout: 25000, // 25 seconds (shorter than MySQL's 30s lock timeout)
                    isolationLevel: models.sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
                });

                // Determine if this is external credit
                const isExternalCredit = CreditService.isExternalCredit(creditType, source);

                // Generate credit ID
                const creditId = `CREDIT_${Date.now()}_${userId}`;

                // Create credit transaction within the database transaction
                const creditTransaction = await models.CreditTransaction.create({
                    credit_id: creditId,
                    user_id: userId,
                    amount: amount,
                    credit_type: creditType,
                    source: source,
                    reference_id: referenceId,
                    is_external_credit: isExternalCredit,
                    description: description,
                    created_at: new Date(),
                    updated_at: new Date()
                }, { 
                    transaction,
                    timeout: 30000 // 30 second timeout for this specific query
                });

                console.log(`✅ [CREDIT_SERVICE] Credit transaction created: ${creditId}`);

                // Check if user exists first (without locking)
                const user = await models.User.findOne({
                    where: { user_id: userId },
                    attributes: ['user_id', 'wallet_balance'],
                    transaction
                });

                if (!user) {
                    throw new Error(`User ${userId} not found`);
                }

                // For withdrawals, check balance first
                if (creditType === 'withdrawal') {
                    const currentBalance = parseFloat(user.wallet_balance) || 0;
                    if (currentBalance < parseFloat(amount)) {
                        throw new Error(`Insufficient balance for withdrawal. Current: ${currentBalance}, Requested: ${amount}`);
                    }
                    
                    // Use atomic decrement for withdrawal
                    await models.User.decrement('wallet_balance', {
                        by: parseFloat(amount),
                        where: { user_id: userId },
                        transaction
                    });
                } else {
                    // Use atomic increment for credit
                    await models.User.increment('wallet_balance', {
                        by: parseFloat(amount),
                        where: { user_id: userId },
                        transaction
                    });
                }

                // Commit the transaction
                await transaction.commit();

                const totalTime = Date.now() - attemptStartTime;
                console.log(`✅ [CREDIT_SERVICE] Credit added successfully for user ${userId}: ${amount} (${creditType}) in ${totalTime}ms (connection: ${connectionTime}ms)`);

                return {
                    success: true,
                    creditId: creditId,
                    transaction: creditTransaction,
                    timing: {
                        total: Date.now() - startTime,
                        attempt: totalTime,
                        connection: connectionTime
                    }
                };

            } catch (error) {
                // Rollback the transaction
                if (transaction) {
                    try {
                        await transaction.rollback();
                    } catch (rollbackError) {
                        console.error(`🔄 [CREDIT_SERVICE] Rollback error for user ${userId}:`, rollbackError.message);
                    }
                }

                lastError = error;
                const attemptTime = Date.now() - attemptStartTime;

                // Enhanced error classification
                const isConnectionError = (
                    error.message.includes('Connection') ||
                    error.message.includes('connection') ||
                    error.message.includes('ECONNRESET') ||
                    error.message.includes('ENOTFOUND')
                );

                const isLockError = (
                    error.code === 'ER_LOCK_WAIT_TIMEOUT' ||
                    error.message.includes('Lock wait timeout exceeded') ||
                    error.code === 'ER_LOCK_DEADLOCK' ||
                    error.original?.code === 'ER_LOCK_WAIT_TIMEOUT' ||
                    error.message.includes('Deadlock found when trying to get lock')
                );

                const isTimeoutError = (
                    error.message.includes('timeout') &&
                    !isLockError // Don't double-count lock timeouts
                );

                if (isLockError) {
                    console.error(`🔒 [LOCK_ERROR] Database lock issue on attempt ${attempt} for user ${userId} (${attemptTime}ms):`, error.message);
                    await CreditService.logConnectionPoolStatus();
                } else if (isConnectionError) {
                    console.error(`🔌 [CONNECTION_ERROR] Connection issue on attempt ${attempt} for user ${userId} (${attemptTime}ms):`, error.message);
                    await CreditService.logConnectionPoolStatus();
                } else if (isTimeoutError) {
                    console.error(`⏰ [TIMEOUT_ERROR] Timeout on attempt ${attempt} for user ${userId} (${attemptTime}ms):`, error.message);
                } else {
                    console.error(`❌ [UNKNOWN_ERROR] Unexpected error on attempt ${attempt} for user ${userId} (${attemptTime}ms):`, error.message);
                }

                // Retry for connection, lock, and timeout errors
                if ((isConnectionError || isLockError || isTimeoutError) && attempt < RETRY_CONFIG.maxRetries) {
                    const delay = calculateRetryDelay(attempt);
                    console.log(`⏳ [CREDIT_SERVICE] Waiting ${delay}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }

                // For non-retryable errors or max retries reached, break
                console.error(`❌ [CREDIT_SERVICE] Breaking retry loop after attempt ${attempt}`);
                break;
            }
        }

        // All retries failed
        const totalTime = Date.now() - startTime;
        console.error(`❌ [CREDIT_SERVICE] Failed to add credit after ${RETRY_CONFIG.maxRetries} attempts for user ${userId} (total: ${totalTime}ms):`, lastError?.message);
        throw new Error(`Failed to add credit after ${RETRY_CONFIG.maxRetries} attempts: ${lastError?.message}`);
    }

    /**
     * NEW: Monitor connection pool health
     */
    static async monitorConnectionPool() {
        try {
            const sequelize = await getSequelizeInstance();
            const pool = sequelize.connectionManager.pool;
            
            if (pool) {
                const status = {
                    max: pool.max || pool._factory?.max || 'auto',
                    size: pool.size || pool._count || 'unknown',
                    available: pool.available || pool._availableObjects?.length || 'unknown',
                    using: pool.using || pool._inUseObjects?.length || 'unknown',
                    waiting: pool.waiting || pool._waitingClients?.length || 0
                };
                
                // Alert on high wait queue
                if (typeof status.waiting === 'number' && status.waiting > 5) {
                    console.warn(`🚨 [CONNECTION_POOL] High wait queue: ${status.waiting} waiting, ${status.available} available, ${status.using} using`);
                }
                
                return status;
            }
        } catch (error) {
            console.error('Error monitoring connection pool:', error);
        }
        return null;
    }

    /**
     * NEW: Log connection pool status for debugging
     */
    static async logConnectionPoolStatus() {
        const status = await CreditService.monitorConnectionPool();
        if (status) {
            console.log(`📊 [CONNECTION_POOL] Status: Max=${status.max}, Size=${status.size}, Available=${status.available}, Using=${status.using}, Waiting=${status.waiting}`);
        }
    }

    /**
     * Quick wallet update for game operations (without creating credit transaction record)
     * Use this for game wins/losses where you don't need full credit tracking
     */
    static async updateWalletBalance(userId, amount, operation = 'add', transaction = null) {
        try {
            const models = await CreditService.getModels();
            let useTransaction = transaction;
            
            if (!useTransaction) {
                useTransaction = await models.sequelize.transaction({
                    timeout: 10000, // Short timeout for simple operations
                    isolationLevel: models.sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
                });
            }

            try {
                // Check user exists
                const user = await models.User.findOne({
                    where: { user_id: userId },
                    attributes: ['user_id', 'wallet_balance'],
                    transaction: useTransaction
                });

                if (!user) {
                    throw new Error(`User ${userId} not found`);
                }

                // For subtractions, check balance first
                if (operation === 'subtract' || operation === 'deduct') {
                    const currentBalance = parseFloat(user.wallet_balance) || 0;
                    if (currentBalance < parseFloat(amount)) {
                        throw new Error(`Insufficient balance. Current: ${currentBalance}, Requested: ${amount}`);
                    }
                    
                    await models.User.decrement('wallet_balance', {
                        by: parseFloat(amount),
                        where: { user_id: userId },
                        transaction: useTransaction
                    });
                } else {
                    // Add operation
                    await models.User.increment('wallet_balance', {
                        by: parseFloat(amount),
                        where: { user_id: userId },
                        transaction: useTransaction
                    });
                }

                // Commit if we created the transaction
                if (!transaction) {
                    await useTransaction.commit();
                }

                return {
                    success: true,
                    message: `Wallet ${operation} completed successfully`
                };

            } catch (error) {
                if (!transaction) {
                    await useTransaction.rollback();
                }
                throw error;
            }

        } catch (error) {
            console.error(`Error updating wallet balance:`, error);
            return {
                success: false,
                message: 'Failed to update wallet balance',
                error: error.message
            };
        }
    }

    /**
     * Add credit to user wallet with existing transaction
     */
    static async addCreditWithTransaction(userId, amount, creditType, source, referenceId = null, description = null, transaction) {
        try {
            const models = await CreditService.getModels();

            // Determine if this is external credit
            const isExternalCredit = CreditService.isExternalCredit(creditType, source);

            // Generate credit ID
            const creditId = `CREDIT_${Date.now()}_${userId}`;

            // Create credit transaction using provided transaction
            const creditTransaction = await models.CreditTransaction.create({
                credit_id: creditId,
                user_id: userId,
                amount: amount,
                credit_type: creditType,
                source: source,
                reference_id: referenceId,
                is_external_credit: isExternalCredit,
                description: description
            }, { transaction });

            // Update user summary using provided transaction
            await CreditService.updateUserCreditSummaryWithTransaction(userId, amount, isExternalCredit, transaction);

            return {
                success: true,
                creditTransaction,
                message: 'Credit added successfully'
            };

        } catch (error) {
            console.error('Error adding credit with transaction:', error);
            return {
                success: false,
                message: 'Failed to add credit',
                error: error.message
            };
        }
    }

    /**
     * Determine if credit is external
     */
    static isExternalCredit(creditType, source) {
        const externalTypes = ['welcome_bonus', 'referral_bonus', 'deposit_bonus', 'promotion_bonus'];
        const externalSources = ['external', 'system', 'admin'];

        return externalTypes.includes(creditType) || externalSources.includes(source);
    }

    /**
     * Update user credit summary with deadlock prevention
     */
    static async updateUserCreditSummary(userId, amount, creditType) {
        let lastError = null;

        for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
            try {
                const models = await CreditService.getModels();

                // Use atomic operations WITHOUT row-level locking for better performance
                if (creditType === 'withdrawal') {
                    await models.User.decrement('wallet_balance', {
                        by: amount,
                        where: { user_id: userId }
                    });
                } else {
                    await models.User.increment('wallet_balance', {
                        by: amount,
                        where: { user_id: userId }
                    });
                }

                console.log(`✅ [CREDIT_SERVICE] Updated user wallet balance for user ${userId}, attempt ${attempt}`);
                return; // Success, exit retry loop

            } catch (error) {
                lastError = error;

                // Check if it's a deadlock error
                if (error.code === 'ER_LOCK_WAIT_TIMEOUT' ||
                    error.message.includes('Lock wait timeout exceeded') ||
                    error.code === 'ER_LOCK_DEADLOCK') {

                    console.log(`⚠️ [CREDIT_SERVICE] Deadlock detected on attempt ${attempt}, retrying...`);

                    if (attempt < RETRY_CONFIG.maxRetries) {
                        const delay = calculateRetryDelay(attempt);
                        console.log(`⏳ [CREDIT_SERVICE] Waiting ${delay}ms before retry...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                }

                // For non-deadlock errors or max retries reached, break
                break;
            }
        }

        // All retries failed
        console.error(`❌ [CREDIT_SERVICE] Failed to update user credit summary after ${RETRY_CONFIG.maxRetries} attempts:`, lastError);
        throw new Error(`Failed to update user credit summary after ${RETRY_CONFIG.maxRetries} attempts: ${lastError.message}`);
    }

    /**
     * Update user credit summary with transaction
     */
    static async updateUserCreditSummaryWithTransaction(userId, amount, isExternalCredit, transaction) {
        try {
            const models = await CreditService.getModels();

            // Update user wallet balance with transaction
            if (isExternalCredit) {
                await models.User.increment('wallet_balance', {
                    by: amount,
                    where: { user_id: userId },
                    transaction
                });
            }

            console.log(`✅ [CREDIT_SERVICE] Updated user wallet balance with transaction for user ${userId}`);

        } catch (error) {
            console.error('Error updating user credit summary with transaction:', error);
            throw error;
        }
    }

    /**
     * Get user credit summary
     */
    static async getUserCreditSummary(userId) {
        try {
            const models = await CreditService.getModels();

            const user = await models.User.findOne({
                where: { user_id: userId },
                attributes: ['user_id', 'wallet_balance', 'total_external_credits', 'total_self_rebate_credits', 'wagering_progress']
            });

            return user;

        } catch (error) {
            console.error('Error getting user credit summary:', error);
            return null;
        }
    }

    /**
     * Get user credit balance
     */
    static async getUserCreditBalance(userId) {
        try {
            const models = await CreditService.getModels();

            const user = await models.User.findOne({
                where: { user_id: userId },
                attributes: ['wallet_balance']
            });

            return user ? parseFloat(user.wallet_balance) : 0;

        } catch (error) {
            console.error('Error getting user credit balance:', error);
            return 0;
        }
    }

    /**
     * Get user credit history
     */
    static async getUserCreditHistory(userId, limit = 50, offset = 0) {
        try {
            const models = await CreditService.getModels();

            const transactions = await models.CreditTransaction.findAll({
                where: { user_id: userId },
                order: [['created_at', 'DESC']],
                limit: limit,
                offset: offset
            });

            return transactions;

        } catch (error) {
            console.error('Error getting user credit history:', error);
            return [];
        }
    }

    /**
     * Update wagering progress when bet is placed
     */
    static async updateWageringProgress(userId, betAmount) {
        try {
            const models = await CreditService.getModels();

            // Update wagering progress
            await models.User.update({
                wagering_progress: models.sequelize.literal(`wagering_progress + ${betAmount}`)
            }, {
                where: { user_id: userId }
            });

            return {
                success: true,
                message: 'Wagering progress updated'
            };

        } catch (error) {
            console.error('Error updating wagering progress:', error);
            return {
                success: false,
                message: 'Failed to update wagering progress',
                error: error.message
            };
        }
    }

    /**
     * Clean up stale processing status (call this periodically)
     */
    static cleanupStaleProcessingStatus() {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [userId, status] of userProcessingStatus.entries()) {
            // If processing status is older than 10 minutes, clean it up (increased from 5)
            if (status && (now - status.timestamp) > 600000) {
                userProcessingStatus.delete(userId);
                userCreditQueue.delete(userId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`🧹 [CREDIT_SERVICE] Cleaned up ${cleanedCount} stale processing statuses`);
        }

        return cleanedCount;
    }

    /**
     * Clean up stale active operations (call this periodically)
     */
    static cleanupStaleActiveOperations() {
        const now = Date.now();
        let cleanedCount = 0;

        for (const [operationId, operation] of activeOperations.entries()) {
            // If operation is older than 5 minutes, clean it up (increased from 2)
            if (operation && (now - operation.startTime) > 300000) {
                activeOperations.delete(operationId);
                cleanedCount++;
                console.log(`🧹 [CREDIT_SERVICE] Cleaned up stale operation ${operationId} for user ${operation.userId}`);
            }
        }

        if (cleanedCount > 0) {
            console.log(`🧹 [CREDIT_SERVICE] Cleaned up ${cleanedCount} stale active operations`);
        }

        return cleanedCount;
    }

    /**
     * Get queue status for debugging
     */
    static getQueueStatus() {
        return {
            queueSize: userCreditQueue.size,
            processingStatusSize: userProcessingStatus.size,
            activeOperationsSize: activeOperations.size,
            queues: Object.fromEntries(
                Array.from(userCreditQueue.entries()).map(([userId, queue]) => [
                    userId,
                    { length: queue.length, processing: isUserProcessing(userId) }
                ])
            ),
            activeOperations: Array.from(activeOperations.entries()).map(([id, op]) => ({
                id,
                userId: op.userId,
                startTime: op.startTime,
                duration: Date.now() - op.startTime
            }))
        };
    }

    /**
     * ENHANCED queue status with connection info
     */
    static async getEnhancedQueueStatus() {
        const basicStatus = CreditService.getQueueStatus();
        const connectionStatus = await CreditService.monitorConnectionPool();

        return {
            ...basicStatus,
            connectionPool: connectionStatus,
            timestamp: new Date().toISOString(),
            timeouts: {
                processing: PROCESSING_TIMEOUT,
                individual: INDIVIDUAL_OPERATION_TIMEOUT,
                connection: CONNECTION_ACQUIRE_TIMEOUT
            }
        };
    }

    /**
     * Force cancel an active operation (for debugging/admin use)
     */
    static forceCancelOperation(operationId) {
        if (activeOperations.has(operationId)) {
            const operation = activeOperations.get(operationId);
            console.log(`🛑 [CREDIT_SERVICE] Force cancelling operation ${operationId} for user ${operation.userId}`);
            activeOperations.delete(operationId);
            return true;
        }
        return false;
    }

    /**
     * Clean up all active operations (for emergency use)
     */
    static cleanupAllActiveOperations() {
        const count = activeOperations.size;
        activeOperations.clear();
        console.log(`🧹 [CREDIT_SERVICE] Cleaned up ${count} active operations`);
        return count;
    }

         /**
      * NEW: Get database lock information for debugging (MySQL version compatible)
      */
     static async getDatabaseLockInfo() {
         try {
             const models = await CreditService.getModels();
             
             // Check for current transactions
             const [transactions] = await models.sequelize.query(`
                 SELECT 
                     trx_id,
                     trx_state,
                     trx_started,
                     trx_wait_started,
                     trx_mysql_thread_id,
                     TIME_TO_SEC(TIMEDIFF(NOW(), trx_started)) AS duration_seconds,
                     trx_query
                 FROM information_schema.INNODB_TRX
                 WHERE TIME_TO_SEC(TIMEDIFF(NOW(), trx_started)) > 5
                 ORDER BY trx_started
             `);

             // Check current process list for long-running queries (excluding event_scheduler)
             const [processes] = await models.sequelize.query(`
                 SELECT 
                     ID,
                     USER,
                     HOST,
                     DB,
                     COMMAND,
                     TIME,
                     STATE,
                     LEFT(INFO, 100) as QUERY_PREVIEW
                 FROM information_schema.PROCESSLIST
                 WHERE COMMAND != 'Sleep'
                 AND USER != 'event_scheduler'
                 AND TIME > 10
                 ORDER BY TIME DESC
                 LIMIT 20
             `);

             // Try to get lock information (MySQL version dependent)
             let lockInfo = null;
             try {
                 // Try MySQL 8.0+ approach first
                 const [locks] = await models.sequelize.query(`
                     SELECT 
                         'lock_wait' as type,
                         COUNT(*) as count
                     FROM performance_schema.data_lock_waits
                     LIMIT 1
                 `);
                 
                 if (locks.length > 0) {
                     lockInfo = { type: 'performance_schema', count: locks[0].count };
                 }
             } catch (lockError) {
                 // Fallback to older MySQL versions
                 try {
                     const [locks] = await models.sequelize.query(`
                         SELECT 
                             'innodb_locks' as type,
                             COUNT(*) as count
                         FROM information_schema.INNODB_LOCKS
                         LIMIT 1
                     `);
                     
                     if (locks.length > 0) {
                         lockInfo = { type: 'innodb_locks', count: locks[0].count };
                     }
                 } catch (fallbackError) {
                     lockInfo = { type: 'not_available', count: 0, reason: 'MySQL version limitation' };
                 }
             }

             return {
                 longRunningTransactions: transactions,
                 longRunningQueries: processes,
                 lockInfo: lockInfo,
                 timestamp: new Date().toISOString()
             };
         } catch (error) {
             console.error('Error getting database lock info:', error);
             return null;
         }
     }

    /**
     * NEW: Emergency database cleanup
     */
    static async emergencyDatabaseCleanup() {
        try {
            const lockInfo = await CreditService.getDatabaseLockInfo();
            
            if (lockInfo && lockInfo.longRunningTransactions.length > 0) {
                console.warn(`🚨 [CREDIT_SERVICE] Found ${lockInfo.longRunningTransactions.length} long-running transactions`);
                lockInfo.longRunningTransactions.forEach(trx => {
                    console.warn(`🔒 Transaction ${trx.trx_id}: ${trx.duration_seconds}s, State: ${trx.trx_state}, Query: ${trx.trx_query}`);
                });
            }

            if (lockInfo && lockInfo.longRunningQueries.length > 0) {
                console.warn(`🚨 [CREDIT_SERVICE] Found ${lockInfo.longRunningQueries.length} long-running queries`);
                lockInfo.longRunningQueries.forEach(proc => {
                    console.warn(`🐌 Process ${proc.ID}: ${proc.TIME}s, State: ${proc.STATE}, Query: ${proc.QUERY_PREVIEW}`);
                });
            }

            return lockInfo;
        } catch (error) {
            console.error('Error in emergency database cleanup:', error);
            return null;
        }
    }

    /**
     * Initialize the credit service
     */
    static initialize() {
        startPeriodicCleanup();
        console.log('🚀 [CREDIT_SERVICE] Credit service initialized with lock-aware processing and enhanced monitoring');
    }
}

// Initialize the service when the module is loaded
CreditService.initialize();

module.exports = CreditService;

// Export individual methods for easier testing
module.exports.addCreditWithTransaction = CreditService.addCreditWithTransaction;
module.exports.updateWalletBalance = CreditService.updateWalletBalance;
module.exports.updateUserCreditSummaryWithTransaction = CreditService.updateUserCreditSummaryWithTransaction;
module.exports.cleanupStaleProcessingStatus = CreditService.cleanupStaleProcessingStatus;
module.exports.cleanupStaleActiveOperations = CreditService.cleanupStaleActiveOperations;
module.exports.getQueueStatus = CreditService.getQueueStatus;
module.exports.getEnhancedQueueStatus = CreditService.getEnhancedQueueStatus;
module.exports.monitorConnectionPool = CreditService.monitorConnectionPool;
module.exports.getDatabaseLockInfo = CreditService.getDatabaseLockInfo;
module.exports.emergencyDatabaseCleanup = CreditService.emergencyDatabaseCleanup;
module.exports.forceCancelOperation = CreditService.forceCancelOperation;
module.exports.cleanupAllActiveOperations = CreditService.cleanupAllActiveOperations;