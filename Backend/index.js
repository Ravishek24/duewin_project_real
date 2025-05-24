// Backend/index.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const { sequelize } = require('./config/db');
const { initializeModels } = require('./models');
const { installHackFix } = require('./config/hackFix');
const { purgeForeignKeys } = require('./config/foreignKeyPurge');
const { prepareDatabase } = require('./config/databasePreparation');
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

// Load environment variables early
dotenv.config();

// Redis client setup for scaling
let pubClient, subClient;
if (process.env.REDIS_URL) {
    pubClient = new Redis(process.env.REDIS_URL);
    subClient = pubClient.duplicate();
    console.log('✅ Redis connected for session and socket scaling');
}

// Create Express app
const app = express();
const PORT = process.env.SERVER_PORT || 8000;

// Create HTTP server (needed for Socket.io)
const server = http.createServer(app);

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
    logger.info('New client connected:', { socketId: socket.id });

    socket.on('disconnect', () => {
        logger.info('Client disconnected:', { socketId: socket.id });
    });

    // Add other socket event handlers here
});

// Basic middleware
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Security middleware
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global rate limiter
if (typeof globalLimiter === 'function') {
    app.use(globalLimiter);
} else {
    console.warn('⚠️ Global rate limiter is not a function, skipping...');
}

// Initialize models before starting the server
const startServer = async () => {
    try {
        // Initialize models first
        await initializeModels();
        console.log('✅ Models initialized successfully');
        
        // Wait for models to be fully initialized
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Install hack fixes after database connection and model initialization
        installHackFix(sequelize);
        console.log('✅ Hack fixes installed');
        
        // Wait for hack fixes to be installed
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Purge problematic foreign keys after model initialization
        await purgeForeignKeys();
        console.log('✅ Foreign key purge completed');
        
        // Fix any database issues after model initialization
        await prepareDatabase();
        console.log('✅ Database preparation completed');
        
        // Wait for database preparation to complete
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Import any services that need database initialization
        const paymentGatewayService = require('./services/paymentGatewayService');
        
        // Initialize default payment gateways if they don't exist
        try {
            await paymentGatewayService.initializeDefaultGateways();
            console.log('✅ Payment gateways initialized');
        } catch (error) {
            console.error('⚠️ Error initializing payment gateways:', error.message);
        }
        
        // Initialize WebSocket server after database and models are ready
        const { initializeWebSocket } = require('./controllers/adminController/wingoGameController');
        
        // Use Redis adapter for WebSocket if Redis is available
        if (pubClient && subClient) {
            const io = initializeWebSocket(server, { adapter: createAdapter(pubClient, subClient) });
            console.log('✅ WebSocket server initialized with Redis adapter for scaling');
        } else {
            initializeWebSocket(server);
            console.log('✅ WebSocket server initialized');
        }
        
        // Set up routes
        app.get('/', (req, res) => {
            res.send('Server is running successfully!');
        });

        // Mount API routes index (which includes all routes)
        app.use('/api', apiRoutes);

        // Test routes
        app.use('/test', testRoutes);

        // Health check route
        app.get('/health', (req, res) => {
            res.json({ status: 'ok' });
        });

        // Error handling middleware (must be after routes)
        app.use((err, req, res, next) => {
            console.error('Error in middleware:', err);
            errorHandler(err, req, res, next);
        });

        // Start the server
        server.listen(PORT, () => {
            console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
        });

        // Schedule daily referral update job
        cron.schedule('0 0 * * *', async () => {
            console.log('Running daily referral update job...');
            try {
                const { processReferrals } = require('./services/referralService');
                await processReferrals();
                console.log('✅ Daily referral update job completed successfully');
            } catch (error) {
                console.error('❌ Error in daily referral update job:', error);
            }
        });

        // Run initial referral update
        try {
            const { processReferrals } = require('./services/referralService');
            await processReferrals();
            console.log('✅ Initial referral update completed successfully');
        } catch (error) {
            console.error('❌ Error in initial referral update:', error);
        }

        // Initialize game scheduler
        try {
            const { startGameScheduler } = require('./scripts/gameScheduler');
            await startGameScheduler();
            console.log('✅ Game scheduler initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing game scheduler:', error);
        }

        // Initialize TRON hash collection
        try {
            const tronHashService = require('./services/tronHashService');
            console.log('Initializing TRON hash collection...');
            await tronHashService.startHashCollection();
            console.log('✅ TRON hash collection initialized');
        } catch (error) {
            console.error('❌ Error initializing TRON hash collection:', error);
        }

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;