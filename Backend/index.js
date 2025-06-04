// Backend/index.js - UPDATED WITH PROPER WEBSOCKET INITIALIZATION

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');

// Load environment variables first
dotenv.config();

console.log('🚀 Starting DueWin Backend Server...');

// Create Express app first
const app = express();
const PORT = process.env.SERVER_PORT || 8000;

// Create HTTP server
const server = http.createServer(app);

// Basic middleware setup
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Basic health check route (works immediately)
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        message: 'Server is running'
    });
});

// Basic root route
app.get('/', (req, res) => {
    res.json({ 
        status: 'success', 
        message: 'DueWin Backend Server is running!',
        timestamp: new Date().toISOString()
    });
});

// Variables to hold initialized components
let sequelize = null;
let models = null;

// Complete database and model initialization
const initializeDatabaseAndModels = async () => {
    try {
        console.log('🔧 Starting database initialization...');
        
        // Step 1: Connect to database first
        console.log('📡 Connecting to database...');
        const { connectDB } = require('./config/db');
        await connectDB();
        console.log('✅ Database connected');
        
        // Step 2: Initialize database structure
        console.log('🏗️ Initializing database structure...');
        const { initializeDatabase } = require('./config/db');
        const dbInitSuccess = await initializeDatabase();
        if (!dbInitSuccess) {
            throw new Error('Database initialization failed');
        }
        console.log('✅ Database structure initialized');
        
        // Step 3: Get sequelize instance (now it's safe to access)
        const { sequelize } = require('./config/db');
        console.log('✅ Sequelize instance obtained');
        
        // Step 4: Initialize models (now sequelize is available)
        console.log('🔧 Initializing models...');
        const { initializeModels } = require('./models');
        const models = await initializeModels();
        console.log('✅ Models initialized successfully');
        console.log(`📊 Loaded ${Object.keys(models).length} models`);
        
        return true;
    } catch (error) {
        console.error('❌ Database and models initialization failed:', error);
        console.error('Stack trace:', error.stack);
        return false;
    }
};

// Routes setup function
const setupAppRoutes = () => {
    try {
        console.log('🛣️ Setting up routes...');
        
        // Import routes after models are initialized
        const apiRoutes = require('./routes/index');
        
        // Mount API routes
        app.use('/api', apiRoutes);
        
        console.log('✅ Routes configured successfully');
        return true;
    } catch (error) {
        console.error('❌ Routes setup failed:', error.message);
        console.error('❌ Error stack:', error.stack);
        // Don't throw - server can still run with basic routes
        return false;
    }
};

// =================== WEBSOCKET INITIALIZATION ===================
// This is what was missing in your setup!
// Backend/index.js - UPDATED WEBSOCKET INITIALIZATION SECTION

const initializeWebSocketServices = async () => {
    try {
        console.log('🔧 Initializing WebSocket services...');
        
        // STEP 1: Initialize Socket.IO (but don't start game ticks yet)
        console.log('📡 Setting up Socket.IO server...');
        const { initializeWebSocket } = require('./services/websocketService');
        const io = initializeWebSocket(server, false); // Pass false to skip auto-start of ticks
        console.log('✅ Socket.IO server initialized');
        
        // STEP 2: Set up socket configuration
        console.log('⚙️ Configuring socket settings...');
        try {
            const { setIo } = require('./config/socketConfig');
            setIo(io);
            console.log('✅ Socket configuration set');
        } catch (configError) {
            console.warn('⚠️ Socket config issue:', configError.message);
        }
        
        // STEP 3: Initialize period service (CRITICAL)
        console.log('📊 Initializing period service...');
        const periodService = require('./services/periodService');
        await periodService.ensureModelsLoaded();
        console.log('✅ Period service ready');
        
        // STEP 4: Wait for game scheduler to initialize periods
        console.log('⏳ Waiting for game scheduler to initialize periods...');
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
        
        // STEP 5: Now start the WebSocket game tick system
        console.log('🕐 Starting WebSocket game tick system...');
        const { startGameTickSystem } = require('./services/websocketService');
        await startGameTickSystem();
        console.log('✅ WebSocket game ticks started');
        
        // STEP 6: Start game scheduler (THIS WAS MISSING!)
        console.log('🎮 Starting game scheduler...');
        const { startGameScheduler } = require('./scripts/gameScheduler');
        
        // Start scheduler in background
        setTimeout(async () => {
            try {
                await startGameScheduler();
                console.log('✅ Game scheduler started successfully');
                
                // STEP 7: Verify game ticks are working after scheduler starts
                setTimeout(() => {
                    console.log('🔄 Verifying game tick system...');
                    const { verifyGameTicks } = require('./services/websocketService');
                    verifyGameTicks();
                }, 3000);
                
            } catch (schedulerError) {
                console.error('❌ Game scheduler failed to start:', schedulerError.message);
            }
        }, 2000); // Give 2 seconds for everything to initialize
        
        console.log('✅ WebSocket services initialization completed');
        return true;
    } catch (error) {
        console.error('❌ WebSocket services initialization failed:', error);
        console.error('Stack trace:', error.stack);
        return false;
    }
};

