const { Worker } = require('bullmq');
const { getWorkerModels } = require('../workers/workerInit');
const queueConnections = require('../config/queueConfig');
const { processReferralBonus } = require('../services/referralService');

const worker = new Worker('deposits', async job => {
  const { type, data } = job.data;
  
  try {
    const models = getWorkerModels(); // No async call - uses pre-initialized models
    
    switch (type) {
      case 'processDeposit':
        await processDepositWithRetry(data, models);
        console.log(`[BullMQ] Deposit processed for user ${data.userId}, amount: ${data.amount}`);
        break;
        
      case 'applyDepositBonus':
        await applyDepositBonusWithRetry(data, models);
        console.log(`[BullMQ] Deposit bonus applied for user ${data.userId}, bonus: ${data.bonusAmount}`);
        break;
        
      case 'processReferralBonus':
        await processReferralBonusWithRetry(data, models);
        console.log(`[BullMQ] Referral bonus processed for user ${data.userId}`);
        break;
        
      case 'updateDepositStatus':
        await updateDepositStatusWithRetry(data, models);
        console.log(`[BullMQ] Deposit status updated for order ${data.orderId}`);
        break;
        
      default:
        throw new Error(`Unknown deposit job type: ${type}`);
    }
  } catch (error) {
    console.error(`[BullMQ] Deposit job failed (${type}):`, error.message);
    
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
  connection: queueConnections.deposits,
  concurrency: 5, // Limit concurrent deposit jobs
  settings: {
    stalledInterval: 30000,
    maxStalledCount: 1
  }
});

// Enhanced deposit processing with consistent lock ordering and atomic operations
async function processDepositWithRetry(data, models, maxRetries = 3) {
  const { userId, amount, orderId, paymentStatus, bonusAmount } = data;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const transaction = await models.User.sequelize.transaction({
      isolationLevel: models.User.sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
    });
    try {
      // 🚀 Use SELECT FOR UPDATE with SKIP LOCKED for advanced deadlock prevention
      const lockedUsers = await models.sequelize.query(`
        SELECT user_id, wallet_balance, actual_deposit_amount, bonus_amount, has_received_first_bonus 
        FROM users 
        WHERE user_id = :userId 
        FOR UPDATE SKIP LOCKED
      `, {
        replacements: { userId },
        type: models.sequelize.QueryTypes.SELECT,
        transaction
      });
      
      if (lockedUsers.length === 0) {
        // User is locked by another process, skip this attempt
        await transaction.rollback();
        console.log(`Skipping deposit ${orderId} - user ${userId} locked by another process`);
        continue;
      }
      
      const user = lockedUsers[0];
      if (!user) throw new Error(`User ${userId} not found`);
      
      // Check if deposit already processed
      const existingDeposit = await models.WalletRecharge.findOne({
        where: { order_id: orderId, payment_status: 'completed' },
        transaction
      });
      if (existingDeposit) {
        await transaction.commit();
        return { success: true, message: 'Deposit already processed' };
      }
      
      // Create deposit record
      const deposit = await models.WalletRecharge.create({
        user_id: userId,
        amount: amount,
        order_id: orderId,
        payment_status: paymentStatus,
        bonus_amount: bonusAmount,
        created_at: new Date(),
        updated_at: new Date()
      }, { transaction });
      
      // Use atomic increment for wallet balance and bonus
      await models.User.increment({
        wallet_balance: parseFloat(amount) + parseFloat(bonusAmount || 0),
        actual_deposit_amount: parseFloat(amount),
        bonus_amount: parseFloat(bonusAmount || 0),
        has_received_first_bonus: bonusAmount ? true : false
      }, {
        where: { user_id: userId },
        transaction
      });
      
      // Create transaction record
      await models.Transaction.create({
        user_id: userId,
        type: 'deposit',
        amount: parseFloat(amount),
        status: paymentStatus,
        description: 'Deposit processed',
        reference_id: orderId,
        metadata: { deposit_id: deposit.id, bonus: bonusAmount }
      }, { transaction });
      
      await transaction.commit();
      return { success: true, depositId: deposit.id };
    } catch (error) {
      await transaction.rollback();
      if (error.name === 'SequelizeDeadlockError' && attempt < maxRetries) {
        // 🚀 Randomized exponential backoff
        const delay = Math.random() * 100 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

// Enhanced deposit bonus application
async function applyDepositBonusWithRetry(data, models, maxRetries = 3) {
  const { userId, amount, isFirstDeposit } = data;
  
  if (!isFirstDeposit) {
    console.log(`Not first deposit for user ${userId}, skipping bonus`);
    return { success: true, message: 'Not eligible for bonus' };
  }
  
  // Calculate bonus based on amount
  const bonusTiers = [
    { amount: 100, bonus: 20 },
    { amount: 300, bonus: 60 },
    { amount: 1000, bonus: 150 },
    { amount: 3000, bonus: 300 },
    { amount: 10000, bonus: 600 },
    { amount: 30000, bonus: 2000 },
    { amount: 100000, bonus: 7000 },
    { amount: 200000, bonus: 15000 }
  ];
  
  let bonusAmount = 0;
  for (let i = bonusTiers.length - 1; i >= 0; i--) {
    if (parseFloat(amount) >= bonusTiers[i].amount) {
      bonusAmount = bonusTiers[i].bonus;
      break;
    }
  }
  
  if (bonusAmount === 0) {
    console.log(`No bonus applicable for amount ${amount}`);
    return { success: true, message: 'No bonus applicable' };
  }
  
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
      
      // Check if bonus already applied
      if (user.has_received_first_bonus) {
        console.log(`First deposit bonus already applied for user ${userId}`);
        await transaction.commit();
        return { success: true, message: 'Bonus already applied' };
      }
      
      // Apply bonus
      await models.User.update({
        wallet_balance: parseFloat(user.wallet_balance) + bonusAmount,
        bonus_amount: parseFloat(user.bonus_amount) + bonusAmount,
        has_received_first_bonus: true
      }, {
        where: { user_id: userId },
        transaction
      });
      
      // Create bonus transaction record
      await models.Transaction.create({
        user_id: userId,
        type: 'first_deposit_bonus',
        amount: bonusAmount,
        status: 'completed',
        description: 'First deposit bonus',
        reference_id: `first_bonus_${userId}_${Date.now()}`,
        metadata: {
          bonus_type: 'first_deposit',
          deposit_amount: amount,
          usage_restriction: 'house_games_only',
          allowed_games: ['wingo', '5d', 'k3', 'trx_wix']
        }
      }, { transaction });
      
      await transaction.commit();
      console.log(`✅ First deposit bonus applied for user ${userId}: ${bonusAmount}`);
      return { success: true, bonusAmount };
      
    } catch (error) {
      await transaction.rollback();
      
      if (error.name === 'SequelizeDeadlockError' && attempt < maxRetries) {
        console.warn(`Deadlock detected for bonus ${userId}, retrying (${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        continue;
      }
      
      throw error;
    }
  }
}

// Enhanced referral bonus processing
async function processReferralBonusWithRetry(data, models, maxRetries = 3) {
  const { userId, amount } = data;
  
  try {
    // Process referral bonus using existing service
    await processReferralBonus(userId, amount);
    console.log(`✅ Referral bonus processed for user ${userId}`);
    return { success: true };
  } catch (error) {
    console.error(`Failed to process referral bonus for user ${userId}:`, error);
    // Don't retry referral bonus failures as they're not critical
    return { success: false, error: error.message };
  }
}

// Enhanced deposit status update
async function updateDepositStatusWithRetry(data, models, maxRetries = 3) {
  const { orderId, status, transactionId } = data;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const transaction = await models.User.sequelize.transaction();
    
    try {
      const recharge = await models.WalletRecharge.findOne({
        where: { order_id: orderId },
        transaction
      });
      
      if (!recharge) {
        throw new Error(`Recharge order ${orderId} not found`);
      }
      
      await recharge.update({
        status: status,
        transaction_id: transactionId || recharge.transaction_id,
        updated_at: new Date()
      }, { transaction });
      
      await transaction.commit();
      console.log(`✅ Deposit status updated for order ${orderId}: ${status}`);
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
  console.error('Permanent deposit job failure:', {
    jobId: job.id,
    jobData: job.data,
    error: error.message,
    timestamp: new Date().toISOString()
  });
}

worker.on('completed', job => {
  console.log(`[BullMQ] Deposit job completed:`, job.id);
});

worker.on('failed', (job, err) => {
  console.error(`[BullMQ] Deposit job failed:`, job.id, err.message);
  if (err.name === 'SequelizeDeadlockError') {
    console.error('🚨 DEADLOCK DETECTED in deposit worker:', {
      job: job.data,
      timestamp: new Date().toISOString(),
      stack: err.stack
    });
  }
});

module.exports = worker; 