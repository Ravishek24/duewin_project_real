const { redis } = require('../config/redisConfig');
const securityConfig = require('../config/securityConfig');
const { logger } = require('../utils/logger');

class RateLimiterService {
    constructor() {
        this.rateLimits = securityConfig.rateLimits;
    }

    async checkRateLimit(key, type, socket) {
        try {
            const limit = this.rateLimits[type];
            const current = await redis.incr(key);
            
            if (current === 1) {
                await redis.expire(key, limit.duration);
            }

            // Check burst limit
            if (current > limit.points + limit.burst) {
                throw new Error(`${type} rate limit exceeded`);
            }

            return current <= limit.points;
        } catch (error) {
            logger.error('Rate limit check failed:', {
                error: error.message,
                key,
                type,
                socketId: socket?.id,
                userId: socket?.user?.id
            });
            throw error;
        }
    }

    async checkIPLimit(socket) {
        const ipKey = `ratelimit:ip:${socket.handshake.address}`;
        return this.checkRateLimit(ipKey, 'ip', socket);
    }

    async checkUserLimit(socket) {
        const userKey = `ratelimit:user:${socket.user.id}`;
        return this.checkRateLimit(userKey, 'user', socket);
    }

    async checkMessageLimit(socket, messageType) {
        const messageKey = `ratelimit:message:${socket.user.id}:${messageType}`;
        return this.checkRateLimit(messageKey, 'message', socket);
    }

    async checkConnectionLimit(socket) {
        const userConnectionsKey = `connections:user:${socket.user.id}`;
        const ipConnectionsKey = `connections:ip:${socket.handshake.address}`;

        const userConnections = await redis.incr(userConnectionsKey);
        const ipConnections = await redis.incr(ipConnectionsKey);

        if (userConnections === 1) {
            await redis.expire(userConnectionsKey, 3600); // 1 hour
        }
        if (ipConnections === 1) {
            await redis.expire(ipConnectionsKey, 3600); // 1 hour
        }

        if (userConnections > this.rateLimits.connection.maxPerUser) {
            throw new Error('User connection limit exceeded');
        }

        if (ipConnections > this.rateLimits.connection.maxPerIP) {
            throw new Error('IP connection limit exceeded');
        }

        return true;
    }

    async decrementConnectionCount(socket) {
        const userConnectionsKey = `connections:user:${socket.user.id}`;
        const ipConnectionsKey = `connections:ip:${socket.handshake.address}`;

        await redis.decr(userConnectionsKey);
        await redis.decr(ipConnectionsKey);
    }
}

module.exports = new RateLimiterService(); 