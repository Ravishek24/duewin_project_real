// Replace your current tracker in index.js with this enhanced version

// Replace your tracker in index.js with this enhanced version that will find the exact file

const originalCreateConnection = require('net').createConnection;
const path = require('path');

require('net').createConnection = function(...args) {
    const options = args[0];
    
    if (options && (options.port === 6379 || options.port === '6379')) {
        console.log('\n🚨 [NET_TRACKER] ==========================================');
        console.log('🚨 [NET_TRACKER] Network connection to Redis port 6379 detected!');
        console.log('🚨 [NET_TRACKER] Target:', options.host || options.hostname || 'localhost');
        console.log('🚨 [NET_TRACKER] Port:', options.port);
        
        // Get full call stack
        const error = new Error();
        const stack = error.stack.split('\n');
        
        // Find the exact file that's making this call
        let culpritFile = null;
        let culpritFunction = null;
        
        for (let i = 1; i < stack.length; i++) {
            const line = stack[i].trim();
            
            // Skip node_modules and internal calls
            if (line.includes('node_modules') || line.includes('internal/')) {
                continue;
            }
            
            // Look for your backend files
            if (line.includes('/backend/') && !line.includes('index.js')) {
                const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
                if (match) {
                    culpritFunction = match[1];
                    culpritFile = match[2];
                    const lineNumber = match[3];
                    
                    console.log('🎯 [NET_TRACKER] FOUND CULPRIT!');
                    console.log('🎯 [NET_TRACKER] File:', culpritFile);
                    console.log('🎯 [NET_TRACKER] Function:', culpritFunction);
                    console.log('🎯 [NET_TRACKER] Line:', lineNumber);
                    
                    // Identify the service type
                    if (culpritFile.includes('/services/')) {
                        const serviceName = path.basename(culpritFile);
                        console.log('🎯 [NET_TRACKER] SERVICE:', serviceName);
                    } else if (culpritFile.includes('/middleware/')) {
                        const middlewareName = path.basename(culpritFile);
                        console.log('🎯 [NET_TRACKER] MIDDLEWARE:', middlewareName);
                    } else if (culpritFile.includes('/routes/')) {
                        const routeName = path.basename(culpritFile);
                        console.log('🎯 [NET_TRACKER] ROUTE:', routeName);
                    }
                    
                    break;
                }
            }
        }
        
        // If we didn't find a specific file, show more of the stack
        if (!culpritFile) {
            console.log('🔍 [NET_TRACKER] Full call stack (first 15 lines):');
            stack.slice(1, 16).forEach((line, index) => {
                console.log(`   ${index + 1}. ${line.trim()}`);
            });
        }
        
        console.log('🚨 [NET_TRACKER] ==========================================\n');
        
        if (!options.host || options.host === 'localhost' || options.host === '127.0.0.1') {
            console.log('❌ [NET_TRACKER] WARNING: Localhost Redis connection detected!');
        }
    }
    
    return originalCreateConnection.apply(this, args);
};

// Also enhance module tracking to catch Redis imports
const Module = require('module');
const originalRequire = Module.prototype.require;

Module.prototype.require = function(id) {
    if (id === 'ioredis' || id === 'redis' || id.includes('redis') || id === 'bull' || id === 'bullmq') {
        console.log('\n📦 [MODULE_TRACKER] ==========================================');
        console.log('📦 [MODULE_TRACKER] Redis/Queue module being imported:', id);
        console.log('📦 [MODULE_TRACKER] From file:', this.filename);
        
        if (this.filename && this.filename.includes('/backend/')) {
            const relativePath = this.filename.replace(process.cwd(), '');
            console.log('📦 [MODULE_TRACKER] Relative path:', relativePath);
            
            if (relativePath.includes('/services/')) {
                console.log('🎯 [MODULE_TRACKER] SERVICE FILE:', path.basename(this.filename));
            } else if (relativePath.includes('/middleware/')) {
                console.log('🎯 [MODULE_TRACKER] MIDDLEWARE FILE:', path.basename(this.filename));
            }
        }
        
        console.log('📦 [MODULE_TRACKER] ==========================================\n');
    }
    return originalRequire.apply(this, arguments);
};

console.log('🔍 [ENHANCED_TRACKER] Enhanced file detection enabled');
console.log('🔍 [ENHANCED_TRACKER] Will identify exact files causing localhost Redis connections');


////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////
// Backend/index.js - UPDATED WITH PROPER WEBSOCKET INITIALIZATION

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { startDiagnostic, performManualCheck } = require('./utils/websocketDiagnostic');
// UNIFIED REDIS MANAGER INIT
const unifiedRedis = require('./config/unifiedRedisManager');
// Remove old redisConfig usage
// const { redis, isConnected } = require('./config/redisConfig');
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

