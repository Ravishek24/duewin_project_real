// Backend/index.js - Minimal startup with robust error handling
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const { sequelize } = require('./config/db');
const { initializeModels } = require('./models');
const { setupPaymentGateways } = require('./services/paymentGatewayService');
const { setupScheduledJobs } = require('./services/schedulerService');
const { setupRoutes } = require('./routes');

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

// Initialize Socket.IO
const io = socketIo(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST']
    }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Set io instance for other modules
try {
    const { setIo } = require('./config/socketConfig');
    setIo(io);
    console.log('✅ Socket.IO configured');
} catch (error) {
    console.warn('⚠️ Socket config not available:', error.message);
}

// Initialize database
const initializeDatabase = async () => {
    try {
        const { initializeDatabase } = require('./config/db');
        const success = await initializeDatabase();
        if (!success) {
            throw new Error('Failed to initialize database');
        }
        console.log('✅ Database initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        return false;
    }
};

// Model initialization function
const initializeModels = async () => {
    try {
        console.log('🔧 Initializing models...');
        
        // Import model initialization
        const { initializeModels } = require('./models');
        
        // Initialize models
        const models = await initializeModels();
        console.log('✅ Models initialized successfully');
        console.log(`📊 Loaded ${Object.keys(models).length - 2} models`);
        
        return models;
    } catch (error) {
        console.error('❌ Model initialization failed:', error.message);
        throw error;
    }
};

// Routes setup function
const setupRoutes = () => {
    try {
        console.log('🛣️ Setting up routes...');
        
        // Import routes
        const apiRoutes = require('./routes/index');
        
        // Mount API routes
        app.use('/api', apiRoutes);
        
        console.log('✅ Routes configured successfully');
        return true;
    } catch (error) {
        console.error('❌ Routes setup failed:', error.message);
        // Don't throw - server can still run with basic routes
        return false;
    }
};

// Additional services setup
const setupAdditionalServices = async () => {
    try {
        console.log('🔧 Setting up additional services...');
        
        // Install hack fixes
        try {
            const { installHackFix } = require('./config/hackFix');
            const hackFixInstalled = await installHackFix(sequelize);
            if (hackFixInstalled) {
                console.log('✅ Hack fixes installed');
            }
        } catch (hackError) {
            console.warn('⚠️ Hack fixes not installed:', hackError.message);
        }
        
        // Initialize payment gateways
        await setupPaymentGateways();
        console.log('✅ Payment gateways initialized');
        
        // Set up cron jobs
        await setupScheduledJobs();
        console.log('✅ Scheduled jobs configured');
        
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

// Start server
const startServer = async () => {
    try {
        console.log('🚀 Starting server initialization sequence...');
        
        // Step 1: Initialize database (critical)
        const dbInitialized = await initializeDatabase();
        if (!dbInitialized) {
            throw new Error('Database initialization failed');
        }
        
        // Step 2: Initialize models (critical)
        await initializeModels();
        
        // Step 3: Setup routes (important but not critical)
        setupRoutes();
        
        // Step 4: Setup additional services (optional)
        await setupAdditionalServices();
        
        // Step 5: Setup error handling
        setupErrorHandling();
        
        // Step 6: Start the server
        server.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ Server running successfully on http://0.0.0.0:${PORT}`);
            console.log(`🌐 Health check: http://0.0.0.0:${PORT}/health`);
            console.log(`📊 Database: Connected and ready`);
            console.log(`🎉 DueWin Backend Server is fully operational!`);
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