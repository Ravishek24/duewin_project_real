// Backend/index.js - UPDATED WITH PROPER WEBSOCKET INITIALIZATION

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { startDiagnostic, performManualCheck } = require('./utils/websocketDiagnostic');
const { redis, isConnected } = require('./config/redisConfig');
const { initializeModels } = require('./models');
const { getSequelizeInstance } = require('./config/db');
const securityMiddleware = require('./middleware/securityMiddleware');


// Load environment variables first
dotenv.config();

console.log('🚀 Starting DueWin Backend Server...');

// Create Express app first
const app = express();
const PORT = process.env.SERVER_PORT || 8000;

// Create HTTP server
const server = http.createServer(app);

// 🔥 FIXED: Enhanced CORS configuration for SPRIBE
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) return callback(null, true);
        
        // SPRIBE IPs that need access
        const spribeIPs = [
            '194.36.47.153', '194.36.47.152', '194.36.47.150',
            '3.255.67.141', '52.30.236.39', '54.78.240.177'
        ];
        
        // Your allowed origins
        const allowedOrigins = (process.env.ALLOWED_ORIGINS?.split(',') || [
            'http://localhost:3001',
        ]);
        
        // Check if origin is allowed or if it's from SPRIBE
        if (allowedOrigins.includes(origin) || spribeIPs.some(ip => origin?.includes(ip))) {
            return callback(null, true);
        }
        
        // For development, allow all origins
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        
        callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization',
        // 🔥 CRITICAL: Add SPRIBE headers
        'X-Spribe-Client-ID',
        'X-Spribe-Client-TS', 
        'X-Spribe-Client-Signature'
    ],
    exposedHeaders: [
        // 🔒 SECURITY: Expose security headers for external tools
        'Content-Security-Policy',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'Referrer-Policy',
        'Permissions-Policy',
        'Strict-Transport-Security',
        'X-XSS-Protection',
        'X-Permitted-Cross-Domain-Policies',
        'Cross-Origin-Opener-Policy',
        'Cross-Origin-Embedder-Policy'
    ],
    credentials: true,
    optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));

// 🔒 SECURITY: Apply comprehensive security middleware
securityMiddleware(app);

// 🚨 ATTACK PROTECTION: Apply advanced attack detection
const { attackProtection } = require('./middleware/attackProtection');
app.use(attackProtection);

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

// Security test endpoint
app.get('/security-test', (req, res) => {
    res.json({ 
        status: 'security-test',
        timestamp: new Date().toISOString(),
        message: 'Security headers test endpoint',
        headers: {
            'Content-Security-Policy': res.getHeader('Content-Security-Policy'),
            'X-Frame-Options': res.getHeader('X-Frame-Options'),
            'X-Content-Type-Options': res.getHeader('X-Content-Type-Options'),
            'Referrer-Policy': res.getHeader('Referrer-Policy'),
            'Permissions-Policy': res.getHeader('Permissions-Policy')
        }
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


// Initialize database and models
const initializeDatabaseAndModels = async () => {
    try {
        console.log('🔄 Initializing database and models...');
        const sequelize = await getSequelizeInstance();
        const models = await initializeModels();
        console.log('✅ Database and models initialized successfully');
        return { sequelize, models };
    } catch (error) {
        console.error('❌ Failed to initialize database and models:', error);
        throw error;
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
const { initializeWebSocket } = require('./services/websocketService');

// Initialize WebSocket only after Redis is connected
const initializeWebSocketWithRedis = async () => {
    try {
        // Wait for Redis connection
        if (!isConnected()) {
            console.log('⏳ Waiting for Redis connection...');
            await new Promise(resolve => {
                const checkRedis = setInterval(() => {
                    if (isConnected()) {
                        clearInterval(checkRedis);
                        resolve();
                    }
                }, 1000);
            });
        }
        
        console.log('✅ Redis connected, initializing WebSocket...');
        const io = initializeWebSocket(server, true);
        
        // Start monitoring after WebSocket is initialized
        startDiagnostic();
        
        // Check manually anytime
        performManualCheck();
        
        return io;
    } catch (error) {
        console.error('❌ Failed to initialize WebSocket:', error);
        throw error;
    }
};

// Additional services setup
const setupAdditionalServices = async () => {
    try {
        console.log('🔧 Setting up additional services...');
        
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

// Start the server
const startServer = async () => {
    try {
        console.log('🚀 Starting server initialization...');

        // Initialize database and models first
        await initializeDatabaseAndModels();

        // Step 2: Setup routes
        setupAppRoutes();

        // Step 3: Initialize WebSocket with Redis
        await initializeWebSocketWithRedis();

        // Step 4: Setup additional services
        await setupAdditionalServices();

        // Step 5: Start the server
        server.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
            console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
        });

    } catch (error) {
        console.error('❌ Server startup failed:', error);
        process.exit(1);
    }
};

// Start the server
startServer();

module.exports = app;