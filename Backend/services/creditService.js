// Backend/services/creditService.js - Enhanced with Queue System and Deadlock Prevention

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
 * Get or create queue for a specific user
 */
const getUserCreditQueue = (userId) => {
    if (!userCreditQueue.has(userId)) {
        userCreditQueue.set(userId, []);
    }
    return userCreditQueue.get(userId);
};

/**
 * Process queue for a specific user
 */
const processUserCreditQueue = async (userId) => {
    const queue = getUserCreditQueue(userId);
    
    while (queue.length > 0) {
        const { resolve, reject, params } = queue.shift();
        
        try {
            const result = await addCreditInternal(...params);
            resolve(result);
        } catch (error) {
            reject(error);
        }
    }
};

/**
 * Queue credit processing for a user
 */
const queueCreditProcessing = async (userId, amount, creditType, source, referenceId = null, description = null) => {
    return new Promise((resolve, reject) => {
        const queue = getUserCreditQueue(userId);
        
        queue.push({
            resolve,
            reject,
            params: [userId, amount, creditType, source, referenceId, description]
        });
        
        // Process queue if this is the only item
        if (queue.length === 1) {
            processUserCreditQueue(userId);
        }
    });
};

/**
 * Retry configuration for deadlock handling
 */
const RETRY_CONFIG = {
    maxRetries: 3,
    baseDelay: 100, // 100ms
    maxDelay: 2000, // 2 seconds
    backoffMultiplier: 2
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
     * Get models instance
     */
    static async getModels() {
        try {
            const sequelize = await getSequelizeInstance();
            return {
                User,
                CreditTransaction,
                sequelize
            };
        } catch (error) {
            console.error('Error getting models:', error);
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
     * Internal function to add credit (called by queue)
     */
    static async addCreditInternal(userId, amount, creditType, source, referenceId = null, description = null) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
        try {
            console.log(`💰 [CREDIT_SERVICE] Adding credit for user ${userId}, attempt ${attempt}/${RETRY_CONFIG.maxRetries}`);
            
            const models = await this.getModels();
            
            // Determine if this is external credit
            const isExternalCredit = this.isExternalCredit(creditType, source);
            
            // Generate credit ID
            const creditId = `CREDIT_${Date.now()}_${userId}`;
            
            // Create credit transaction
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
            });
            
            console.log(`✅ [CREDIT_SERVICE] Credit transaction created: ${creditId}`);
            
            // Update user wallet balance
            await this.updateUserCreditSummary(userId, amount, creditType);
            
            console.log(`✅ [CREDIT_SERVICE] Credit added successfully for user ${userId}: ${amount} (${creditType})`);
            
            return {
                success: true,
                creditId: creditId,
                transaction: creditTransaction
            };
            
        } catch (error) {
            lastError = error;
            
            // Check if it's a deadlock error
            if (error.code === 'ER_LOCK_WAIT_TIMEOUT' || 
                error.message.includes('Lock wait timeout exceeded')) {
                
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
    console.error(`❌ [CREDIT_SERVICE] Failed to add credit after ${RETRY_CONFIG.maxRetries} attempts:`, lastError);
    throw new Error(`Failed to add credit after ${RETRY_CONFIG.maxRetries} attempts: ${lastError.message}`);
}
    
    /**
     * Add credit to user wallet with existing transaction
     */
    static async addCreditWithTransaction(userId, amount, creditType, source, referenceId = null, description = null, transaction) {
        try {
            const models = await this.getModels();
            
            // Determine if this is external credit
            const isExternalCredit = this.isExternalCredit(creditType, source);
            
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
            await this.updateUserCreditSummaryWithTransaction(userId, amount, isExternalCredit, transaction);
            
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
     * Update user credit summary
     */
    static async updateUserCreditSummary(userId, amount, creditType) {
        try {
            const models = await this.getModels();
            
            // Update user wallet balance directly
            if (creditType === 'withdrawal') {
                await models.User.decrement('wallet_balance', { by: amount, where: { user_id: userId } });
            } else {
                await models.User.increment('wallet_balance', { by: amount, where: { user_id: userId } });
            }
            
            console.log(`✅ [CREDIT_SERVICE] Updated user wallet balance for user ${userId}`);
            
        } catch (error) {
            console.error('Error updating user credit summary:', error);
            throw error;
        }
    }

    /**
     * Update user credit summary with transaction
     */
    static async updateUserCreditSummaryWithTransaction(userId, amount, isExternalCredit, transaction) {
        try {
            const models = await this.getModels();
            
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
            const models = await this.getModels();
            
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
            const models = await this.getModels();
            
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
            const models = await this.getModels();
            
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
            const models = await this.getModels();
            
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
}

module.exports = CreditService;

// Export individual methods for easier testing
module.exports.addCreditWithTransaction = CreditService.addCreditWithTransaction;
module.exports.updateUserCreditSummaryWithTransaction = CreditService.updateUserCreditSummaryWithTransaction;
