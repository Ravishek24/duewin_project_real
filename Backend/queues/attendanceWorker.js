const { Worker, Queue } = require('bullmq');
const { getWorkerModels } = require('../workers/workerInit');
const getQueueConnections = require('../config/queueConfig');
const unifiedRedis = require('../config/unifiedRedisManager');
const moment = require('moment-timezone');

async function startWorker() {
  await unifiedRedis.initialize();
  const queueConnections = getQueueConnections();

  const worker = new Worker('attendance', async job => {
    const { userId } = job.data;
    try {
      const models = getWorkerModels();
      await processAttendanceWithDeduplication(userId, models);
      console.log(`[BullMQ] Attendance processed for user ${userId}`);
    } catch (error) {
      console.error(`[BullMQ] Attendance job failed for user ${userId}:`, error.message);
      if (isRetryableError(error)) {
        throw error;
      }
      console.warn(`Non-critical attendance error for user ${userId}:`, error.message);
    }
  }, {
    connection: queueConnections.attendance,
    concurrency: 10,
    settings: {
      stalledInterval: 30000,
      maxStalledCount: 1
    }
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

  const attendanceQueue = new Queue('attendance', { connection: queueConnections.attendance });
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
  
  // FIXED: Use unified Redis manager connection
  const redis = unifiedRedis.getConnection('main');
  const deduplicationKey = `attendance:${userId}:${today}`;
  const cronDeduplicationKey = `attendance_cron:${userId}:${today}`;
  
  // Check if already processed by this worker
  const isAlreadyProcessed = await redis.get(deduplicationKey);
  if (isAlreadyProcessed) {
    console.log(`Attendance already processed for user ${userId} on ${today}`);
    return;
  }
  
  // Check if cron job is processing this user
  const isCronProcessing = await redis.get(cronDeduplicationKey);
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
      // Find or create attendance record
      const [attendanceRecord, created] = await models.AttendanceRecord.findOrCreate({
        where: {
          user_id: userId,
          attendance_date: today
        },
        defaults: {
          has_logged_in_today: true,
          created_at: new Date()
        },
        transaction
      });
      
      if (!created && !attendanceRecord.has_logged_in_today) {
        await attendanceRecord.update({
          has_logged_in_today: true,
          updated_at: new Date()
        }, { transaction });
      }
    }
    
    await transaction.commit();
    
    // Set deduplication flag (expires at end of day)
    const endOfDay = moment.tz('Asia/Kolkata').endOf('day');
    const ttl = endOfDay.diff(moment(), 'seconds');
    await redis.setex(deduplicationKey, ttl, '1');
    
  } catch (error) {
    await transaction.rollback();
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