const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function restartScheduler() {
    try {
        console.log('🔄 [SCHEDULER_FIX] Restarting game scheduler with database fixes...');
        
        // Stop the current scheduler
        console.log('🛑 Stopping current scheduler...');
        await execAsync('pm2 stop game-scheduler');
        
        // Wait a moment for clean shutdown
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Check if scheduler is stopped
        const { stdout: pm2List } = await execAsync('pm2 list');
        if (pm2List.includes('game-scheduler')) {
            console.log('⚠️ Scheduler still running, force stopping...');
            await execAsync('pm2 delete game-scheduler');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        // Clear any stuck Redis locks
        console.log('🔓 Clearing stuck Redis locks...');
        try {
            await execAsync('redis-cli --eval <(echo "local keys = redis.call(\'keys\', \'scheduler_result_lock_*\'); for i=1,#keys do redis.call(\'del\', keys[i]) end; return #keys")');
            console.log('🧹 Cleared Redis locks');
        } catch (error) {
            console.log('⚠️ Could not clear Redis locks:', error.message);
        }
        
        // Start the scheduler with new configuration
        console.log('🚀 Starting scheduler with database fixes...');
        await execAsync('pm2 start ecosystem.config.js --only game-scheduler');
        
        // Wait for startup
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check scheduler status
        console.log('📊 Checking scheduler status...');
        const { stdout: status } = await execAsync('pm2 list | grep game-scheduler');
        console.log(status);
        
        console.log('✅ [SCHEDULER_FIX] Scheduler restart completed');
        console.log('🔍 Run "pm2 logs game-scheduler" to monitor ongoing logs');
        console.log('🔍 Run "node monitor-database-health.js" to check database health');
        
    } catch (error) {
        console.error('❌ [SCHEDULER_FIX] Failed to restart scheduler:', error.message);
        process.exit(1);
    }
}

// Run the restart
restartScheduler(); 