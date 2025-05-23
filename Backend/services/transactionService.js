const { Transaction } = require('../models');
const { sequelize } = require('../config/db');

/**
 * Create a new transaction record
 * @param {Object} transactionData - Transaction data
 * @param {number} transactionData.user_id - User ID
 * @param {string} transactionData.type - Transaction type
 * @param {number} transactionData.amount - Transaction amount
 * @param {string} transactionData.status - Transaction status
 * @param {string} transactionData.reference_id - Reference ID (optional)
 * @param {string} transactionData.description - Transaction description
 * @param {string} transactionData.currency - Currency (default: 'INR')
 * @returns {Promise<Object>} Created transaction
 */
const createTransaction = async (transactionData) => {
    const t = await sequelize.transaction();

    try {
        const {
            user_id,
            type,
            amount,
            status,
            reference_id = null,
            description,
            currency = 'INR'
        } = transactionData;

        // Create transaction record
        const transaction = await Transaction.create({
            user_id,
            type,
            amount,
            status,
            reference_id,
            description,
            currency
        }, { transaction: t });

        await t.commit();

        return {
            success: true,
            transaction
        };
    } catch (error) {
        await t.rollback();
        console.error('Error creating transaction:', error);
        return {
            success: false,
            message: 'Failed to create transaction'
        };
    }
};

/**
 * Get transaction history for a user
 * @param {number} userId - User ID
 * @param {string} type - Transaction type (optional)
 * @param {number} page - Page number
 * @param {number} limit - Number of records per page
 * @returns {Promise<Object>} Transaction history with pagination
 */
const getTransactionHistory = async (userId, type = null, page = 1, limit = 10) => {
    try {
        const offset = (page - 1) * limit;
        const where = { user_id: userId };
        
        if (type) {
            where.type = type;
        }

        const { count, rows } = await Transaction.findAndCountAll({
            where,
            order: [['created_at', 'DESC']],
            limit,
            offset
        });

        return {
            success: true,
            data: rows,
            pagination: {
                total: count,
                page,
                limit,
                pages: Math.ceil(count / limit)
            }
        };
    } catch (error) {
        console.error('Error getting transaction history:', error);
        return {
            success: false,
            message: 'Failed to get transaction history'
        };
    }
};

/**
 * Update transaction status
 * @param {number} transactionId - Transaction ID
 * @param {string} status - New status
 * @param {string} description - Updated description (optional)
 * @returns {Promise<Object>} Updated transaction
 */
const updateTransactionStatus = async (transactionId, status, description = null) => {
    const t = await sequelize.transaction();

    try {
        const transaction = await Transaction.findByPk(transactionId, { transaction: t });

        if (!transaction) {
            await t.rollback();
            return {
                success: false,
                message: 'Transaction not found'
            };
        }

        const updateData = { status };
        if (description) {
            updateData.description = description;
        }

        await transaction.update(updateData, { transaction: t });
        await t.commit();

        return {
            success: true,
            transaction
        };
    } catch (error) {
        await t.rollback();
        console.error('Error updating transaction status:', error);
        return {
            success: false,
            message: 'Failed to update transaction status'
        };
    }
};

module.exports = {
    createTransaction,
    getTransactionHistory,
    updateTransactionStatus
}; 