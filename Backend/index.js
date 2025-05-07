// Backend/index.js
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import http from 'http';
import { connectDB, syncModels } from './config/db.js';
import allRoutes from './routes/index.js';
import internalGameRoutes from './routes/internalGameRoutes.js';
import { initializeWebSocket } from './services/websocketService.js';
import './config/redisConfig.js'; // Import to initialize Redis connection
import './scripts/dailyReferralJobs.js';

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

// Function to update valid referrals (moved from updateReferralStatus.js)
const updateValidReferrals = async () => {
    console.log('Starting valid referral status update...');
    
    try {
        // Get the required modules
        const User = (await import('./models/User.js')).default;
        const ValidReferral = (await import('./models/ValidReferral.js')).default;
        const referralService = await import('./services/referralService.js');
        
        // Get all users
        const users = await User.findAll({
            attributes: ['user_id', 'valid_referral_count']
        });
        
        console.log(`Processing ${users.length} users for referral status updates...`);
        
        let updatedCount = 0;
        
        // Process each user
        for (const user of users) {
            // Count valid referrals
            const validReferralsCount = await ValidReferral.count({
                where: {
                    referrer_id: user.user_id,
                    is_valid: true
                }
            });
            
            // Update user if count doesn't match
            if (validReferralsCount !== user.valid_referral_count) {
                await User.update(
                    { valid_referral_count: validReferralsCount },
                    { where: { user_id: user.user_id } }
                );
                
                // Check if this change makes them eligible for a new tier
                if (referralService.updateInvitationTier) {
                    await referralService.updateInvitationTier(user.user_id, validReferralsCount);
                }
                
                updatedCount++;
            }
        }
        
        console.log(`Updated valid referral count for ${updatedCount} users`);
        return { success: true, updatedCount };
    } catch (error) {
        console.error('Error updating valid referrals:', error);
        return { success: false, error };
    }
};

// Define a startup function to ensure proper initialization order
const startServer = async () => {
    try {
        // Connect to the database first
        await connectDB();
        
        // Import any services that need database initialization
        const paymentGatewayService = (await import('./services/paymentGatewayService.js')).default;
        
        // Run the referral update directly
        await updateValidReferrals();
        console.log('✅ Initial valid referral update complete');
        
        // Initialize default payment gateways if they don't exist
        try {
            await paymentGatewayService.initializeDefaultGateways();
            console.log('✅ Payment gateways initialized.');
        } catch (error) {
            console.error('⚠️ Error initializing payment gateways:', error.message);
            // Don't exit on this error, it's not critical
        }
        
        // Sync all models after they've been loaded
        await syncModels();
        
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
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Start the server
startServer();

export default app;