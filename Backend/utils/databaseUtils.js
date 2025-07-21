/**
 * Database utility functions for handling common database operations
 * with retry logic for lock timeout issues
 */

const { sequelize } = require('../config/database');

/**
 * Execute a database operation with retry logic for lock timeout issues
 * @param {Function} operation - The database operation to execute
 * @param {Object} options - Options for the operation
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.baseDelay - Base delay in milliseconds (default: 100)
 * @param {number} options.maxDelay - Maximum delay in milliseconds (default: 1000)
 * @param {boolean} options.useTransaction - Whether to use a transaction (default: true)
 * @returns {Promise<Object>} - Result of the operation
 */
const executeWithRetry = async (operation, options = {}) => {
  const {
    maxRetries = 3,
    baseDelay = 100,
    maxDelay = 1000,
    useTransaction = true
  } = options;

  let retryCount = 0;

  while (retryCount < maxRetries) {
    let transaction = null;

    try {
      if (useTransaction) {
        transaction = await sequelize.transaction();
      }

      const result = await operation(transaction);

      if (transaction) {
        await transaction.commit();
      }

      return result;
    } catch (error) {
      if (transaction) {
        await transaction.rollback();
      }

      // Check if error is a lock timeout
      if (isLockTimeoutError(error)) {
        retryCount++;
        
        if (retryCount < maxRetries) {
          const delay = calculateRetryDelay(retryCount, baseDelay, maxDelay);
          console.warn(`Lock timeout detected, retrying (${retryCount}/${maxRetries}) after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      // If it's not a lock timeout or we've exhausted retries, throw the error
      throw error;
    }
  }

  throw new Error(`Operation failed after ${maxRetries} attempts due to lock timeout`);
};

/**
 * Check if an error is a lock timeout error
 * @param {Error} error - The error to check
 * @returns {boolean} - True if it's a lock timeout error
 */
const isLockTimeoutError = (error) => {
  return error.name === 'SequelizeDatabaseError' && 
         error.parent && 
         error.parent.code === 'ER_LOCK_WAIT_TIMEOUT';
};

/**
 * Calculate retry delay with exponential backoff and jitter
 * @param {number} retryCount - Current retry count
 * @param {number} baseDelay - Base delay in milliseconds
 * @param {number} maxDelay - Maximum delay in milliseconds
 * @returns {number} - Delay in milliseconds
 */
const calculateRetryDelay = (retryCount, baseDelay, maxDelay) => {
  // Exponential backoff: baseDelay * 2^retryCount
  const exponentialDelay = baseDelay * Math.pow(2, retryCount - 1);
  
  // Add jitter (random factor between 0.5 and 1.5)
  const jitter = 0.5 + Math.random();
  const delay = exponentialDelay * jitter;
  
  // Cap at maxDelay
  return Math.min(delay, maxDelay);
};

/**
 * Execute a database operation with optimistic locking
 * @param {Function} operation - The database operation to execute
 * @param {Object} options - Options for the operation
 * @returns {Promise<Object>} - Result of the operation
 */
const executeWithOptimisticLock = async (operation, options = {}) => {
  return executeWithRetry(async (transaction) => {
    return await operation(transaction);
  }, {
    ...options,
    maxRetries: options.maxRetries || 5, // More retries for optimistic locking
    baseDelay: options.baseDelay || 50,  // Shorter base delay
    maxDelay: options.maxDelay || 500    // Shorter max delay
  });
};

/**
 * Execute a database operation with pessimistic locking
 * @param {Function} operation - The database operation to execute
 * @param {Object} options - Options for the operation
 * @returns {Promise<Object>} - Result of the operation
 */
const executeWithPessimisticLock = async (operation, options = {}) => {
  return executeWithRetry(async (transaction) => {
    return await operation(transaction);
  }, {
    ...options,
    maxRetries: options.maxRetries || 3,
    baseDelay: options.baseDelay || 100,
    maxDelay: options.maxDelay || 1000
  });
};

/**
 * Create a database lock for a specific resource
 * @param {string} lockKey - Unique key for the lock
 * @param {number} timeout - Lock timeout in milliseconds (default: 30000)
 * @returns {Promise<boolean>} - True if lock was acquired
 */
const acquireLock = async (lockKey, timeout = 30000) => {
  try {
    // Use Redis for distributed locking if available
    
    if (redis) {
      const lockValue = Date.now().toString();
      const acquired = await redis.set(lockKey, lockValue, 'PX', timeout, 'NX');
      return acquired === 'OK';
    }
    
    // Fallback to database-based locking
    const result = await sequelize.query(
      'SELECT GET_LOCK(?, ?) as lock_acquired',
      {
        replacements: [lockKey, timeout / 1000],
        type: sequelize.QueryTypes.SELECT
      }
    );
    
    return result[0]?.lock_acquired === 1;
  } catch (error) {
    console.error('Error acquiring lock:', error);
    return false;
  }
};

/**
 * Release a database lock
 * @param {string} lockKey - Unique key for the lock
 * @returns {Promise<boolean>} - True if lock was released
 */
const releaseLock = async (lockKey) => {
  try {
    // Use Redis for distributed locking if available
    
    if (redis) {
      const released = await redis.del(lockKey);
      return released === 1;
    }
    
    // Fallback to database-based locking
    const result = await sequelize.query(
      'SELECT RELEASE_LOCK(?) as lock_released',
      {
        replacements: [lockKey],
        type: sequelize.QueryTypes.SELECT
      }
    );
    
    return result[0]?.lock_released === 1;
  } catch (error) {
    console.error('Error releasing lock:', error);
    return false;
  }
};

/**
 * Execute a database operation with distributed locking
 * @param {string} lockKey - Unique key for the lock
 * @param {Function} operation - The database operation to execute
 * @param {Object} options - Options for the operation
 * @returns {Promise<Object>} - Result of the operation
 */
const executeWithDistributedLock = async (lockKey, operation, options = {}) => {
  const { timeout = 30000 } = options;
  
  const lockAcquired = await acquireLock(lockKey, timeout);
  if (!lockAcquired) {
    throw new Error(`Failed to acquire lock for key: ${lockKey}`);
  }
  
  try {
    return await operation();
  } finally {
    await releaseLock(lockKey);
  }
};

module.exports = {
  executeWithRetry,
  executeWithOptimisticLock,
  executeWithPessimisticLock,
  executeWithDistributedLock,
  acquireLock,
  releaseLock,
  isLockTimeoutError,
  calculateRetryDelay
}; 