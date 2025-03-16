import User from '../models/User.js';
import { sequelize } from '../config/db.js';

// Service to get user wallet balance
export const getWalletBalance = async (userId) => {
    try {
        const user = await User.findByPk(userId, {
            attributes: ['user_id', 'wallet_balance']
        });

        if (!user) {
            return {
                success: false,
                message: 'User not found.'
            };
        }

        return {
            success: true,
            wallet: {
                balance: user.wallet_balance
            }
        };
    } catch (error) {
        console.error('Error fetching wallet balance:', error);
        return {
            success: false,
            message: 'Server error fetching wallet balance.'
        };
    }
};

// Service to update wallet balance (internal use only)
export const updateWalletBalance = async (userId, amount, type, transaction = null) => {
    const t = transaction || await sequelize.transaction();

    try {
        // Lock the user row for update to prevent race conditions
        const user = await User.findByPk(userId, {
            attributes: ['user_id', 'wallet_balance'],
            lock: true,
            transaction: t
        });

        if (!user) {
            if (!transaction) await t.rollback();
            return {
                success: false,
                message: 'User not found.'
            };
        }

        let newBalance;
        
        if (type === 'add') {
            // Credit to wallet
            newBalance = parseFloat(user.wallet_balance) + parseFloat(amount);
        } else if (type === 'subtract') {
            // Debit from wallet
            if (parseFloat(user.wallet_balance) < parseFloat(amount)) {
                if (!transaction) await t.rollback();
                return {
                    success: false,
                    message: 'Insufficient wallet balance.'
                };
            }
            newBalance = parseFloat(user.wallet_balance) - parseFloat(amount);
        } else {
            if (!transaction) await t.rollback();
            return {
                success: false,
                message: 'Invalid operation type.'
            };
        }

        // Update user wallet balance
        await User.update(
            { wallet_balance: newBalance },
            { 
                where: { user_id: userId },
                transaction: t 
            }
        );

        // If no external transaction was provided, commit this one
        if (!transaction) await t.commit();

        return {
            success: true,
            newBalance: newBalance
        };
    } catch (error) {
        // If no external transaction was provided, rollback this one
        if (!transaction) await t.rollback();
        
        console.error('Error updating wallet balance:', error);
        return {
            success: false,
            message: 'Server error updating wallet balance.'
        };
    }
};

export default {
    getWalletBalance,
    updateWalletBalance
};