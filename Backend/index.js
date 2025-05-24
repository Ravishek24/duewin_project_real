// Backend/index.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');

// Load environment variables first
dotenv.config();

// Import database configuration
const { sequelize, connectDB } = require('./config/db');

// Import other modules
const apiRoutes = require('./routes/index');
const testRoutes = require('./routes/testRoutes');
const { errorHandler } = require('./middleware/errorHandler');
const { isWhitelisted, whitelistedIPs } = require('./config/whitelist');
const cron = require('node-cron');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const { auth, authenticateAdmin } = require('./middleware/auth');
const { globalLimiter } = require('./middleware/rateLimiter');
const helmet = require('helmet');
const morgan = require('morgan');
const { setIo } = require('./config/socketConfig');

// Create Express app
const app = express();
const PORT = process.env.SERVER_PORT || 8000;

// Create HTTP server (needed for Socket.io)
const server = http.createServer(app);

// Basic middleware setup first
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Redis client setup for scaling (optional)
let pubClient, subClient;
if (process.env.REDIS_URL) {
    try {
        pubClient = new Redis(process.env.REDIS_URL);
        subClient = pubClient.duplicate();
        console.log('✅ Redis connected for session and socket scaling');
    } catch (error) {
        console.warn('⚠️ Redis connection failed, continuing without Redis scaling:', error.message);
    }
}

// Initialize Socket.IO
const io = socketIo(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST']
    }
});

// Set io instance in socketConfig
setIo(io);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Global rate limiter (with error handling)
try {
    if (typeof globalLimiter === 'function') {
        app.use(globalLimiter);
    }
} catch (error) {
    console.warn('⚠️ Global rate limiter setup failed, continuing without it:', error.message);
}

// Main server initialization function
const startServer = async () => {
    try {
        console.log('🚀 Starting server initialization...');
        
        // Step 1: Connect to database first
        console.log('📊 Connecting to database...');
        await connectDB();
        console.log('✅ Database connection established');
        
        // Step 2: Wait a moment for connection to stabilize
        await new Promise(resolve => setTimeout(resolve, 2000)); // Increased delay
        
        // Step 3: Initialize models AFTER database connection
        console.log('🔧 Initializing models...');
        const { initializeModels } = require('./models');
        const models = await initializeModels();
        console.log('✅ Models initialized successfully');
        
        // Step 4: Wait for Sequelize to be fully initialized
        console.log('⏳ Ensuring Sequelize is fully initialized...');
        let sequelizeReady = false;
        let retries = 0;
        const maxRetries = 10; // Increased max retries
        const retryDelay = 1000;

        while (!sequelizeReady && retries < maxRetries) {
            if (sequelize && 
                sequelize.constructor && 
                sequelize.constructor.Query && 
                sequelize.constructor.Query.prototype) {
                sequelizeReady = true;
                console.log('✅ Sequelize fully initialized');
            } else {
                retries++;
                console.log(`⏳ Waiting for Sequelize initialization (attempt ${retries}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }
        }

        if (!sequelizeReady) {
            console.warn('⚠️ Sequelize initialization timed out, proceeding with caution');
        }
        
        // Step 5: Install any necessary fixes
        try {
            const { installHackFix } = require('./config/hackFix');
            const hackFixInstalled = await installHackFix(sequelize);
            if (hackFixInstalled) {
                console.log('✅ Hack fixes installed successfully');
            } else {
                console.warn('⚠️ Some hack fixes could not be installed');
            }
        } catch (error) {
            console.warn('⚠️ Hack fixes installation failed:', error.message);
        }
        
        // Step 6: Initialize payment gateways
        try {
            const paymentGatewayService = require('./services/paymentGatewayService');
            await paymentGatewayService.initializeDefaultGateways();
            console.log('✅ Payment gateways initialized');
        } catch (error) {
            console.warn('⚠️ Payment gateway initialization failed:', error.message);
        }
        
        // Step 7: Set up routes
        app.get('/', (req, res) => {
            res.json({ 
                status: 'success', 
                message: 'Server is running successfully!',
                timestamp: new Date().toISOString()
            });
        });

        // Mount API routes
        app.use('/api', apiRoutes);
        app.use('/test', testRoutes);

        // Health check route
        app.get('/health', (req, res) => {
            res.json({ 
                status: 'ok',
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });

        // Error handling middleware (must be after routes)
        app.use((err, req, res, next) => {
            console.error('Error in middleware:', err);
            errorHandler(err, req, res, next);
        });

        // Step 8: Start the HTTP server
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
            console.log(`🌐 Health check: http://0.0.0.0:${PORT}/health`);
        });

        // Step 9: Initialize background services (optional)
        try {
            // Schedule daily referral update job
            cron.schedule('0 0 * * *', async () => {
                console.log('🔄 Running daily referral update job...');
                try {
                    const { processReferrals } = require('./services/referralService');
                    await processReferrals();
                    console.log('✅ Daily referral update job completed');
                } catch (error) {
                    console.error('❌ Error in daily referral update job:', error);
                }
            });

            console.log('✅ Background services initialized');
        } catch (error) {
            console.warn('⚠️ Background services initialization failed:', error.message);
        }

        console.log('🎉 Server initialization completed successfully!');

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        console.error('Stack trace:', error.stack);
        
        // Try to close database connection before exiting
        try {
            await sequelize.close();
        } catch (closeError) {
            console.error('Error closing database connection:', closeError.message);
        }
        
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('🛑 SIGTERM received, shutting down gracefully...');
    try {
        server.close(() => {
            console.log('HTTP server closed');
        });
        await sequelize.close();
        console.log('Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

process.on('SIGINT', async () => {
    console.log('🛑 SIGINT received, shutting down gracefully...');
    try {
        server.close(() => {
            console.log('HTTP server closed');
        });
        await sequelize.close();
        console.log('Database connection closed');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // Don't exit immediately, let the application handle it
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Don't exit immediately, let the application handle it
});

// Start the server
startServer();

module.exports = app;