// Fastify version of referral routes
const fastify = require('fastify')({ logger: true });

// Import the same services and controllers
const {
    getDirectReferralsController,
    getTeamReferralsController,
    getDirectReferralDepositsController,
    getTeamReferralDepositsController,
    getCommissionEarningsController,
    getReferralTreeDetailsController,
    recordAttendanceController,
    getDirectReferralAnalyticsController,
    getTeamReferralAnalyticsController,
    getTeamReferralsForAdminController
} = require('./controllers/referralController');

const referralService = require('./services/referralService');

// Fastify schema definitions for validation
const referralSchemas = {
    // Schema for attendance claim
    attendanceClaimSchema: {
        type: 'object',
        required: ['attendanceDate'],
        properties: {
            attendanceDate: {
                type: 'string',
                format: 'date'
            }
        }
    },
    
    // Response schemas
    successResponseSchema: {
        type: 'object',
        properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' }
        }
    },
    
    errorResponseSchema: {
        type: 'object',
        properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            error: { type: 'string' }
        }
    }
};

// Authentication hook (equivalent to Express middleware)
async function authenticate(request, reply) {
    try {
        const token = request.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return reply.code(401).send({
                success: false,
                message: 'No token provided'
            });
        }

        // Import JWT and verify token
        const jwt = require('jsonwebtoken');
        const config = require('./config/config');
        
        const decoded = jwt.verify(token, config.jwtSecret);
        request.user = decoded;
        
    } catch (error) {
        return reply.code(401).send({
            success: false,
            message: 'Invalid token'
        });
    }
}

// Phone verification hook
async function requirePhoneVerification(request, reply) {
    if (!request.user.is_phone_verified) {
        return reply.code(403).send({
            success: false,
            message: 'Phone verification required'
        });
    }
}

