// Backend/index.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { connectDB } = require('./config/db');
const allRoutes = require('./routes/index');
const internalGameRoutes = require('./routes/internalGameRoutes');
const { initializeWebSocket } = require('./services/websocketService');
require('./config/redisConfig'); // Import to initialize Redis connection
const { updateValidReferrals } = require('./scripts/dailyReferralJobs');
const { initializeModels } = require('./models/index');
const cron = require('node-cron');

// Load environment variables early
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.SERVER_PORT || 8000;

// Create HTTP server (needed for Socket.io)
const server = http.createServer(app);

// Initialize WebSocket server
initializeWebSocket(server);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Define a startup function to ensure proper initialization order
const startServer = async () => {
    try {
        // Connect to the database first
        await connectDB();
        console.log('✅ Database connected successfully');
        
        // Initialize models
        try {
            await initializeModels();
            console.log('✅ Models initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing models:', error);
            // Don't exit on model initialization error
        }
        
        // Import any services that need database initialization
        const paymentGatewayService = require('./services/paymentGatewayService');
        
        // Initialize default payment gateways if they don't exist
        try {
            await paymentGatewayService.initializeDefaultGateways();
            console.log('✅ Payment gateways initialized');
        } catch (error) {
            console.error('⚠️ Error initializing payment gateways:', error.message);
            // Don't exit on this error, it's not critical
        }
        
        // Set up routes
        app.get('/', (req, res) => {
            res.send('Server is running successfully!');
        });

        // API Routes
        app.use('/api', allRoutes); // Use the combined routes with /api prefix
        app.use('/api/games', internalGameRoutes); // Add the internal game routes

        // Health check route
        app.get('/health', (req, res) => {
            res.status(200).json({ status: 'ok', message: 'Server is running' });
        });

        // Error handling middleware
        app.use((err, req, res, next) => {
            console.error(err.stack);
            res.status(500).json({
                success: false,
                message: 'Internal Server Error',
                error: process.env.NODE_ENV === 'development' ? err.message : undefined
            });
        });

        // Start the server
        server.listen(PORT, "0.0.0.0", () => {
            console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
        });

        // Schedule daily referral update job
        cron.schedule('0 0 * * *', async () => {
            console.log('Running daily referral update job...');
            try {
                await updateValidReferrals();
                console.log('✅ Daily referral update job completed successfully');
            } catch (error) {
                console.error('❌ Error in daily referral update job:', error);
            }
        });

        // Run initial referral update
        try {
            await updateValidReferrals();
            console.log('✅ Initial referral update completed successfully');
        } catch (error) {
            console.error('❌ Error in initial referral update:', error);
            // Don't exit on this error, it's not critical
        }

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Start the server
startServer();

module.exports = app;