const User = require('../../models/User');
const { Transaction } = require('../../models');
const { Op } = require('sequelize');
const RateLimitService = require('../../services/rateLimitService');

// Block a user
const blockUser = async (req, res) => {
    try {
        const { user_id } = req.params;
        const { reason } = req.body;
        const adminId = req.user.user_id;

        const user = await User.findByPk(user_id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Block user in both systems
        await user.update({ is_blocked: true, block_reason: reason, blocked_at: new Date() });
        await RateLimitService.blockEntity(user_id, null, 'USER', 'admin_block', reason);

        res.json({
            success: true,
            message: 'User blocked successfully',
            data: {
                userId: user.user_id,
                username: user.user_name,
                blockedAt: new Date(),
                reason: reason || 'Blocked by admin'
            }
        });
    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Unblock a user
const unblockUser = async (req, res) => {
    try {
        const { user_id } = req.params;
        const adminId = req.user.user_id;

        const user = await User.findByPk(user_id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Unblock user in both systems
        await user.update({ is_blocked: false, block_reason: null, blocked_at: null });
        await RateLimitService.unblockEntity(user_id, null, adminId);

        res.json({
            success: true,
            message: 'User unblocked successfully',
            data: {
                userId: user.user_id,
                username: user.user_name,
                unblockedAt: new Date(),
                unblockedBy: adminId
            }
        });
    } catch (error) {
        console.error('Error unblocking user:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Get blocked users list
const getBlockedUsers = async (req, res) => {
    try {
        // Get users blocked by admin
        const adminBlockedUsers = await User.findAll({
            where: { is_blocked: true },
            attributes: ['user_id', 'user_name', 'email', 'is_admin', 'updated_at']
        });

        // Get users blocked by rate limiting
        const rate_limit_blocked_users = await RateLimitService.getBlockedEntities();

        // Combine and format the results
        const blockedUsers = {
            adminBlocked: adminBlockedUsers.map(user => ({
                id: user.user_id,
                username: user.user_name,
                email: user.email,
                role: user.is_admin ? 'admin' : 'user',
                blockedAt: user.updated_at,
                blockedBy: 'admin',
                reason: 'Blocked by administrator'
            })),
            rateLimitBlocked: rate_limit_blocked_users.map(block => ({
                id: block.userId,
                blockedAt: block.blockedAt,
                reason: block.reason,
                blockedBy: 'system',
                violationType: block.violationType
            }))
        };

        res.json({
            success: true,
            data: blockedUsers
        });
    } catch (error) {
        console.error('Error fetching blocked users:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

// Update user wallet balance
const updateUserBalance = async (req, res) => {
    try {
        const { user_id } = req.params;
        const { amount, type } = req.body;
        const adminId = req.user.user_id;

        const user = await User.findByPk(user_id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Check if user is blocked
        const is_blocked = await RateLimitService.isBlocked(user_id, null);
        if (is_blocked) {
            return res.status(403).json({
                success: false,
                message: 'Cannot update balance for blocked user'
            });
        }

        // Update balance based on type (add/subtract)
        const newBalance = type === 'add' 
            ? parseFloat(user.wallet_balance) + parseFloat(amount)
            : parseFloat(user.wallet_balance) - parseFloat(amount);

        if (newBalance < 0) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance'
            });
        }

        await user.update({ wallet_balance: newBalance });

        res.json({
            success: true,
            message: 'Balance updated successfully',
            data: {
                userId: user.user_id,
                username: user.user_name,
                newBalance,
                updatedBy: adminId,
                updatedAt: new Date()
            }
        });
    } catch (error) {
        console.error('Error updating user balance:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    blockUser,
    unblockUser,
    getBlockedUsers,
    updateUserBalance
}; 