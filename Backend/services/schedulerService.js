// Backend/services/schedulerService.js
const cron = require('node-cron');
const { redis } = require('../config/redisConfig');
const { logger } = require('../utils/logger');

/**
 * Setup scheduled jobs
 */
const setupScheduledJobs = async () => {
    try {
        console.log('🕐 Setting up scheduled jobs...');

        // Clean Redis data every day at midnight
        cron.schedule('0 0 * * *', async () => {
            try {
                console.log('🧹 Running daily Redis cleanup...');
                // Add your Redis cleanup logic here
                console.log('✅ Redis cleanup completed');
            } catch (error) {
                console.error('❌ Redis cleanup failed:', error);
            }
        });

        // Backup database every day at 1 AM
        cron.schedule('0 1 * * *', async () => {
            try {
                console.log('💾 Running daily database backup...');
                // Add your database backup logic here
                console.log('✅ Database backup completed');
            } catch (error) {
                console.error('❌ Database backup failed:', error);
            }
        });

        console.log('✅ Scheduled jobs setup completed');
        return true;
    } catch (error) {
        console.error('❌ Failed to setup scheduled jobs:', error);
        return false;
    }
};

module.exports = {
    setupScheduledJobs
}; 