// 🔥 FIXED: Enhanced CORS configuration for SPRIBE and Frontend
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or Postman)
        if (!origin) return callback(null, true);
        
        // SPRIBE IPs that need access
        const spribeIPs = [
            '194.36.47.153', '194.36.47.152', '194.36.47.150',
            '3.255.67.141', '52.30.236.39', '54.78.240.177'
        ];
        
        // Your allowed origins from environment variable
        const allowedOrigins = (process.env.ALLOWED_ORIGINS?.split(',') || [
            'http://localhost:3001',
            'http://localhost:3000',
            'https://duewingame-three.vercel.app',
            'https://strikecolor1.com',
            'https://www.strikecolor1.com'
        ]);
        
        // Clean up origins (remove whitespace)
        const cleanAllowedOrigins = allowedOrigins.map(origin => origin.trim());
        
        // Check if origin is allowed or if it's from SPRIBE
        const isAllowedOrigin = cleanAllowedOrigins.includes(origin);
        const isSpribeIP = spribeIPs.some(ip => origin?.includes(ip));
        
        if (isAllowedOrigin || isSpribeIP) {
            console.log(`✅ CORS: Allowed origin: ${origin} (Allowed: ${isAllowedOrigin}, Spribe: ${isSpribeIP})`);
            return callback(null, true);
        }
        
        // For development, allow all origins
        if (process.env.NODE_ENV !== 'production') {
            console.log(`✅ CORS: Development mode - allowing origin: ${origin}`);
            return callback(null, true);
        }
        
        console.log(`❌ CORS: Blocked origin: ${origin}`);
        console.log(`📋 Allowed origins: ${cleanAllowedOrigins.join(', ')}`);
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

// CORS test endpoint
app.get('/cors-test', (req, res) => {
    res.json({ 
        status: 'cors-test',
        timestamp: new Date().toISOString(),
        message: 'CORS test endpoint',
        origin: req.headers.origin,
        allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3001'],
        nodeEnv: process.env.NODE_ENV
    });
});

// Add a top-level debug route to verify root-level routing
app.get('/debug-root', (req, res) => {
  res.json({ message: 'Root debug route is working' });
});

// Serve static files
app.use(express.static('public'));

// Basic root route
app.get('/', (req, res) => {
    res.json({ 
        status: 'success', 
        message: 'DueWin Backend Server is running!',
        timestamp: new Date().toISOString()
    });
});

// Admin dashboard route
app.get('/admin', (req, res) => {
    res.sendFile(__dirname + '/public/admin-dashboard.html');
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
        console.log('DEBUG: Entered setupAppRoutes()');
        console.log('🛣️ Setting up routes...');
        
        // Import routes after models are initialized
        const apiRoutes = require('./routes/index');
        
        // Mount API routes
        app.use('/api', apiRoutes);
        
        // Mount admin routes
        try {
            const adminRoutes = require('./routes/adminRoutes');
            const adminExposureRoutes = require('./routes/adminExposureRoutes');
            
            app.use('/admin', adminRoutes);
            app.use('/admin/exposure', adminExposureRoutes);
            
            // 🔥 ADDED: Mount admin exposure routes under /api prefix for frontend compatibility
            app.use('/api/admin/exposure', adminExposureRoutes);
            
            console.log('✅ Admin routes configured successfully');
        } catch (adminError) {
            console.warn('⚠️ Admin routes setup failed:', adminError.message);
        }
        
        console.log('✅ Routes configured successfully');
        console.log('DEBUG: Exiting setupAppRoutes()');
        return true;
    } catch (error) {
        console.error('❌ Routes setup failed:', error.message);
        console.error('❌ Error stack:', error.stack);
        console.log('DEBUG: setupAppRoutes() failed');
        // Don't throw - server can still run with basic routes
        return false;
    }
};

// =================== WEBSOCKET INITIALIZATION ===================
//const { initializeWebSocket } = require('./services/websocketService');

// Initialize WebSocket only after Redis is connected
//const initializeWebSocketWithRedis = async () => {
    //try {
        // Wait for Redis connection
        // The unifiedRedis.isConnected() check is removed as it's not a function.
        // Assuming Redis is initialized and available globally or via a different mechanism.
        // If Redis is truly a dependency, this block needs to be re-evaluated.
        // For now, we'll proceed assuming Redis is ready.
        //console.log('✅ Redis connection assumed ready for WebSocket initialization.');
        
        //console.log('✅ Redis connected, initializing WebSocket...');
        // Only pass the server argument, do not start any tick system
        //const io = initializeWebSocket(server);
        
        // Initialize admin exposure monitoring
        //try {
           //const adminExposureService = require('./services/adminExposureService');
            //adminExposureService.startExposureMonitoring(io);
            //console.log('✅ Admin exposure monitoring initialized');
        //} catch (adminError) {
            //console.warn('⚠️ Admin exposure monitoring setup failed:', adminError.message);
        //}
        
        // Start monitoring after WebSocket is initialized
        //startDiagnostic();
        
        // Check manually anytime
        //performManualCheck();
        
        //return io;
    //} catch (error) {
        //console.error('❌ Failed to initialize WebSocket:', error);
        //throw error;
    //}
//};

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
        // Initialize unified Redis manager first
        await unifiedRedis.initialize();
        console.log('✅ Unified Redis Manager initialized');
        
        // OPTIMIZATION: Initialize cache service for performance optimization
        try {
            const optimizedCacheService = require('./services/optimizedCacheService');
            await optimizedCacheService.initialize();
            console.log('✅ Optimization system initialized - enhanced performance enabled');
        } catch (error) {
            console.warn('⚠️ Optimization system failed to initialize:', error.message);
            console.log('🔄 Server will continue with standard performance (graceful fallback)');
        }
        
        console.log('🚀 Starting server initialization...');

        // Initialize database and models first
        await initializeDatabaseAndModels();

        // Step 2: Setup routes
        console.log('DEBUG: About to call setupAppRoutes()');
        setupAppRoutes();
        console.log('DEBUG: Finished calling setupAppRoutes()');

        // Step 3: Initialize WebSocket with Redis
        //await initializeWebSocketWithRedis();

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