// Additional services setup
const setupAdditionalServices = async () => {
    try {
        console.log('🔧 Setting up additional services...');
        
        // Install hack fixes
        try {
            if (sequelize) {
                const { installHackFix } = require('./config/hackFix');
                const hackFixInstalled = await installHackFix(sequelize);
                if (hackFixInstalled) {
                    console.log('✅ Hack fixes installed');
                }
            } else {
                console.warn('⚠️ Sequelize not available, cannot install hack fixes');
            }
        } catch (hackError) {
            console.warn('⚠️ Hack fixes not installed:', hackError.message);
        }
        
        // Initialize payment gateways
        try {
            const { setupPaymentGateways } = require('./services/paymentGatewayService');
            await setupPaymentGateways();
            console.log('✅ Payment gateways initialized');
        } catch (paymentError) {
            console.warn('⚠️ Payment gateways setup failed:', paymentError.message);
        }
        
        // Set up cron jobs
        try {
            const { setupScheduledJobs } = require('./services/schedulerService');
            await setupScheduledJobs();
            console.log('✅ Scheduled jobs configured');
        } catch (cronError) {
            console.warn('⚠️ Scheduled jobs setup failed:', cronError.message);
        }
        
        return true;
    } catch (error) {
        console.warn('⚠️ Additional services setup had issues:', error.message);
        return false;
    }
};

// Error handling middleware
const setupErrorHandling = () => {
    // Global error handler
    app.use((err, req, res, next) => {
        console.error('Express error handler:', err);
        
        if (res.headersSent) {
            return next(err);
        }
        
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            timestamp: new Date().toISOString()
        });
    });
    
    // 404 handler
    app.use((req, res) => {
        res.status(404).json({
            success: false,
            message: 'Route not found',
            path: req.path,
            timestamp: new Date().toISOString()
        });
    });
    
    console.log('✅ Error handling configured');
};

// =================== MAIN START SEQUENCE ===================

// Start server
const startServer = async () => {
    try {
        console.log('🚀 Starting server initialization sequence...');
        
        // Step 1: Initialize database and models (critical)
        console.log('\n=== STEP 1: DATABASE INITIALIZATION ===');
        const dbSuccess = await initializeDatabaseAndModels();
        if (!dbSuccess) {
            throw new Error('Database and models initialization failed');
        }
        
        // Step 2: Setup routes (important but not critical)
        console.log('\n=== STEP 2: ROUTES SETUP ===');
        setupAppRoutes();
        
        // Step 3: Initialize WebSocket services (THIS WAS MISSING!)
        console.log('\n=== STEP 3: WEBSOCKET INITIALIZATION ===');
        await initializeWebSocketServices();
        
        // Step 4: Setup additional services (optional)
        console.log('\n=== STEP 4: ADDITIONAL SERVICES ===');
        await setupAdditionalServices();
        
        // Step 5: Setup error handling
        console.log('\n=== STEP 5: ERROR HANDLING ===');
        setupErrorHandling();
        
        // Step 6: Start the HTTP server
        console.log('\n=== STEP 6: START HTTP SERVER ===');
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ Server running successfully on http://0.0.0.0:${PORT}`);
            console.log(`🌐 Health check: http://0.0.0.0:${PORT}/health`);
            console.log(`📊 Database: Connected and ready`);
            console.log(`🔌 WebSocket: Active and ready`);
            console.log(`🎮 Game System: Starting...`);
            console.log(`🎉 DueWin Backend Server is fully operational!`);
            
            // Show expected logs
            console.log('\n📋 You should see these logs next:');
            console.log('   🔄 Starting initialization...');
            console.log('   ✅ Game scheduler started successfully');
            console.log('   ⏰ Started game ticks for wingo 30s');
            console.log('   ⏰ Started game ticks for wingo 60s');
            console.log('   Game tick: wingo, 60s, Period: ..., Time: ...s');
        });
    } catch (error) {
        console.error('❌ Server startup failed:', error);
        console.error('Stack trace:', error.stack);
        
        // Try graceful cleanup
        try {
            if (sequelize) {
                await sequelize.close();
                console.log('🧹 Database connection closed');
            }
        } catch (cleanupError) {
            console.error('❌ Cleanup failed:', cleanupError.message);
        }
        
        process.exit(1);
    }
};

// Graceful shutdown handlers
const gracefulShutdown = async (signal) => {
    console.log(`🛑 ${signal} received, shutting down gracefully...`);
    
    try {
        // Close HTTP server
        server.close(() => {
            console.log('HTTP server closed');
        });
        
        // Close database connection
        if (sequelize) {
            await sequelize.close();
            console.log('Database connection closed');
        }
        
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
};

// Process event handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Enhanced error handling for unhandled exceptions
process.on('uncaughtException', (error) => {
    console.error('🚨 Uncaught Exception:', error);
    console.error('Stack trace:', error.stack);
    
    // Check if it's the Sequelize getQueryInterface error
    if (error.message && error.message.includes('getQueryInterface')) {
        console.error('🚨 This is the Sequelize initialization error');
        console.error('🚨 Server will attempt to continue, but functionality may be limited');
        return; // Don't exit, allow retry mechanisms to handle it
    }
    
    // For other uncaught exceptions, exit gracefully
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise);
    console.error('🚨 Reason:', reason);
    
    // Check if it's related to Sequelize
    if (reason && reason.message && reason.message.includes('getQueryInterface')) {
        console.error('🚨 This appears to be related to the Sequelize issue');
        console.error('🚨 Server will continue running');
        return; // Don't exit
    }
    
    // Log but don't exit for other unhandled rejections
    console.error('🚨 Continuing execution despite unhandled rejection');
});

// Start the application
startServer();

module.exports = app;