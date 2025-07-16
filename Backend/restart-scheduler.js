const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function restartScheduler() {
    try {
        console.log('🔄 [SCHEDULER_RESTART] Starting scheduler restart process...');
        
        // Check current scheduler status
        console.log('📋 [SCHEDULER_RESTART] Checking current scheduler status...');
        const { stdout: pm2List } = await execAsync('pm2 list');
        console.log(pm2List);
        
        // Stop the scheduler
        console.log('🛑 [SCHEDULER_RESTART] Stopping game-scheduler...');
        await execAsync('pm2 stop game-scheduler');
        console.log('✅ [SCHEDULER_RESTART] Scheduler stopped');
        
        // Wait a moment for cleanup
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Clear any stuck locks
        console.log('🧹 [SCHEDULER_RESTART] Clearing stuck locks...');
        const redis = require('redis');
        const client = redis.createClient({ url: 'redis://localhost:6379' });
        await client.connect();
        
        const locks = await client.keys('scheduler_result_lock_*');
        if (locks.length > 0) {
            console.log(`🗑️ [SCHEDULER_RESTART] Clearing ${locks.length} stuck locks...`);
            for (const lock of locks) {
                await client.del(lock);
                console.log(`  Deleted: ${lock}`);
            }
        }
        await client.disconnect();
        
        // Wait a moment for Redis cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Start the scheduler
        console.log('🚀 [SCHEDULER_RESTART] Starting game-scheduler...');
        await execAsync('pm2 start game-scheduler');
        console.log('✅ [SCHEDULER_RESTART] Scheduler started');
        
        // Wait for startup
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check status again
        console.log('📋 [SCHEDULER_RESTART] Checking scheduler status after restart...');
        const { stdout: pm2ListAfter } = await execAsync('pm2 list');
        console.log(pm2ListAfter);
        
        // Check logs for any immediate errors
        console.log('📋 [SCHEDULER_RESTART] Checking recent logs...');
        const { stdout: recentLogs } = await execAsync('pm2 logs game-scheduler --lines 20');
        console.log(recentLogs);
        
        console.log('✅ [SCHEDULER_RESTART] Scheduler restart completed successfully!');
        
    } catch (error) {
        console.error('❌ [SCHEDULER_RESTART] Error during restart:', error);
        
        // Try to start scheduler even if there were errors
        try {
            console.log('🔄 [SCHEDULER_RESTART] Attempting to start scheduler despite errors...');
            await execAsync('pm2 start game-scheduler');
            console.log('✅ [SCHEDULER_RESTART] Scheduler started (recovery mode)');
        } catch (startError) {
            console.error('❌ [SCHEDULER_RESTART] Failed to start scheduler:', startError);
        }
    }
}

// Run the restart
restartScheduler().catch(console.error); 