// Register referral routes
async function referralRoutes(fastify, options) {
    
    // Direct referrals
    fastify.get('/direct', {
        preHandler: authenticate,
        schema: {
            response: {
                200: referralSchemas.successResponseSchema,
                401: referralSchemas.errorResponseSchema
            }
        }
    }, async (request, reply) => {
        try {
            const result = await getDirectReferralsController(request, reply);
            return result;
        } catch (error) {
            fastify.log.error('Error in direct referrals:', error);
            return reply.code(500).send({
                success: false,
                message: 'Server error'
            });
        }
    });

    // Team referrals
    fastify.get('/team', {
        preHandler: authenticate,
        schema: {
            response: {
                200: referralSchemas.successResponseSchema,
                401: referralSchemas.errorResponseSchema
            }
        }
    }, async (request, reply) => {
        try {
            const result = await getTeamReferralsController(request, reply);
            return result;
        } catch (error) {
            fastify.log.error('Error in team referrals:', error);
            return reply.code(500).send({
                success: false,
                message: 'Server error'
            });
        }
    });

    // Direct referral deposits
    fastify.get('/direct/deposits', {
        preHandler: authenticate,
        schema: {
            response: {
                200: referralSchemas.successResponseSchema,
                401: referralSchemas.errorResponseSchema
            }
        }
    }, async (request, reply) => {
        try {
            const result = await getDirectReferralDepositsController(request, reply);
            return result;
        } catch (error) {
            fastify.log.error('Error in direct referral deposits:', error);
            return reply.code(500).send({
                success: false,
                message: 'Server error'
            });
        }
    });

    // Team referral deposits
    fastify.get('/team/deposits', {
        preHandler: authenticate,
        schema: {
            response: {
                200: referralSchemas.successResponseSchema,
                401: referralSchemas.errorResponseSchema
            }
        }
    }, async (request, reply) => {
        try {
            const result = await getTeamReferralDepositsController(request, reply);
            return result;
        } catch (error) {
            fastify.log.error('Error in team referral deposits:', error);
            return reply.code(500).send({
                success: false,
                message: 'Server error'
            });
        }
    });

    // Commission earnings
    fastify.get('/commissions', {
        preHandler: authenticate,
        schema: {
            response: {
                200: referralSchemas.successResponseSchema,
                401: referralSchemas.errorResponseSchema
            }
        }
    }, async (request, reply) => {
        try {
            const result = await getCommissionEarningsController(request, reply);
            return result;
        } catch (error) {
            fastify.log.error('Error in commission earnings:', error);
            return reply.code(500).send({
                success: false,
                message: 'Server error'
            });
        }
    });

    // Referral tree details
    fastify.get('/tree', {
        preHandler: authenticate,
        schema: {
            response: {
                200: referralSchemas.successResponseSchema,
                401: referralSchemas.errorResponseSchema
            }
        }
    }, async (request, reply) => {
        try {
            const result = await getReferralTreeDetailsController(request, reply);
            return result;
        } catch (error) {
            fastify.log.error('Error in referral tree:', error);
            return reply.code(500).send({
                success: false,
                message: 'Server error'
            });
        }
    });

    // Analytics routes
    fastify.get('/analytics/direct', {
        preHandler: authenticate,
        schema: {
            response: {
                200: referralSchemas.successResponseSchema,
                401: referralSchemas.errorResponseSchema
            }
        }
    }, async (request, reply) => {
        try {
            const result = await getDirectReferralAnalyticsController(request, reply);
            return result;
        } catch (error) {
            fastify.log.error('Error in direct analytics:', error);
            return reply.code(500).send({
                success: false,
                message: 'Server error'
            });
        }
    });

    fastify.get('/analytics/team', {
        preHandler: authenticate,
        schema: {
            response: {
                200: referralSchemas.successResponseSchema,
                401: referralSchemas.errorResponseSchema
            }
        }
    }, async (request, reply) => {
        try {
            const result = await getTeamReferralAnalyticsController(request, reply);
            return result;
        } catch (error) {
            fastify.log.error('Error in team analytics:', error);
            return reply.code(500).send({
                success: false,
                message: 'Server error'
            });
        }
    });

    // Admin team referrals
    fastify.get('/admin/team', {
        preHandler: authenticate,
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    target_user_id: { type: 'string' },
                    start_date: { type: 'string', format: 'date' },
                    end_date: { type: 'string', format: 'date' },
                    page: { type: 'integer', minimum: 1, default: 1 },
                    limit: { type: 'integer', minimum: 1, maximum: 50, default: 5 }
                },
                required: ['target_user_id']
            },
            response: {
                200: referralSchemas.successResponseSchema,
                400: referralSchemas.errorResponseSchema,
                401: referralSchemas.errorResponseSchema,
                403: referralSchemas.errorResponseSchema,
                500: referralSchemas.errorResponseSchema
            }
        }
    }, async (request, reply) => {
        try {
            const result = await getTeamReferralsForAdminController(request, reply);
            return result;
        } catch (error) {
            fastify.log.error('Error in admin team referrals:', error);
            return reply.code(500).send({
                success: false,
                message: 'Server error'
            });
        }
    });

    // Attendance bonus endpoints
    fastify.post('/attendance', {
        preHandler: authenticate,
        schema: {
            response: {
                200: referralSchemas.successResponseSchema,
                400: referralSchemas.errorResponseSchema,
                401: referralSchemas.errorResponseSchema,
                500: referralSchemas.errorResponseSchema
            }
        }
    }, async (request, reply) => {
        try {
            fastify.log.info('📅 DEBUG: Attendance route hit');
            const userId = request.user.user_id;
            fastify.log.info('🆔 User ID:', userId);
            
            if (!referralService || !referralService.recordAttendance) {
                return reply.code(500).send({
                    success: false,
                    message: 'Attendance service not available'
                });
            }
            
            const result = await referralService.recordAttendance(userId);
            fastify.log.info('📋 Attendance result:', result);

            if (result.success) {
                return reply.code(200).send(result);
            } else {
                return reply.code(400).send(result);
            }
        } catch (error) {
            fastify.log.error('💥 Error in attendance route:', error);
            return reply.code(500).send({
                success: false,
                message: 'Server error recording attendance',
                debug: { error: error.message }
            });
        }
    });

    fastify.get('/attendance/unclaimed', {
        preHandler: [authenticate, requirePhoneVerification],
        schema: {
            response: {
                200: referralSchemas.successResponseSchema,
                400: referralSchemas.errorResponseSchema,
                401: referralSchemas.errorResponseSchema,
                403: referralSchemas.errorResponseSchema,
                500: referralSchemas.errorResponseSchema
            }
        }
    }, async (request, reply) => {
        try {
            fastify.log.info('📅 DEBUG: Unclaimed attendance route hit');
            const userId = request.user.user_id;
            
            if (!referralService || !referralService.getUnclaimedAttendanceBonuses) {
                return reply.code(500).send({
                    success: false,
                    message: 'Attendance service not available'
                });
            }
            
            const result = await referralService.getUnclaimedAttendanceBonuses(userId);

            if (result.success) {
                return reply.code(200).send(result);
            } else {
                return reply.code(400).send(result);
            }
        } catch (error) {
            fastify.log.error('💥 Error in unclaimed attendance route:', error);
            return reply.code(500).send({
                success: false,
                message: 'Server error getting unclaimed bonuses',
                debug: { error: error.message }
            });
        }
    });

    fastify.post('/attendance/claim', {
        preHandler: authenticate,
        schema: {
            body: referralSchemas.attendanceClaimSchema,
            response: {
                200: referralSchemas.successResponseSchema,
                400: referralSchemas.errorResponseSchema,
                401: referralSchemas.errorResponseSchema,
                500: referralSchemas.errorResponseSchema
            }
        }
    }, async (request, reply) => {
        try {
            fastify.log.info('📅 DEBUG: Claim attendance route hit');
            const userId = request.user.user_id;
            const { attendanceDate } = request.body;
            
            if (!referralService || !referralService.claimAttendanceBonus) {
                return reply.code(500).send({
                    success: false,
                    message: 'Attendance service not available'
                });
            }

            const result = await referralService.claimAttendanceBonus(userId, attendanceDate);

            if (result.success) {
                return reply.code(200).send(result);
            } else {
                return reply.code(400).send(result);
            }
        } catch (error) {
            fastify.log.error('💥 Error in claim attendance route:', error);
            return reply.code(500).send({
                success: false,
                message: 'Server error claiming bonus',
                debug: { error: error.message }
            });
        }
    });

    // Invitation bonus endpoints
    fastify.get('/invitation/status', {
        preHandler: authenticate,
        schema: {
            response: {
                200: referralSchemas.successResponseSchema,
                400: referralSchemas.errorResponseSchema,
                401: referralSchemas.errorResponseSchema,
                500: referralSchemas.errorResponseSchema
            }
        }
    }, async (request, reply) => {
        try {
            fastify.log.info('🎁 DEBUG: Invitation status route hit');
            const userId = request.user.user_id;
            fastify.log.info('🆔 User ID:', userId);
            
            if (!referralService || !referralService.getInvitationBonusStatus) {
                return reply.code(500).send({
                    success: false,
                    message: 'Invitation service not available'
                });
            }
            
            const result = await referralService.getInvitationBonusStatus(userId);
            fastify.log.info('📋 Invitation status result:', result);
            
            if (result.success) {
                return reply.code(200).send(result);
            } else {
                return reply.code(400).send(result);
            }
        } catch (error) {
            fastify.log.error('💥 Error in invitation status route:', error);
            return reply.code(500).send({
                success: false,
                message: 'Server error getting invitation status',
                debug: { error: error.message }
            });
        }
    });

    fastify.post('/invitation/claim', {
        preHandler: authenticate,
        schema: {
            response: {
                200: referralSchemas.successResponseSchema,
                400: referralSchemas.errorResponseSchema,
                401: referralSchemas.errorResponseSchema,
                500: referralSchemas.errorResponseSchema
            }
        }
    }, async (request, reply) => {
        try {
            fastify.log.info('🎁 DEBUG: Invitation claim route hit');
            const userId = request.user.user_id;
            fastify.log.info('🆔 User ID:', userId);
            
            if (!referralService || !referralService.claimInvitationBonus) {
                return reply.code(500).send({
                    success: false,
                    message: 'Invitation service not available'
                });
            }
            
            const result = await referralService.claimInvitationBonus(userId);
            fastify.log.info('📋 Invitation claim result:', result);
            
            if (result.success) {
                return reply.code(200).send(result);
            } else {
                return reply.code(400).send(result);
            }
        } catch (error) {
            fastify.log.error('💥 Error in invitation claim route:', error);
            return reply.code(500).send({
                success: false,
                message: 'Server error claiming invitation bonus',
                debug: { error: error.message }
            });
        }
    });

    // 🆕 NEW: Get invitation reward history
    fastify.get('/invitation/history', {
        preHandler: authenticate,
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'number', minimum: 1, default: 1 },
                    limit: { type: 'number', minimum: 1, maximum: 100, default: 10 }
                }
            },
            response: {
                200: referralSchemas.successResponseSchema,
                400: referralSchemas.errorResponseSchema,
                401: referralSchemas.errorResponseSchema,
                500: referralSchemas.errorResponseSchema
            }
        }
    }, async (request, reply) => {
        try {
            fastify.log.info('🎁 DEBUG: Invitation reward history route hit');
            const userId = request.user.user_id;
            const page = parseInt(request.query.page) || 1;
            const limit = parseInt(request.query.limit) || 10;
            
            fastify.log.info('🆔 User ID:', userId, 'Page:', page, 'Limit:', limit);
            
            if (!referralService || !referralService.getInvitationRewardHistory) {
                return reply.code(500).send({
                    success: false,
                    message: 'Invitation history service not available'
                });
            }
            
            const result = await referralService.getInvitationRewardHistory(userId, page, limit);
            fastify.log.info('📋 Invitation history result:', result);
            
            if (result.success) {
                return reply.code(200).send(result);
            } else {
                return reply.code(400).send(result);
            }
        } catch (error) {
            fastify.log.error('💥 Error in invitation history route:', error);
            return reply.code(500).send({
                success: false,
                message: 'Server error getting invitation reward history',
                debug: { error: error.message }
            });
        }
    });

    // 🆕 NEW: Get valid referral history
    fastify.get('/valid/history', {
        preHandler: authenticate,
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    page: { type: 'number', minimum: 1, default: 1 },
                    limit: { type: 'number', minimum: 1, maximum: 100, default: 10 }
                }
            },
            response: {
                200: referralSchemas.successResponseSchema,
                400: referralSchemas.errorResponseSchema,
                401: referralSchemas.errorResponseSchema,
                500: referralSchemas.errorResponseSchema
            }
        }
    }, async (request, reply) => {
        try {
            fastify.log.info('👥 DEBUG: Valid referral history route hit');
            const userId = request.user.user_id;
            const page = parseInt(request.query.page) || 1;
            const limit = parseInt(request.query.limit) || 10;
            
            fastify.log.info('🆔 User ID:', userId, 'Page:', page, 'Limit:', limit);
            
            if (!referralService || !referralService.getValidReferralHistory) {
                return reply.code(500).send({
                    success: false,
                    message: 'Valid referral history service not available'
                });
            }
            
            const result = await referralService.getValidReferralHistory(userId, page, limit);
            fastify.log.info('📋 Valid referral history result:', result);
            
            if (result.success) {
                return reply.code(200).send(result);
            } else {
                return reply.code(400).send(result);
            }
        } catch (error) {
            fastify.log.error('💥 Error in valid referral history route:', error);
            return reply.code(500).send({
                success: false,
                message: 'Server error getting valid referral history',
                debug: { error: error.message }
            });
        }
    });
}

module.exports = referralRoutes; 