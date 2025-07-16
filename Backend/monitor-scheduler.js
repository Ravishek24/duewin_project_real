const redis = require('redis');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function monitorScheduler() {
    const client = redis.createClient({ url: 'redis://localhost:6379' });
    
    try {
        await client.connect();
        console.log('🔍 [SCHEDULER_MONITOR] Starting scheduler monitoring...');
        
        // Check if scheduler is running
        const { stdout: pm2List } = await execAsync('pm2 list');
        console.log('📋 [SCHEDULER_MONITOR] Current PM2 processes:');
        console.log(pm2List);
        
        // Check for scheduler errors in logs
        const { stdout: schedulerErrors } = await execAsync('pm2 logs game-scheduler --lines 50 | grep -i "error\\|timeout\\|connection"');
        console.log('🚨 [SCHEDULER_MONITOR] Recent scheduler errors:');
        console.log(schedulerErrors || 'No recent errors found');
        
        // Check database connectivity
        console.log('🔍 [SCHEDULER_MONITOR] Testing database connectivity...');
        try {
            const mysql = require('mysql2/promise');
            const connection = await mysql.createConnection({
                host: process.env.DB_HOST || 'database-1.chw2iae8s9ej.eu-north-1.rds.amazonaws.com',
                user: process.env.DB_USER || 'admin',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'duewin',
                connectTimeout: 10000,
                acquireTimeout: 10000
            });
            
            await connection.execute('SELECT 1');
            await connection.end();
            console.log('✅ [SCHEDULER_MONITOR] Database connection successful');
        } catch (dbError) {
            console.error('❌ [SCHEDULER_MONITOR] Database connection failed:', dbError.message);
            
            // Restart scheduler if database is unreachable
            console.log('🔄 [SCHEDULER_MONITOR] Restarting scheduler due to database issues...');
            await execAsync('pm2 restart game-scheduler');
            console.log('✅ [SCHEDULER_MONITOR] Scheduler restarted');
        }
        
        // Check Redis connectivity
        console.log('🔍 [SCHEDULER_MONITOR] Testing Redis connectivity...');
        try {
            await client.ping();
            console.log('✅ [SCHEDULER_MONITOR] Redis connection successful');
        } catch (redisError) {
            console.error('❌ [SCHEDULER_MONITOR] Redis connection failed:', redisError.message);
        }
        
        // Check for stuck locks
        const locks = await client.keys('scheduler_result_lock_*');
        console.log(`🔒 [SCHEDULER_MONITOR] Found ${locks.length} scheduler locks`);
        
        if (locks.length > 10) {
            console.log('⚠️ [SCHEDULER_MONITOR] Too many locks detected, cleaning up...');
            for (const lock of locks) {
                const lockData = await client.get(lock);
                console.log(`  ${lock}: ${lockData}`);
            }
        }
        
    } catch (error) {
        console.error('❌ [SCHEDULER_MONITOR] Monitoring error:', error);
    } finally {
        await client.disconnect();
    }
}

// Run monitoring
monitorScheduler().catch(console.error); 