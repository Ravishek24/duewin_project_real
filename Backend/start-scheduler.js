#!/usr/bin/env node

// Backend/start-scheduler.js - UPDATED VERSION
require('dotenv').config();

console.log('🚀 Starting DueWin Scheduler System...');

/**
 * Main scheduler startup function
 */
const startSchedulerSystem = async () => {
    try {
        console.log('🔄 Initializing scheduler components...');
        
        // Import and start game scheduler
        try {
            const { startGameScheduler } = require('./scripts/gameScheduler');
            console.log('📅 Starting game scheduler...');
            const gameSchedulerSuccess = await startGameScheduler();
            
            if (gameSchedulerSuccess) {
                console.log('✅ Game scheduler started successfully');
            } else {
                console.warn('⚠️ Game scheduler failed to start');
            }
        } catch (gameSchedulerError) {
            console.error('❌ Error starting game scheduler:', gameSchedulerError.message);
            // Don't exit - continue with other schedulers
        }
        
        // Import and start master cron jobs
        try {
            const { initializeMasterCronJobs } = require('./scripts/masterCronJobs');
            console.log('⏰ Starting master cron jobs...');
            await initializeMasterCronJobs();
            console.log('✅ Master cron jobs started successfully');
        } catch (cronError) {
            console.error('❌ Error starting master cron jobs:', cronError.message);
            // Don't exit - game scheduler might still be working
        }
        
        console.log('🎉 Scheduler system startup completed');
        console.log('📊 Running services:');
        console.log('  - Game result processing (every 30s, 1min, 3min, 5min, 10min)');
        console.log('  - Daily attendance processing (12:30 AM IST)');
        console.log('  - Bonus and commission processing (12:30 AM IST)');
        console.log('  - VIP reward processing (12:30 AM IST)');
        console.log('  - Monthly VIP rewards (1st of month, 12:30 AM IST)');
        
        return true;
        
    } catch (error) {
        console.error('❌ Fatal error in scheduler system startup:', error);
        console.error('Stack trace:', error.stack);
        return false;
    }
};

/**
 * Graceful shutdown handler
 */
const gracefulShutdown = (signal) => {
    console.log(`🛑 ${signal} received, shutting down scheduler system gracefully...`);
    
    try {
        // Add any cleanup logic here if needed
        console.log('🧹 Cleanup completed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
};

/**
 * Enhanced error handlers
 */
const setupErrorHandlers = () => {
    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
        console.error('🚨 Uncaught Exception:', err);
        console.error('Stack trace:', err.stack);
        
        // Check if it's a database-related error
        if (err.message && (
            err.message.includes('getQueryInterface') ||
            err.message.includes('Database not connected') ||
            err.message.includes('ECONNREFUSED')
        )) {
            console.error('🚨 This appears to be a database connectivity issue');
            console.error('🚨 Scheduler will continue running and retry connections');
            return; // Don't exit for database issues
        }
        
        // For other critical errors, consider graceful shutdown
        console.error('🚨 Critical error detected, but keeping scheduler running');
    });
    
    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
        console.error('🚨 Unhandled Rejection at:', promise);
        console.error('🚨 Reason:', reason);
        
        // Check if it's a database-related rejection
        if (reason && reason.message && (
            reason.message.includes('getQueryInterface') ||
            reason.message.includes('Database not connected') ||
            reason.message.includes('ECONNREFUSED')
        )) {
            console.error('🚨 Database-related rejection, scheduler will continue');
            return; // Don't exit for database issues
        }
        
        console.error('🚨 Continuing execution despite unhandled rejection');
    });
    
    // Handle process termination signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    console.log('✅ Error handlers configured');
};

/**
 * Main execution
 */
const main = async () => {
    console.log('🔧 Setting up scheduler process...');
    
    // Setup error handlers first
    setupErrorHandlers();
    
    // Start the scheduler system
    const success = await startSchedulerSystem();
    
    if (success) {
        console.log('✅ Scheduler system started successfully');
        console.log('🔄 System is now running and processing scheduled tasks...');
        
        // Keep the process alive
        process.stdin.resume();
        
        // Optional: Add a heartbeat log every 30 minutes
        setInterval(() => {
            const uptime = Math.floor(process.uptime());
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            console.log(`💓 Scheduler heartbeat - Uptime: ${hours}h ${minutes}m`);
        }, 30 * 60 * 1000); // Every 30 minutes
        
    } else {
        console.error('❌ Failed to start scheduler system');
        console.error('🔄 Attempting to keep process alive for potential recovery...');
        
        // Even if startup failed, keep process alive for potential recovery
        process.stdin.resume();
        
        // Retry initialization every 5 minutes
        setInterval(async () => {
            console.log('🔄 Attempting to restart scheduler components...');
            try {
                await startSchedulerSystem();
            } catch (retryError) {
                console.error('❌ Retry failed:', retryError.message);
            }
        }, 5 * 60 * 1000); // Every 5 minutes
    }
};

// Start the main process
console.log('🚀 Starting DueWin Scheduler Process...');
main().catch((error) => {
    console.error('❌ Fatal error in main process:', error);
    console.error('Stack trace:', error.stack);
    
    // Keep process alive even on fatal errors
    console.log('🔄 Keeping process alive for potential recovery...');
    process.stdin.resume();
});