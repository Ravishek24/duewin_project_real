const { RateLimitViolation } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

class RateLimitService {
    static async checkAndRecordViolation(userId, ipAddress, endpoint, limit, timeWindow) {
        try {
            const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
            
            // Check for existing violations in the last 30 minutes
            const existingViolations = await RateLimitViolation.findAll({
                attributes: [
                    'id', 'user_id', 'ip_address', 'endpoint', 'violation_type',
                    'request_count', 'time_window', 'limit', 'is_blocked',
                    'blocked_at', 'unblocked_at', 'unblocked_by', 'reason',
                    'last_violation_at', 'created_at', 'updated_at'
                ],
                where: {
                    [Op.or]: [
                        { user_id: userId },
                        { ip_address: ipAddress }
                    ],
                    last_violation_at: {
                        [Op.gte]: thirtyMinutesAgo
                    }
                }
            });

            // Count violations for this IP and user
            const ipViolations = existingViolations.filter(v => v.ip_address === ipAddress).length;
            const userViolations = userId ? existingViolations.filter(v => v.user_id === userId).length : 0;

            // Determine violation type
            let violationType = 'IP';
            if (userId && userViolations >= 3) {
                violationType = userViolations >= 3 && ipViolations >= 3 ? 'BOTH' : 'USER';
            }

            // Create new violation record
            const violation = await RateLimitViolation.create({
                user_id: userId,
                ip_address: ipAddress,
                endpoint,
                violation_type: violationType,
                request_count: 1,
                time_window: timeWindow,
                limit,
                last_violation_at: new Date()
            });

            // Check if blocking is needed
            if (ipViolations >= 3 || (userId && userViolations >= 3)) {
                await this.blockEntity(userId, ipAddress, violationType, endpoint);
            }

            return {
                is_blocked: violation.is_blocked,
                violation_type: violationType,
                remaining_attempts: 3 - Math.max(ipViolations, userViolations)
            };
        } catch (error) {
            logger.error('Error in checkAndRecordViolation:', error);
            throw error;
        }
    }

    static async blockEntity(userId, ipAddress, violationType, endpoint) {
        try {
            const blockReason = `Rate limit exceeded: ${violationType} violation on ${endpoint}`;
            
            // Update all recent violations for this entity
            await RateLimitViolation.update(
                {
                    is_blocked: true,
                    blocked_at: new Date(),
                    reason: blockReason
                },
                {
                    where: {
                        [Op.or]: [
                            { user_id: userId },
                            { ip_address: ipAddress }
                        ],
                        last_violation_at: {
                            [Op.gte]: new Date(Date.now() - 30 * 60 * 1000)
                        }
                    }
                }
            );
        } catch (error) {
            logger.error('Error in blockEntity:', error);
            throw error;
        }
    }

    static async unblockEntity(userId, ipAddress, adminId) {
        try {
            await RateLimitViolation.update(
                {
                    is_blocked: false,
                    unblocked_at: new Date(),
                    unblocked_by: adminId
                },
                {
                    where: {
                        [Op.or]: [
                            { user_id: userId },
                            { ip_address: ipAddress }
                        ],
                        is_blocked: true
                    }
                }
            );
        } catch (error) {
            logger.error('Error in unblockEntity:', error);
            throw error;
        }
    }

    static async getBlockedEntities() {
        try {
            return await RateLimitViolation.findAll({
                attributes: [
                    'id', 'user_id', 'ip_address', 'endpoint', 'violation_type',
                    'request_count', 'time_window', 'limit', 'is_blocked',
                    'blocked_at', 'unblocked_at', 'unblocked_by', 'reason',
                    'last_violation_at', 'created_at', 'updated_at'
                ],
                where: {
                    is_blocked: true
                },
                order: [['blocked_at', 'DESC']]
            });
        } catch (error) {
            logger.error('Error in getBlockedEntities:', error);
            throw error;
        }
    }

    static async getViolationHistory(userId, ipAddress) {
        try {
            return await RateLimitViolation.findAll({
                attributes: [
                    'id', 'user_id', 'ip_address', 'endpoint', 'violation_type',
                    'request_count', 'time_window', 'limit', 'is_blocked',
                    'blocked_at', 'unblocked_at', 'unblocked_by', 'reason',
                    'last_violation_at', 'created_at', 'updated_at'
                ],
                where: {
                    [Op.or]: [
                        { user_id: userId },
                        { ip_address: ipAddress }
                    ]
                },
                order: [['last_violation_at', 'DESC']]
            });
        } catch (error) {
            logger.error('Error in getViolationHistory:', error);
            throw error;
        }
    }

    static async isBlocked(userId, ipAddress) {
        try {
            const blocked = await RateLimitViolation.findOne({
                attributes: [
                    'id', 'user_id', 'ip_address', 'endpoint', 'violation_type',
                    'request_count', 'time_window', 'limit', 'is_blocked',
                    'blocked_at', 'unblocked_at', 'unblocked_by', 'reason',
                    'last_violation_at', 'created_at', 'updated_at'
                ],
                where: {
                    [Op.or]: [
                        { user_id: userId },
                        { ip_address: ipAddress }
                    ],
                    is_blocked: true
                }
            });
            return !!blocked;
        } catch (error) {
            logger.error('Error in isBlocked:', error);
            throw error;
        }
    }
}

module.exports = RateLimitService; 