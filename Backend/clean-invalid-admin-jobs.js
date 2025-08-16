const { createQueue } = require('./config/queueConfig');
const unifiedRedis = require('./config/unifiedRedisManager');

async function cleanInvalidAdminJobs() {
    try {
        console.log('🧹 Starting cleanup of invalid admin queue jobs...');
        
        // Initialize Redis manager
        await unifiedRedis.initialize();
        
        const adminQueue = await createQueue('admin');
        
        // Clean admin queue
        console.log('🔍 Cleaning admin queue...');
        const adminJobs = await adminQueue.getJobs(['waiting', 'active', 'delayed', 'failed'], 0, 1000);
        let adminCleaned = 0;
        
        for (const job of adminJobs) {
            try {
                let shouldRemove = false;
                let reason = '';
                
                // Check if job has valid structure
                if (!job.data || typeof job.data !== 'object') {
                    shouldRemove = true;
                    reason = 'no data';
                } else {
                    // Check for jobs with undefined or null userId
                    if (job.data.userId === undefined || job.data.userId === null || job.data.userId === 'undefined') {
                        shouldRemove = true;
                        reason = 'userId is undefined/null';
                    }
                    
                    // Check for withdrawal_request jobs with missing userId
                    if (job.data.type === 'withdrawal_request' && !job.data.userId) {
                        shouldRemove = true;
                        reason = 'withdrawal_request missing userId';
                    }
                    
                    // Check for notifyAdmin jobs with missing userId
                    if (job.data.type === 'notifyAdmin' && !job.data.userId) {
                        shouldRemove = true;
                        reason = 'notifyAdmin missing userId';
                    }
                    
                    // Check if job is too old (more than 2 hours)
                    const jobAge = Date.now() - job.timestamp;
                    if (jobAge > 2 * 60 * 60 * 1000) {
                        shouldRemove = true;
                        reason = `too old (${Math.round(jobAge / 1000 / 60)} minutes)`;
                    }
                }
                
                if (shouldRemove) {
                    console.log(`🗑️ Removing admin job ${job.id} (${job.name}): ${reason}`);
                    console.log(`   Data:`, JSON.stringify(job.data, null, 2));
                    await job.remove();
                    adminCleaned++;
                }
            } catch (cleanupError) {
                console.error(`❌ Error cleaning admin job ${job.id}:`, cleanupError.message);
            }
        }
        
        // Clean old completed and failed jobs
        console.log('🔍 Cleaning old completed and failed admin jobs...');
        await adminQueue.clean(24 * 60 * 60 * 1000, 100, 'completed');
        await adminQueue.clean(24 * 60 * 60 * 1000, 100, 'failed');
        
        console.log(`✅ Admin queue cleanup completed:`);
        console.log(`   Admin jobs cleaned: ${adminCleaned}`);
        console.log(`   Old completed/failed jobs cleaned`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Admin queue cleanup failed:', error);
        process.exit(1);
    }
}

// Run cleanup
cleanInvalidAdminJobs();
