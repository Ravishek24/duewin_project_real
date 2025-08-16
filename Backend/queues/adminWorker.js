const { Worker, Queue } = require('bullmq');
const { getWorkerModels } = require('../workers/workerInit');
const { createQueue } = require('../config/queueConfig');
const unifiedRedis = require('../config/unifiedRedisManager');
const { getWithdrawalQueue } = require('./withdrawalQueue');

async function startWorker() {
  await unifiedRedis.initialize();
  // connections handled within createQueue via unifiedRedis

  const worker = createWorker('admin', async job => {
    try {
      // FIXED: Enhanced job data validation and logging
      console.log(`[BullMQ] Processing admin job:`, {
        jobId: job.id,
        jobName: job.name,
        jobData: job.data,
        timestamp: new Date().toISOString()
      });
      
      // FIXED: Better job data structure handling with validation
      let type, data;
      
      if (job.data && typeof job.data === 'object') {
        if ('type' in job.data && 'data' in job.data) {
          // { type, data } structure
          type = job.data.type;
          data = job.data.data;
        } else if ('type' in job.data) {
          // Flat structure with type
          type = job.data.type;
          data = job.data;
        } else {
          // Direct data structure
          type = job.name || 'unknown';
          data = job.data;
        }
      } else {
        throw new Error('Invalid admin job data structure');
      }
      
      // FIXED: Validate job data before processing
      if (!type) {
        throw new Error('Job type is missing');
      }
      
      if (!data || typeof data !== 'object') {
        throw new Error('Job data is missing or invalid');
      }
      
      // FIXED: Additional validation for specific job types
      if (type === 'notifyAdmin' || type === 'withdrawal_request') {
        if (!data.userId && !data.data?.userId) {
          throw new Error(`User ID is missing for ${type} job`);
        }
      }
      
      // FIXED: Log the extracted data for debugging
      console.log(`[BullMQ] Admin job data extracted:`, { type, data });
      
      const models = getWorkerModels();
      switch (type) {
        case 'notifyAdmin':
        case 'withdrawal_request':
          await processAdminNotification(data, models);
          console.log(`[BullMQ] Admin notification sent for ${data.type || type}`);
          break;
        case 'processAdminApproval':
          await processAdminApprovalAction(data, models);
          console.log(`[BullMQ] Admin approval processed for ${data.action}`);
          break;
        case 'generateAdminReport':
          await generateAdminReport(data, models);
          console.log(`[BullMQ] Admin report generated`);
          break;
        default:
          throw new Error(`Unknown admin job type: ${type}`);
      }
    } catch (error) {
      console.error(`[BullMQ] Admin job failed:`, {
        jobId: job.id,
        jobName: job.name,
        jobData: job.data,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      if (isRetryableError(error)) {
        throw error;
      } else {
        await logPermanentFailure(job, error);
        throw new Error(`Non-retryable error: ${error.message}`);
      }
    }
  }, {
    concurrency: 2 // Low concurrency for admin tasks
  });

  // Enhanced admin notification processing
  async function processAdminNotification(data, models) {
    try {
      // FIXED: Better userId extraction and validation
      const userId = data.userId || data.data?.userId;
      const { type, amount, withdrawalType, orderId } = data;
      
      if (!userId) {
        console.warn(`[ADMIN NOTIFY] Warning: No userId provided for ${type} notification`);
        // Log the notification without failing the job
        console.log(`[ADMIN NOTIFY] ${type}: Amount ${amount}, Type ${withdrawalType}, Order ${orderId}`);
        return { success: true, warning: 'No userId provided' };
      }
      
      // Only log to console, do not create DB notification
      console.log(`[ADMIN NOTIFY] ${type}: User ${userId}, Amount ${amount}, Type ${withdrawalType}, Order ${orderId}`);
      // Here you could also send email/SMS notifications to admins if needed
      return { success: true };
    } catch (error) {
      console.error(`Failed to process admin notification:`, error);
      throw error;
    }
  }

  // Enhanced admin approval action processing
  async function processAdminApprovalAction(data, models) {
    const { adminId, withdrawalId, action, notes, selectedGateway } = data;
    
    try {
      // Add withdrawal approval job
      getWithdrawalQueue().add('adminApproval', {
        withdrawalId: withdrawalId,
        adminId: adminId,
        action: action,
        notes: notes,
        selectedGateway: selectedGateway
      }, {
        priority: 10,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      }).catch(console.error);
      
      console.log(`✅ Admin approval action queued: ${action} for withdrawal ${withdrawalId}`);
      return { success: true };
      
    } catch (error) {
      console.error(`Failed to process admin approval action:`, error);
      throw error;
    }
  }

  // Enhanced admin report generation
  async function generateAdminReport(data, models) {
    const { reportType, dateRange, adminId } = data;
    
    try {
      let reportData = {};
      
      switch (reportType) {
        case 'daily_transactions':
          reportData = await generateDailyTransactionReport(dateRange, models);
          break;
        case 'withdrawal_summary':
          reportData = await generateWithdrawalSummaryReport(dateRange, models);
          break;
        case 'deposit_summary':
          reportData = await generateDepositSummaryReport(dateRange, models);
          break;
        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }
      
      // Store report in database
      await models.AdminReport.create({
        admin_id: adminId,
        report_type: reportType,
        report_data: reportData,
        date_range: dateRange,
        generated_at: new Date()
      });
      
      console.log(`✅ Admin report generated: ${reportType}`);
      return { success: true, reportData };
      
    } catch (error) {
      console.error(`Failed to generate admin report:`, error);
      throw error;
    }
  }

  // Helper functions for report generation
  async function generateDailyTransactionReport(dateRange, models) {
    const { startDate, endDate } = dateRange;
    
    const deposits = await models.WalletRecharge.count({
      where: {
        created_at: {
          [models.Sequelize.Op.between]: [startDate, endDate]
        },
        status: 'completed'
      }
    });
    
    const withdrawals = await models.WalletWithdrawal.count({
      where: {
        created_at: {
          [models.Sequelize.Op.between]: [startDate, endDate]
        },
        status: 'completed'
      }
    });
    
    const totalDepositAmount = await models.WalletRecharge.sum('amount', {
      where: {
        created_at: {
          [models.Sequelize.Op.between]: [startDate, endDate]
        },
        status: 'completed'
      }
    });
    
    const totalWithdrawalAmount = await models.WalletWithdrawal.sum('amount', {
      where: {
        created_at: {
          [models.Sequelize.Op.between]: [startDate, endDate]
        },
        status: 'completed'
      }
    });
    
    return {
      totalDeposits: deposits,
      totalWithdrawals: withdrawals,
      totalDepositAmount: totalDepositAmount || 0,
      totalWithdrawalAmount: totalWithdrawalAmount || 0,
      netFlow: (totalDepositAmount || 0) - (totalWithdrawalAmount || 0)
    };
  }

  async function generateWithdrawalSummaryReport(dateRange, models) {
    const { startDate, endDate } = dateRange;
    
    const withdrawals = await models.WalletWithdrawal.findAll({
      where: {
        created_at: {
          [models.Sequelize.Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        'status',
        [models.Sequelize.fn('COUNT', models.Sequelize.col('id')), 'count'],
        [models.Sequelize.fn('SUM', models.Sequelize.col('amount')), 'total_amount']
      ],
      group: ['status']
    });
    
    return {
      withdrawals: withdrawals,
      summary: {
        pending: withdrawals.find(w => w.status === 'pending')?.dataValues?.count || 0,
        approved: withdrawals.find(w => w.status === 'approved')?.dataValues?.count || 0,
        completed: withdrawals.find(w => w.status === 'completed')?.dataValues?.count || 0,
        failed: withdrawals.find(w => w.status === 'failed')?.dataValues?.count || 0
      }
    };
  }

  async function generateDepositSummaryReport(dateRange, models) {
    const { startDate, endDate } = dateRange;
    
    const deposits = await models.WalletRecharge.findAll({
      where: {
        created_at: {
          [models.Sequelize.Op.between]: [startDate, endDate]
        }
      },
      attributes: [
        'status',
        [models.Sequelize.fn('COUNT', models.Sequelize.col('id')), 'count'],
        [models.Sequelize.fn('SUM', models.Sequelize.col('amount')), 'total_amount']
      ],
      group: ['status']
    });
    
    return {
      deposits: deposits,
      summary: {
        pending: deposits.find(d => d.status === 'pending')?.dataValues?.count || 0,
        completed: deposits.find(d => d.status === 'completed')?.dataValues?.count || 0,
        failed: deposits.find(d => d.status === 'failed')?.dataValues?.count || 0
      }
    };
  }

  // Helper functions
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

  async function logPermanentFailure(job, error) {
    console.error('Permanent admin job failure:', {
      jobId: job.id,
      jobData: job.data,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }

  worker.on('completed', job => {
    console.log(`[BullMQ] Admin job completed:`, job.id);
  });

  worker.on('failed', (job, err) => {
    console.error(`[BullMQ] Admin job failed:`, {
      jobId: job.id,
      jobName: job.name,
      jobData: job.data,
      error: err.message,
      errorName: err.name,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    
    // FIXED: Better error categorization
    if (err.name === 'SequelizeDeadlockError') {
      console.error('🚨 DEADLOCK DETECTED in admin worker:', {
        job: job.data,
        timestamp: new Date().toISOString(),
        stack: err.stack
      });
    } else if (err.message.includes('User ID is missing')) {
      console.error('⚠️ USER ID MISSING in admin job:', {
        jobId: job.id,
        jobData: job.data,
        timestamp: new Date().toISOString()
      });
    } else if (err.message.includes('User undefined not found')) {
      console.error('🚨 CRITICAL: User undefined error in admin job:', {
        jobId: job.id,
        jobData: job.data,
        timestamp: new Date().toISOString()
      });
    }
  });

  const adminQueue = new Queue('admin', { connection: await unifiedRedis.getConnection('main') });
  
  // FIXED: Enhanced queue cleanup and maintenance
  setInterval(async () => {
    try {
      // Clean completed jobs
      await adminQueue.clean(24 * 60 * 60 * 1000, 100, 'completed');
      
      // Clean failed jobs
      await adminQueue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed');
      
      // FIXED: Clean old invalid jobs that might be causing issues
      const oldJobs = await adminQueue.getJobs(['waiting', 'active', 'delayed'], 0, 1000);
      let cleanedCount = 0;
      
      for (const job of oldJobs) {
        try {
          // Check if job data is valid
          if (!job.data || typeof job.data !== 'object') {
            console.log(`[BullMQ] Cleaning invalid job ${job.id} - no data`);
            await job.remove();
            cleanedCount++;
            continue;
          }
          
          // Check if job is too old (more than 1 hour)
          const jobAge = Date.now() - job.timestamp;
          if (jobAge > 60 * 60 * 1000) { // 1 hour
            console.log(`[BullMQ] Cleaning old job ${job.id} - age: ${Math.round(jobAge / 1000 / 60)} minutes`);
            await job.remove();
            cleanedCount++;
            continue;
          }
          
          // FIXED: Check for specific invalid patterns that cause "User undefined not found"
          if (job.data.type === 'notifyAdmin' || job.data.type === 'withdrawal_request') {
            const hasValidUserId = job.data.userId || job.data.data?.userId;
            if (!hasValidUserId) {
              console.log(`[BullMQ] Cleaning invalid admin job ${job.id} - missing userId`);
              await job.remove();
              cleanedCount++;
              continue;
            }
          }
          
          // FIXED: Check for jobs with undefined or null userId
          if (job.data.userId === undefined || job.data.userId === null) {
            console.log(`[BullMQ] Cleaning job ${job.id} - userId is undefined/null`);
            await job.remove();
            cleanedCount++;
            continue;
          }
          
        } catch (cleanupError) {
          console.error(`[BullMQ] Error cleaning job ${job.id}:`, cleanupError.message);
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`[BullMQ] Cleaned ${cleanedCount} invalid/old admin jobs`);
      }
      
    } catch (error) {
      console.error(`[BullMQ] Admin queue cleanup error:`, error.message);
    }
  }, 6 * 60 * 60 * 1000); // Every 6 hours

  return worker;
}

module.exports = startWorker(); 