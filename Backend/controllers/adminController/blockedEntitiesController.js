const RateLimitService = require('../../services/rateLimitService');

// Get all blocked entities
const getBlockedEntities = async (req, res) => {
    try {
        const blocked_entities = await RateLimitService.getBlockedEntities();
        res.json({
            success: true,
            data: blocked_entities
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching blocked entities',
            error: error.message
        });
    }
};

// Unblock an entity
const unblockEntity = async (req, res) => {
    try {
        const { userId, ipAddress } = req.body;
        const adminId = req.user.id;

        if (!userId && !ipAddress) {
            return res.status(400).json({
                success: false,
                message: 'Either userId or ipAddress is required'
            });
        }

        await RateLimitService.unblockEntity(userId, ipAddress, adminId);
        res.json({
            success: true,
            message: 'Entity unblocked successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error unblocking entity',
            error: error.message
        });
    }
};

// Get violation history
const getViolationHistory = async (req, res) => {
    try {
        const { userId, ipAddress } = req.query;
        
        if (!userId && !ipAddress) {
            return res.status(400).json({
                success: false,
                message: 'Either userId or ipAddress is required'
            });
        }

        const history = await RateLimitService.getViolationHistory(userId, ipAddress);
        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error fetching violation history',
            error: error.message
        });
    }
};

module.exports = {
    getBlockedEntities,
    unblockEntity,
    getViolationHistory
}; 