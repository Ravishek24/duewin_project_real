const { Worker, Queue } = require('bullmq');
const { getWorkerModels } = require('../workers/workerInit');
const queueConnections = require('../config/queueConfig');
const redis = require('../config/redisConfig').redis;

const worker = new Worker('withdrawals', async job => {
  const { type, data } = job.data;
  
  try {
    const models = getWorkerModels(); // No async call - uses pre-initialized models
    
    switch (type) {
      case 'processWithdrawal':
        await processWithdrawalWithRetry(data, models);
        console.log(`[BullMQ] Withdrawal processed for user ${data.userId}, amount: ${data.amount}`);
        break;
        
      case 'adminApproval':
        await processAdminApprovalWithRetry(data, models);
        console.log(`[BullMQ] Admin approval processed for withdrawal ${data.withdrawalId}`);
        break;
        
      case 'paymentProcessing':
        await processPaymentWithRetry(data, models);
        console.log(`[BullMQ] Payment processing for withdrawal ${data.withdrawalId}`);
        break;
        
      case 'updateWithdrawalStatus':
        await updateWithdrawalStatusWithRetry(data, models);
        console.log(`[BullMQ] Withdrawal status updated for order ${data.orderId}`);
        break;
        
      case 'refundWithdrawal':
        await refundWithdrawalWithRetry(data, models);
        console.log(`[BullMQ] Withdrawal refunded for user ${data.userId}`);
        break;
        
      default:
        throw new Error(`Unknown withdrawal job type: ${type}`);
    }
  } catch (error) {
    console.error(`[BullMQ] Withdrawal job failed (${type}):`, error.message);
    
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
  connection: queueConnections.withdrawals,
  concurrency: 3, // Limit concurrent withdrawal jobs
  settings: {
    stalledInterval: 30000,
    maxStalledCount: 1
  }
});

// Enhanced withdrawal processing with validation and consistent lock ordering
async function processWithdrawalWithRetry(data, models, maxRetries = 3) {
  const { userId, amount, orderId, withdrawalType, bankAccountId, usdtAccountId } = data;
  const lockKey = `withdrawal:${orderId}:lock`;
  const lockValue = Date.now().toString();
  // Try to acquire lock (5 min expiry)
  const acquired = await redis.set(lockKey, lockValue, 'EX', 300, 'NX');
  if (!acquired) {
    throw new Error('Withdrawal already processing or processed');
  }
  try {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const transaction = await models.User.sequelize.transaction({
        isolationLevel: models.User.sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
      });
      try {
        // Lock user only once
        const user = await models.User.findByPk(userId, {
          lock: transaction.LOCK.UPDATE,
          transaction
        });
        if (!user) {
          throw new Error(`User ${userId} not found`);
        }
        // Check if withdrawal already processed
        const existingWithdrawal = await models.WalletWithdrawal.findOne({
          where: {
            order_id: orderId,
            status: { [models.Sequelize.Op.in]: ['completed', 'processing'] }
          },
          transaction
        });
        if (existingWithdrawal) {
          console.log(`Withdrawal already processed for order ${orderId}`);
          await transaction.commit();
          return { success: true, message: 'Withdrawal already processed' };
        }
        // Validate withdrawal amount
        if (parseFloat(user.wallet_balance) < parseFloat(amount)) {
          throw new Error('Insufficient wallet balance');
        }
        if (parseFloat(amount) > parseFloat(user.actual_deposit_amount)) {
          throw new Error('Withdrawal amount cannot exceed actual deposit amount');
        }
        if (parseFloat(user.total_bet_amount) < parseFloat(user.actual_deposit_amount)) {
          throw new Error('Must bet actual deposit amount before withdrawal');
        }
        // Create withdrawal record
        const withdrawalData = {
          user_id: userId,
          amount: amount,
          order_id: orderId,
          status: 'pending',
          withdrawal_type: withdrawalType,
          created_at: new Date(),
          updated_at: new Date()
        };
        if (withdrawalType === 'BANK' && bankAccountId) {
          withdrawalData.bank_account_id = bankAccountId;
        } else if (withdrawalType === 'USDT' && usdtAccountId) {
          withdrawalData.usdt_account_id = usdtAccountId;
        }
        const withdrawal = await models.WalletWithdrawal.create(withdrawalData, { transaction });
        // Use atomic decrement for wallet balance
        await models.User.decrement('wallet_balance', {
          by: parseFloat(amount),
          where: { user_id: userId },
          transaction
        });
        // Create transaction record
        await models.Transaction.create({
          user_id: userId,
          type: 'withdrawal',
          amount: -parseFloat(amount),
          status: 'pending',
          description: `Withdrawal request - ${withdrawalType}`,
          reference_id: orderId,
          metadata: {
            withdrawal_type: withdrawalType,
            withdrawal_id: withdrawal.id
          }
        }, { transaction });
        await transaction.commit();
        console.log(`✅ Withdrawal processed for user ${userId}: ${amount}`);
        return { success: true, withdrawalId: withdrawal.id };
      } catch (error) {
        await transaction.rollback();
        if (error.name === 'SequelizeDeadlockError' && attempt < maxRetries) {
          console.warn(`Deadlock detected for withdrawal ${orderId}, retrying (${attempt}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
          continue;
        }
        throw error;
      }
    }
  } finally {
    // Only release lock if we still own it
    const script = `if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end`;
    await redis.eval(script, 1, lockKey, lockValue);
  }
}

// Enhanced admin approval processing
async function processAdminApprovalWithRetry(data, models, maxRetries = 3) {
  const { withdrawalId, adminId, action, notes, selectedGateway } = data;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const transaction = await models.User.sequelize.transaction();
    
    try {
      const withdrawal = await models.WalletWithdrawal.findByPk(withdrawalId, {
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      
      if (!withdrawal) {
        throw new Error(`Withdrawal ${withdrawalId} not found`);
      }
      
      if (withdrawal.status !== 'pending') {
        console.log(`Withdrawal ${withdrawalId} is not pending (status: ${withdrawal.status})`);
        await transaction.commit();
        return { success: true, message: 'Withdrawal not in pending status' };
      }
      
      if (action === 'approve') {
        // Update withdrawal status
        await withdrawal.update({
          status: 'approved',
          admin_status: 'approved',
          admin_notes: notes,
          payment_gateway: selectedGateway,
          updated_at: new Date()
        }, { transaction });
        
        // Update transaction status
        await models.Transaction.update({
          status: 'processing',
          description: `Withdrawal approved by admin - ${notes}`
        }, {
          where: {
            user_id: withdrawal.user_id,
            reference_id: withdrawal.order_id
          },
          transaction
        });
        
        console.log(`✅ Withdrawal ${withdrawalId} approved by admin ${adminId}`);
        
      } else if (action === 'reject') {
        // Update withdrawal status
        await withdrawal.update({
          status: 'rejected',
          admin_status: 'rejected',
          admin_notes: notes,
          updated_at: new Date()
        }, { transaction });
        
        // Refund the amount back to user's wallet
        const user = await models.User.findByPk(withdrawal.user_id, {
          lock: transaction.LOCK.UPDATE,
          transaction
        });
        
        if (user) {
          const newBalance = parseFloat(user.wallet_balance) + parseFloat(withdrawal.amount);
          await models.User.update({
            wallet_balance: newBalance
          }, {
            where: { user_id: withdrawal.user_id },
            transaction
          });
          
          // Update transaction status
          await models.Transaction.update({
            status: 'failed',
            description: `Withdrawal rejected by admin - ${notes}`
          }, {
            where: {
              user_id: withdrawal.user_id,
              reference_id: withdrawal.order_id
            },
            transaction
          });
          
          console.log(`✅ Withdrawal ${withdrawalId} rejected and refunded to user ${withdrawal.user_id}`);
        }
      }
      
      await transaction.commit();
      return { success: true, action, withdrawalId };
      
    } catch (error) {
      await transaction.rollback();
      
      if (error.name === 'SequelizeDeadlockError' && attempt < maxRetries) {
        console.warn(`Deadlock detected for admin approval ${withdrawalId}, retrying (${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        continue;
      }
      
      throw error;
    }
  }
}

// Enhanced payment processing
async function processPaymentWithRetry(data, models, maxRetries = 3) {
  const { withdrawalId, paymentGateway } = data;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const transaction = await models.User.sequelize.transaction();
    
    try {
      const withdrawal = await models.WalletWithdrawal.findByPk(withdrawalId, {
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      
      if (!withdrawal) {
        throw new Error(`Withdrawal ${withdrawalId} not found`);
      }
      
      if (withdrawal.status !== 'approved') {
        console.log(`Withdrawal ${withdrawalId} is not approved (status: ${withdrawal.status})`);
        await transaction.commit();
        return { success: true, message: 'Withdrawal not approved' };
      }
      
      // Update status to processing
      await withdrawal.update({
        status: 'processing',
        updated_at: new Date()
      }, { transaction });
      
      // Update transaction status
      await models.Transaction.update({
        status: 'processing',
        description: `Payment processing via ${paymentGateway}`
      }, {
        where: {
          user_id: withdrawal.user_id,
          reference_id: withdrawal.order_id
        },
        transaction
      });
      
      await transaction.commit();
      
      // Here you would integrate with the actual payment gateway
      // For now, we'll simulate successful processing
      console.log(`✅ Payment processing initiated for withdrawal ${withdrawalId} via ${paymentGateway}`);
      
      // Add a job to check payment status after some time
      const paymentQueue = require('./paymentQueue');
      paymentQueue.add('checkPaymentStatus', {
        withdrawalId: withdrawalId,
        paymentGateway: paymentGateway
      }, {
        delay: 30000, // Check after 30 seconds
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      }).catch(console.error);
      
      return { success: true, withdrawalId };
      
    } catch (error) {
      await transaction.rollback();
      
      if (error.name === 'SequelizeDeadlockError' && attempt < maxRetries) {
        console.warn(`Deadlock detected for payment processing ${withdrawalId}, retrying (${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        continue;
      }
      
      throw error;
    }
  }
}

// Enhanced withdrawal status update
async function updateWithdrawalStatusWithRetry(data, models, maxRetries = 3) {
  const { orderId, status, transactionId, failureReason } = data;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const transaction = await models.User.sequelize.transaction();
    
    try {
      const withdrawal = await models.WalletWithdrawal.findOne({
        where: { order_id: orderId },
        transaction
      });
      
      if (!withdrawal) {
        throw new Error(`Withdrawal order ${orderId} not found`);
      }
      
      await withdrawal.update({
        status: status,
        transaction_id: transactionId || withdrawal.transaction_id,
        failure_reason: failureReason,
        updated_at: new Date()
      }, { transaction });
      
      // Update transaction status
      await models.Transaction.update({
        status: status === 'completed' ? 'completed' : 'failed',
        description: status === 'completed' ? 'Withdrawal completed' : `Withdrawal failed: ${failureReason}`
      }, {
        where: {
          user_id: withdrawal.user_id,
          reference_id: orderId
        },
        transaction
      });
      
      await transaction.commit();
      console.log(`✅ Withdrawal status updated for order ${orderId}: ${status}`);
      return { success: true };
      
    } catch (error) {
      await transaction.rollback();
      
      if (error.name === 'SequelizeDeadlockError' && attempt < maxRetries) {
        console.warn(`Deadlock detected for status update ${orderId}, retrying (${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        continue;
      }
      
      throw error;
    }
  }
}

// Enhanced withdrawal refund
async function refundWithdrawalWithRetry(data, models, maxRetries = 3) {
  const { userId, withdrawalId, amount, reason } = data;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const transaction = await models.User.sequelize.transaction();
    
    try {
      const user = await models.User.findByPk(userId, {
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      
      // Refund amount to wallet
      const newBalance = parseFloat(user.wallet_balance) + parseFloat(amount);
      await models.User.update({
        wallet_balance: newBalance
      }, {
        where: { user_id: userId },
        transaction
      });
      
      // Update withdrawal status
      await models.WalletWithdrawal.update({
        status: 'refunded',
        failure_reason: reason,
        updated_at: new Date()
      }, {
        where: { id: withdrawalId },
        transaction
      });
      
      // Create refund transaction record
      await models.Transaction.create({
        user_id: userId,
        type: 'withdrawal_refund',
        amount: parseFloat(amount),
        status: 'completed',
        description: `Withdrawal refund - ${reason}`,
        reference_id: `refund_${withdrawalId}_${Date.now()}`,
        metadata: {
          withdrawal_id: withdrawalId,
          refund_reason: reason
        }
      }, { transaction });
      
      await transaction.commit();
      console.log(`✅ Withdrawal refunded for user ${userId}: ${amount}`);
      return { success: true, newBalance };
      
    } catch (error) {
      await transaction.rollback();
      
      if (error.name === 'SequelizeDeadlockError' && attempt < maxRetries) {
        console.warn(`Deadlock detected for refund ${userId}, retrying (${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        continue;
      }
      
      throw error;
    }
  }
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
  console.error('Permanent withdrawal job failure:', {
    jobId: job.id,
    jobData: job.data,
    error: error.message,
    timestamp: new Date().toISOString()
  });
}

worker.on('completed', job => {
  console.log(`[BullMQ] Withdrawal job completed:`, job.id);
});

worker.on('failed', (job, err) => {
  console.error(`[BullMQ] Withdrawal job failed:`, job.id, err.message);
  if (err.name === 'SequelizeDeadlockError') {
    console.error('🚨 DEADLOCK DETECTED in withdrawal worker:', {
      job: job.data,
      timestamp: new Date().toISOString(),
      stack: err.stack
    });
  }
});

const withdrawalQueue = new Queue('withdrawals', { connection: queueConnections.withdrawals });
setInterval(() => {
  withdrawalQueue.clean(24 * 60 * 60 * 1000, 100, 'completed').catch(() => {});
  withdrawalQueue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed').catch(() => {});
}, 6 * 60 * 60 * 1000); // Every 6 hours

module.exports = worker; 