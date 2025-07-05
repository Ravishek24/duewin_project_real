// Fastify server implementation
const fastify = require('fastify')({ 
    logger: true,
    trustProxy: true
});

// Import route modules
const referralRoutes = require('./fastify-referral-routes');
const gameRoutes = require('./fastify-game-routes');

// Import necessary plugins and configurations
const config = require('./config/config');

// Register CORS plugin
fastify.register(require('@fastify/cors'), {
    origin: true,
    credentials: true
});

// Register rate limiting plugin
fastify.register(require('@fastify/rate-limit'), {
    max: 100,
    timeWindow: '1 minute',
    redis: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password
    }
});

// Register helmet for security headers
fastify.register(require('@fastify/helmet'), {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
});

// Health check route
fastify.get('/health', async (request, reply) => {
    return {
        success: true,
        message: 'Fastify API is healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    };
});

// Register route modules
fastify.register(referralRoutes, { prefix: '/referral' });
fastify.register(gameRoutes, { prefix: '/games' });

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
    fastify.log.error(error);
    
    // Handle validation errors
    if (error.validation) {
        return reply.code(400).send({
            success: false,
            message: 'Validation error',
            errors: error.validation
        });
    }
    
    // Handle JWT errors
    if (error.name === 'JsonWebTokenError') {
        return reply.code(401).send({
            success: false,
            message: 'Invalid token'
        });
    }
    
    // Handle other errors
    return reply.code(500).send({
        success: false,
        message: 'Internal server error'
    });
});

// Not found handler
fastify.setNotFoundHandler((request, reply) => {
    return reply.code(404).send({
        success: false,
        message: 'Route not found'
    });
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    fastify.log.info(`Received ${signal}. Starting graceful shutdown...`);
    
    try {
        await fastify.close();
        fastify.log.info('Fastify server closed');
        process.exit(0);
    } catch (error) {
        fastify.log.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const start = async () => {
    try {
        const port = process.env.PORT || 3000;
        const host = process.env.HOST || '0.0.0.0';
        
        await fastify.listen({ port, host });
        fastify.log.info(`Fastify server listening on ${host}:${port}`);
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

// Export for testing
module.exports = fastify;

// Start server if this file is run directly
if (require.main === module) {
    start();
} 