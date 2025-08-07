require('dotenv').config();
const { initializeWorkerModels, getWorkerModels } = require('./workerInit');
const fixedBullMQManager = require('../fixes/bullmq-connection-fix');
const fixedRedis = require('../fixes/redis-connection-fix');
const moment = require('moment-timezone');

console.log('🚀 Starting Fixed BullMQ Worker Manager...');
console.log('==================================================');

// Helper functions for job processing
async function processAttendanceWithDeduplication(userId, models) {
  const today = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
  
  // Use fixed Redis manager connection
  const redis = fixedRedis.getConnection('main');
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

// Async IIFE to allow top-level await
(async () => {
  try {
    // Initialize models first
    await initializeWorkerModels();
    console.log('✅ Worker models initialized');

    // Create optimized queues
    console.log('📋 Creating optimized queues...');
    const queues = {
      attendance: fixedBullMQManager.createQueue('attendance', {
        defaultJobOptions: { priority: 5, attempts: 2, backoff: { type: 'exponential', delay: 5000 } }
      }),
      registration: fixedBullMQManager.createQueue('registration', {
        defaultJobOptions: { priority: 2, attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
      }),
      deposits: fixedBullMQManager.createQueue('deposits', {
        defaultJobOptions: { priority: 1, attempts: 5, backoff: { type: 'exponential', delay: 3000 } }
      }),
      withdrawals: fixedBullMQManager.createQueue('withdrawals', {
        defaultJobOptions: { priority: 1, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
      }),
      payments: fixedBullMQManager.createQueue('payments', {
        defaultJobOptions: { priority: 1, attempts: 5, backoff: { type: 'exponential', delay: 3000 } }
      }),
      admin: fixedBullMQManager.createQueue('admin', {
        defaultJobOptions: { priority: 1, attempts: 3, backoff: { type: 'exponential', delay: 2000 } }
      })
    };

    // Create optimized workers with proper concurrency
    console.log('👷 Creating optimized workers...');
    
    // Define job processing functions for each queue
    const jobProcessors = {
      attendance: async (job) => {
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
      },
      
      registration: async (job) => {
        const { userId, userData } = job.data;
        try {
          const models = getWorkerModels();
          // Add your registration processing logic here
          console.log(`[BullMQ] Registration processed for user ${userId}`);
        } catch (error) {
          console.error(`[BullMQ] Registration job failed for user ${userId}:`, error.message);
          throw error;
        }
      },
      
      deposits: async (job) => {
        const { depositId } = job.data;
        try {
          const models = getWorkerModels();
          // Add your deposit processing logic here
          console.log(`[BullMQ] Deposit processed for ID ${depositId}`);
        } catch (error) {
          console.error(`[BullMQ] Deposit job failed for ID ${depositId}:`, error.message);
          throw error;
        }
      },
      
      withdrawals: async (job) => {
        const { withdrawalId } = job.data;
        try {
          const models = getWorkerModels();
          // Add your withdrawal processing logic here
          console.log(`[BullMQ] Withdrawal processed for ID ${withdrawalId}`);
        } catch (error) {
          console.error(`[BullMQ] Withdrawal job failed for ID ${withdrawalId}:`, error.message);
          throw error;
        }
      },
      
      payments: async (job) => {
        const { paymentId } = job.data;
        try {
          const models = getWorkerModels();
          // Add your payment processing logic here
          console.log(`[BullMQ] Payment processed for ID ${paymentId}`);
        } catch (error) {
          console.error(`[BullMQ] Payment job failed for ID ${paymentId}:`, error.message);
          throw error;
        }
      },
      
      admin: async (job) => {
        const { taskId } = job.data;
        try {
          const models = getWorkerModels();
          // Add your admin task processing logic here
          console.log(`[BullMQ] Admin task processed for ID ${taskId}`);
        } catch (error) {
          console.error(`[BullMQ] Admin job failed for ID ${taskId}:`, error.message);
          throw error;
        }
      }
    };

    const workers = {
      attendance: fixedBullMQManager.createWorker('attendance', jobProcessors.attendance, { concurrency: 15 }),
      registration: fixedBullMQManager.createWorker('registration', jobProcessors.registration, { concurrency: 10 }),
      deposits: fixedBullMQManager.createWorker('deposits', jobProcessors.deposits, { concurrency: 20 }),
      withdrawals: fixedBullMQManager.createWorker('withdrawals', jobProcessors.withdrawals, { concurrency: 10 }),
      payments: fixedBullMQManager.createWorker('payments', jobProcessors.payments, { concurrency: 20 }),
      admin: fixedBullMQManager.createWorker('admin', jobProcessors.admin, { concurrency: 5 })
    };

    console.log('📋 Active Workers:');
    console.log('   - Attendance Worker (concurrency: 15)');
    console.log('   - Registration Worker (concurrency: 10)');
    console.log('   - Deposit Worker (concurrency: 20)');
    console.log('   - Withdrawal Worker (concurrency: 10)');
    console.log('   - Payment Worker (concurrency: 20)');
    console.log('   - Admin Worker (concurrency: 5)');
    console.log('');

    // Create schedulers for all queues (optional)
    console.log('⏰ Creating schedulers...');
    let schedulerCount = 0;
    for (const [name, queue] of Object.entries(queues)) {
      const scheduler = fixedBullMQManager.createScheduler(name);
      if (scheduler) {
        schedulerCount++;
      }
    }
    console.log(`✅ Created ${schedulerCount} schedulers for queues`);

    // Enhanced health monitoring using fixed manager
    const monitorWorkerHealth = () => {
      fixedBullMQManager.addManagedInterval(async () => {
        try {
          console.log('📊 Queue Health Status:');
          console.log('=======================');

          const stats = await fixedBullMQManager.getAllStats();
          
          for (const stat of stats) {
            const status = stat.waiting > 50 ? '🚨' : stat.waiting > 20 ? '⚠️' : '✅';
            console.log(`${status} ${stat.name}: ${stat.waiting} waiting, ${stat.active} active, ${stat.completed} completed, ${stat.failed} failed`);

            // Alert on backlog
            if (stat.waiting > 50) {
              console.error(`🚨 HIGH BACKLOG: ${stat.name} queue has ${stat.waiting} waiting jobs`);
            }

            // Alert on high failure rate
            if (stat.failed > stat.completed * 0.1) {
              console.error(`🚨 HIGH FAILURE RATE: ${stat.name} queue has ${stat.failed} failed jobs`);
            }

            // Alert on stalled jobs
            if (stat.active > 0) {
              console.warn(`⚠️ ${stat.name} queue has ${stat.active} active jobs`);
            }
          }

          console.log('=======================');

        } catch (error) {
          console.error('Health monitoring failed:', error);
        }
      }, 30000, 'queue-health-monitor'); // Check every 30 seconds
    };

    // Start health monitoring after 10 seconds
    setTimeout(() => {
      console.log('🔍 Starting enhanced queue health monitoring...');
      monitorWorkerHealth();
    }, 10000);

    // Periodic memory usage logging using managed intervals
    fixedBullMQManager.addManagedInterval(() => {
      const used = process.memoryUsage();
      console.log('🧠 Memory Usage:', {
        rss: Math.round(used.rss / 1024 / 1024 * 100) / 100 + ' MB',
        heapTotal: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100 + ' MB',
        heapUsed: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100 + ' MB'
      });

      // Alert on high memory usage
      if (used.heapUsed > 500 * 1024 * 1024) { // 500MB
        console.warn('🚨 HIGH MEMORY USAGE DETECTED');
      }
    }, 30000, 'memory-monitor');

    // Job cleanup using managed intervals
    fixedBullMQManager.addManagedInterval(async () => {
      try {
        for (const [name] of Object.entries(queues)) {
          await fixedBullMQManager.cleanupJobs(name, 24 * 60 * 60 * 1000); // 24 hours
        }
      } catch (error) {
        console.error('❌ Error cleaning up jobs:', error.message);
      }
    }, 6 * 60 * 60 * 1000, 'job-cleanup'); // Every 6 hours

    console.log('✅ Fixed Worker Manager Started Successfully!');
    console.log('💡 Press Ctrl+C to stop all workers gracefully');
    console.log('==================================================');

  } catch (error) {
    console.error('❌ Failed to start worker manager:', error);
    process.exit(1);
  }
})(); 