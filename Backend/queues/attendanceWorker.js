const { Worker, Queue } = require('bullmq');
const { getWorkerModels } = require('../workers/workerInit');
const { createWorker, createQueue } = require('../config/queueConfig');
const unifiedRedis = require('../config/unifiedRedisManager');
const moment = require('moment-timezone');

async function startWorker() {
  await unifiedRedis.initialize();
  // connections handled within createWorker/createQueue via unifiedRedis

  const worker = createWorker('attendance', async job => {
    try {
      // Enhanced job data validation and logging
      console.log(`[BullMQ] Processing attendance job:`, {
        jobId: job.id,
        jobData: job.data,
        timestamp: new Date().toISOString()
      });
      
      const { userId } = job.data;
      
      // Validate job data
      if (!userId) {
        throw new Error('User ID is missing in attendance job data');
      }
      
      console.log(`[BullMQ] Validated attendance job:`, { userId });
      
      const models = getWorkerModels();
      await processAttendanceWithDeduplication(userId, models);
      console.log(`[BullMQ] Attendance processed for user ${userId}`);
    } catch (error) {
      console.error(`[BullMQ] Attendance job failed:`, {
        jobId: job.id,
        jobData: job.data,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      if (isRetryableError(error)) {
        throw error;
      }
      console.warn(`Non-critical attendance error for user ${userId}:`, error.message);
    }
  }, {
    concurrency: 10
  });

  worker.on('completed', job => {
    console.log(`[BullMQ] Attendance job completed:`, job.id);
  });

  worker.on('failed', (job, err) => {
    console.error(`[BullMQ] Attendance job failed:`, job.id, err.message);
    if (err.name === 'SequelizeDeadlockError') {
      console.error('\ud83d\udea8 DEADLOCK DETECTED in attendance worker:', {
        job: job.data,
        timestamp: new Date().toISOString(),
        stack: err.stack
      });
    }
  });

  const attendanceQueue = await createQueue('attendance');
  setInterval(() => {
    attendanceQueue.clean(24 * 60 * 60 * 1000, 100, 'completed').catch(() => {});
    attendanceQueue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed').catch(() => {});
  }, 6 * 60 * 60 * 1000); // Every 6 hours

  return worker;
}

module.exports = startWorker();

// Enhanced attendance processing with deduplication
async function processAttendanceWithDeduplication(userId, models) {
  const today = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
  
  // FIXED: Use unified Redis helper instead of direct connection
  const redisHelper = await unifiedRedis.getHelper();
  if (!redisHelper) {
    throw new Error('Redis helper not available');
  }
  
  const deduplicationKey = `attendance:${userId}:${today}`;
  const cronDeduplicationKey = `attendance_cron:${userId}:${today}`;
  
  // Check if already processed by this worker
  const isAlreadyProcessed = await redisHelper.get(deduplicationKey);
  if (isAlreadyProcessed) {
    console.log(`Attendance already processed for user ${userId} on ${today}`);
    return;
  }
  
  // Check if cron job is processing this user
  const isCronProcessing = await redisHelper.get(cronDeduplicationKey);
  if (isCronProcessing) {
    console.log(`Cron job is processing attendance for user ${userId} on ${today}, skipping...`);
    return;
  }
  
  const transaction = await models.User.sequelize.transaction();
  
  try {
    const user = await models.User.findByPk(userId, {
      attributes: ['last_login_at'],
      transaction
    });
    
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }
    
    const hasLoggedInToday = user.last_login_at && 
      moment(user.last_login_at).format('YYYY-MM-DD') === today;
    
    if (hasLoggedInToday) {
      // FIXED: Set both date and attendance_date fields, remove unknown attribute
      const [attendanceRecord, created] = await models.AttendanceRecord.findOrCreate({
        where: {
          user_id: userId,
          attendance_date: today
        },
        defaults: {
          date: today, // FIXED: Set required date field
          created_at: new Date()
        },
        transaction
      });
      
      if (!created) {
        // Update existing record if needed
        await attendanceRecord.update({
          updated_at: new Date()
        }, { transaction });
      }
    }
    
    await transaction.commit();
    
    // Set deduplication flag (expires at end of day)
    const endOfDay = moment.tz('Asia/Kolkata').endOf('day');
    const ttl = endOfDay.diff(moment(), 'seconds');
    await redisHelper.set(deduplicationKey, '1', null, ttl);
    
  } catch (error) {
    // FIXED: Only rollback if transaction is still active
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    throw error;
  }
}

// Helper function for retryable errors
function isRetryableError(error) {
  const retryableErrors = [
    'SequelizeDeadlockError',
    'SequelizeConnectionError',
    'SequelizeConnectionRefusedError',
    'SequelizeConnectionTimedOutError',
    'TimeoutError'
  ];
  return retryableErrors.includes(error.name);
} 