const { Worker, Queue } = require('bullmq');
const { getWorkerModels } = require('../workers/workerInit');
const queueConnections = require('../config/queueConfig');

const worker = new Worker('admin', async job => {
  // Support both {type, data} and flat job.data
  let type, data;
  if (job.data && typeof job.data === 'object' && 'type' in job.data && 'data' in job.data) {
    // { type, data }
    type = job.data.type;
    data = job.data.data;
  } else if (job.data && typeof job.data === 'object' && 'type' in job.data) {
    // Flat: { type, ... }
    type = job.data.type;
    data = job.data;
  } else {
    throw new Error('Invalid admin job data structure');
  }
  
  try {
    const models = getWorkerModels(); // No async call - uses pre-initialized models
    
    switch (type) {
      case 'notifyAdmin':
      case 'withdrawal_request': // Accept withdrawal_request as a valid type
        await processAdminNotification(data, models);
        console.log(`[BullMQ] Admin notification sent for ${data.type}`);
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
    console.error(`[BullMQ] Admin job failed (${type}):`, error.message);
    
    // Determine if error is retryable
    if (isRetryableError(error)) {
      throw error; // Will trigger retry
    } else {
      // Log and fail permanently
      await logPermanentFailure(job, error);
      throw new Error(`Non-retryable error: ${error.message}`);
    }
  }
}, { 
  connection: queueConnections.admin,
  concurrency: 2, // Low concurrency for admin tasks
  settings: {
    stalledInterval: 30000,
    maxStalledCount: 1
  }
});

// Enhanced admin notification processing
async function processAdminNotification(data, models) {
  const { type, userId, amount, withdrawalType, orderId } = data;
  try {
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
    const withdrawalQueue = require('./withdrawalQueue');
    withdrawalQueue.add('adminApproval', {
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
  console.error(`[BullMQ] Admin job failed:`, job.id, err.message);
  if (err.name === 'SequelizeDeadlockError') {
    console.error('🚨 DEADLOCK DETECTED in admin worker:', {
      job: job.data,
      timestamp: new Date().toISOString(),
      stack: err.stack
    });
  }
});

const adminQueue = new Queue('admin', { connection: queueConnections.admin });
setInterval(() => {
  adminQueue.clean(24 * 60 * 60 * 1000, 100, 'completed').catch(() => {});
  adminQueue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed').catch(() => {});
}, 6 * 60 * 60 * 1000); // Every 6 hours

module.exports = worker; 