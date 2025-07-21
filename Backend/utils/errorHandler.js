let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }


const { logger } = require('./logger');


class ErrorHandler {
    constructor() {
        this.errorCategories = {
            AUTHENTICATION: 'authentication',
            AUTHORIZATION: 'authorization',
            RATE_LIMIT: 'rate_limit',
            VALIDATION: 'validation',
            GAME_LOGIC: 'game_logic',
            DATABASE: 'database',
            NETWORK: 'network',
            SYSTEM: 'system'
        };
    }

    categorizeError(error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return this.errorCategories.AUTHENTICATION;
        }
        if (error.message.includes('rate limit')) {
            return this.errorCategories.RATE_LIMIT;
        }
        if (error.name === 'ValidationError') {
            return this.errorCategories.VALIDATION;
        }
        if (error.message.includes('game')) {
            return this.errorCategories.GAME_LOGIC;
        }
        if (error.name === 'SequelizeError') {
            return this.errorCategories.DATABASE;
        }
        if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
            return this.errorCategories.NETWORK;
        }
        return this.errorCategories.SYSTEM;
    }

    async handleError(socket, error, context) {
        const category = this.categorizeError(error);
        const errorId = this.generateErrorId();

        // Log error with structured data
        logger.error({
            errorId,
            category,
            message: error.message,
            stack: error.stack,
            context,
            userId: socket?.user?.id,
            socketId: socket?.id,
            timestamp: new Date().toISOString()
        });

        // Store error in Redis for monitoring
        await this.storeError(errorId, {
            category,
            message: error.message,
            context,
            userId: socket?.user?.id,
            socketId: socket?.id,
            timestamp: new Date().toISOString()
        });

        // Notify admins for critical errors
        if (this.isCriticalError(category)) {
            await this.notifyAdmins(errorId, category, error.message);
        }

        // Send appropriate response to client
        this.sendErrorResponse(socket, error, category);
    }

    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    async storeError(errorId, errorData) {
        try {
            await redis.hset(`errors:${errorId}`, errorData);
            await redis.expire(`errors:${errorId}`, 86400); // Store for 24 hours
        } catch (error) {
            logger.error('Failed to store error:', error);
        }
    }

    isCriticalError(category) {
        return [
            this.errorCategories.SYSTEM,
            this.errorCategories.DATABASE,
            this.errorCategories.GAME_LOGIC
        ].includes(category);
    }

    async notifyAdmins(errorId, category, message) {
        try {
            // Implement admin notification logic here
            // This could be email, SMS, or integration with monitoring services
            logger.info('Admin notification sent:', { errorId, category, message });
        } catch (error) {
            logger.error('Failed to notify admins:', error);
        }
    }

    sendErrorResponse(socket, error, category) {
        if (!socket) return;

        const response = {
            success: false,
            error: {
                category,
                message: this.getClientMessage(error, category)
            }
        };

        if (error.isOperational) {
            socket.emit('error', response);
        } else {
            socket.emit('error', {
                success: false,
                error: {
                    category: this.errorCategories.SYSTEM,
                    message: 'An unexpected error occurred'
                }
            });
        }

        if (error.requiresDisconnect) {
            socket.disconnect(true);
        }
    }

    getClientMessage(error, category) {
        switch (category) {
            case this.errorCategories.AUTHENTICATION:
                return 'Authentication failed';
            case this.errorCategories.AUTHORIZATION:
                return 'Access denied';
            case this.errorCategories.RATE_LIMIT:
                return 'Rate limit exceeded';
            case this.errorCategories.VALIDATION:
                return 'Invalid input';
            case this.errorCategories.GAME_LOGIC:
                return 'Game error occurred';
            default:
                return 'An unexpected error occurred';
        }
    }
}

module.exports = new ErrorHandler(); 
module.exports.setRedisHelper = setRedisHelper;
