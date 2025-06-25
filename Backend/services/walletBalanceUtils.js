const User = require('../models/User');

// Helper function to update wallet balance
const updateWalletBalance = async (userId, amount, operation = 'add', transaction = null) => {
    try {
        const user = await User.findByPk(userId, { transaction });
        if (!user) {
            throw new Error('User not found');
        }

        const currentBalance = parseFloat(user.wallet_balance) || 0;
        let newBalance;

        if (operation === 'add') {
            newBalance = currentBalance + parseFloat(amount);
        } else if (operation === 'subtract') {
            newBalance = Math.max(0, currentBalance - parseFloat(amount));
        } else {
            throw new Error('Invalid operation');
        }

        await user.update({ wallet_balance: newBalance }, { transaction });
        return { success: true, newBalance };
    } catch (error) {
        console.error('Error updating wallet balance:', error);
        throw error;
    }
};

module.exports = { updateWalletBalance }; 