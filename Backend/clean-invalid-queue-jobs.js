const { createQueue } = require('./config/queueConfig');
const unifiedRedis = require('./config/unifiedRedisManager');

async function cleanInvalidJobs() {
    try {
        console.log('🧹 Starting cleanup of invalid queue jobs...');
        
        // Initialize Redis manager
        await unifiedRedis.initialize();
        
        const registrationQueue = await createQueue('registration');
        const attendanceQueue = await createQueue('attendance');
        
        // Clean registration queue
        console.log('🔍 Cleaning registration queue...');
        const regJobs = await registrationQueue.getJobs(['waiting', 'active', 'delayed', 'failed'], 0, 1000);
        let regCleaned = 0;
        
        for (const job of regJobs) {
            try {
                let shouldRemove = false;
                let reason = '';
                
                // Check if job has valid structure
                if (!job.data || typeof job.data !== 'object') {
                    shouldRemove = true;
                    reason = 'no data';
                } else {
                    let hasValidUserId = false;
                    
                    // Check for valid userId in various formats
                    if (job.data.userId) {
                        hasValidUserId = true;
                    } else if (job.data.data && job.data.data.userId) {
                        hasValidUserId = true;
                    } else if (job.data.user_id) {
                        hasValidUserId = true;
                    } else if (job.name && job.name.startsWith('bonus-')) {
                        // Extract userId from job name
                        const extractedUserId = job.name.replace('bonus-', '');
                        if (extractedUserId && !isNaN(extractedUserId)) {
                            hasValidUserId = true;
                        }
                    }
                    
                    if (!hasValidUserId) {
                        shouldRemove = true;
                        reason = 'missing or invalid userId';
                    }
                    
                    // Check if job is too old (more than 2 hours)
                    const jobAge = Date.now() - job.timestamp;
                    if (jobAge > 2 * 60 * 60 * 1000) {
                        shouldRemove = true;
                        reason = `too old (${Math.round(jobAge / 1000 / 60)} minutes)`;
                    }
                }
                
                if (shouldRemove) {
                    console.log(`🗑️ Removing registration job ${job.id} (${job.name}): ${reason}`);
                    console.log(`   Data:`, JSON.stringify(job.data, null, 2));
                    await job.remove();
                    regCleaned++;
                }
            } catch (cleanupError) {
                console.error(`❌ Error cleaning registration job ${job.id}:`, cleanupError.message);
            }
        }
        
        // Clean attendance queue
        console.log('🔍 Cleaning attendance queue...');
        const attJobs = await attendanceQueue.getJobs(['waiting', 'active', 'delayed', 'failed'], 0, 1000);
        let attCleaned = 0;
        
        for (const job of attJobs) {
            try {
                let shouldRemove = false;
                let reason = '';
                
                // Check if job has valid structure
                if (!job.data || typeof job.data !== 'object') {
                    shouldRemove = true;
                    reason = 'no data';
                } else if (!job.data.userId) {
                    shouldRemove = true;
                    reason = 'missing userId';
                } else {
                    // Check if job is too old (more than 2 hours)
                    const jobAge = Date.now() - job.timestamp;
                    if (jobAge > 2 * 60 * 60 * 1000) {
                        shouldRemove = true;
                        reason = `too old (${Math.round(jobAge / 1000 / 60)} minutes)`;
                    }
                }
                
                if (shouldRemove) {
                    console.log(`🗑️ Removing attendance job ${job.id}: ${reason}`);
                    await job.remove();
                    attCleaned++;
                }
            } catch (cleanupError) {
                console.error(`❌ Error cleaning attendance job ${job.id}:`, cleanupError.message);
            }
        }
        
        // Clean failed and completed jobs older than 24 hours
        console.log('🔍 Cleaning old completed and failed jobs...');
        await registrationQueue.clean(24 * 60 * 60 * 1000, 100, 'completed');
        await registrationQueue.clean(24 * 60 * 60 * 1000, 100, 'failed');
        await attendanceQueue.clean(24 * 60 * 60 * 1000, 100, 'completed');
        await attendanceQueue.clean(24 * 60 * 60 * 1000, 100, 'failed');
        
        console.log(`✅ Cleanup completed:`);
        console.log(`   Registration jobs cleaned: ${regCleaned}`);
        console.log(`   Attendance jobs cleaned: ${attCleaned}`);
        console.log(`   Old completed/failed jobs cleaned from both queues`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    }
}

// Run cleanup
cleanInvalidJobs();
