const User = require('../models/User');

// Helper function to update wallet balance using atomic operations
const updateWalletBalance = async (userId, amount, operation = 'add', transaction = null) => {
    try {
        // Use atomic operations to prevent deadlocks
        if (operation === 'add') {
            await User.increment('wallet_balance', { 
                by: parseFloat(amount),
                where: { user_id: userId },
                transaction 
            });
        } else if (operation === 'subtract') {
            await User.decrement('wallet_balance', { 
                by: parseFloat(amount),
                where: { user_id: userId },
                transaction 
            });
        } else {
            throw new Error('Invalid operation');
        }

        // Get updated balance
        const user = await User.findByPk(userId, { 
            attributes: ['wallet_balance'],
            transaction 
        });
        
        return { success: true, newBalance: parseFloat(user.wallet_balance) || 0 };
    } catch (error) {
        console.error('Error updating wallet balance:', error);
        throw error;
    }
};

module.exports = { updateWalletBalance }; 