const { Worker, Queue } = require('bullmq');
const { getWorkerModels } = require('../workers/workerInit');
const queueConnections = require('../config/queueConfig');

const worker = new Worker('registration', async job => {
  const { type, data } = job.data;
  
  try {
    const models = getWorkerModels(); // No async call - uses pre-initialized models
    
    switch (type) {
      case 'applyBonus':
        await applyRegistrationBonusWithRetry(data.userId, models);
        console.log(`[BullMQ] Registration bonus applied for user ${data.userId}`);
        break;
        
      case 'recordReferral': {
        // Import referralService here to avoid circular dependency at top
        const referralService = require('../services/referralService');
        // Use the correct multi-level referral tree logic
        await referralService.autoRecordReferral(data.userId, data.referredBy);
        console.log(`[BullMQ] Referral tree (multi-level) processed for user ${data.userId} with code: ${data.referredBy}`);
        break;
      }
        
      default:
        throw new Error(`Unknown job type: ${type}`);
    }
  } catch (error) {
    console.error(`[BullMQ] Registration job failed (${type}):`, error.message);
    
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
  connection: queueConnections.registration,
  concurrency: 3, // Limit concurrent jobs to prevent resource exhaustion
  settings: {
    stalledInterval: 30000,
    maxStalledCount: 1
  }
});

// Enhanced bonus application with deadlock prevention
async function applyRegistrationBonusWithRetry(userId, models, maxRetries = 3) {
  const redis = require('../config/redisConfig').redis;
  const deduplicationKey = `registration_bonus:${userId}`;
  const cronDeduplicationKey = `registration_bonus_cron:${userId}`;
  
  // Check if already processed by this worker
  const isAlreadyProcessed = await redis.get(deduplicationKey);
  if (isAlreadyProcessed) {
    console.log(`Registration bonus already processed for user ${userId}`);
    return { success: true, message: 'Bonus already applied' };
  }
  
  // Check if cron job is processing this user
  const isCronProcessing = await redis.get(cronDeduplicationKey);
  if (isCronProcessing) {
    console.log(`Cron job is processing registration bonus for user ${userId}, skipping...`);
    return { success: true, message: 'Cron job is processing' };
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const transaction = await models.User.sequelize.transaction();
    let finished = false;
    
    try {
      // Check if bonus already applied
      const existingBonus = await models.Transaction.findOne({
        where: {
          user_id: userId,
          type: 'referral_bonus' // Use existing enum value
        },
        transaction
      });
      
      if (existingBonus) {
        console.log(`Registration bonus already applied for user ${userId}`);
        finished = true;
        // No rollback needed here, just return
        return { success: true, message: 'Bonus already applied' };
      }
      
      // Apply bonus atomically
      const BONUS_AMOUNT = 25.00;
      
      // If registration bonus is to be applied, use atomic increment
      if (BONUS_AMOUNT && BONUS_AMOUNT > 0) {
        await models.User.increment('wallet_balance', {
          by: BONUS_AMOUNT,
          where: { user_id: userId },
          transaction
        });
        
        // Create transaction record
        await models.Transaction.create({
          user_id: userId,
          type: 'referral_bonus', // Use existing enum value
          amount: BONUS_AMOUNT,
          status: 'completed',
          description: 'Welcome bonus for new registration',
          reference_id: `reg_bonus_${userId}_${Date.now()}`,
          metadata: {
            bonus_type: 'registration',
            registration_date: new Date()
          },
          restriction_note: 'This bonus can only be used for house games (lottery games)'
        }, { transaction });
        
        await transaction.commit();
        finished = true;
        
        // Set deduplication flag (expires in 30 days)
        await redis.set(deduplicationKey, '1', 'EX', 2592000);
        
        console.log(`✅ Registration bonus applied for user ${userId}`);
        return { success: true, amount: BONUS_AMOUNT };
      }
      
      // No commit or rollback needed here, just return
      finished = true;
      return { success: true, message: 'No bonus applicable' };
    } catch (error) {
      if (!finished) {
        await transaction.rollback();
      }
      
      if (error.name === 'SequelizeDeadlockError' && attempt < maxRetries) {
        console.warn(`Deadlock detected for registration bonus ${userId}, retrying (${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        continue;
      }
      
      console.error(`Failed to apply bonus for user ${userId} (attempt ${attempt}):`, error);
      throw error;
    }
  }
}

// Enhanced referral recording with deadlock prevention and consistent lock ordering
async function recordReferralWithRetry(userId, referredBy, models, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const transaction = await models.User.sequelize.transaction({
      isolationLevel: models.User.sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
    });
    try {
      // Find referrer and new user IDs first
      const referrer = await models.User.findOne({
        where: { referring_code: referredBy },
        attributes: ['user_id']
      });
      const newUser = await models.User.findByPk(userId, { attributes: ['user_id'] });
      if (!referrer) throw new Error(`Invalid referral code: ${referredBy}`);
      if (!newUser) throw new Error(`User ${userId} not found`);
      
      // 🚀 CRITICAL: Always lock in ascending order to prevent deadlocks
      const lockIds = [referrer.user_id, newUser.user_id].sort((a, b) => a - b);
      
      // 🚀 Use SELECT FOR UPDATE with SKIP LOCKED for advanced deadlock prevention
      const lockedUsers = await models.sequelize.query(`
        SELECT user_id FROM users 
        WHERE user_id IN (:userIds) 
        FOR UPDATE SKIP LOCKED
      `, {
        replacements: { userIds: lockIds },
        type: models.sequelize.QueryTypes.SELECT,
        transaction
      });
      
      if (lockedUsers.length !== 2) {
        // Another process is working on these users, skip this attempt
        await transaction.rollback();
        console.log(`Skipping referral ${userId} - users already locked by another process`);
        continue;
      }
      
      // Check if referral already recorded
      const existingReferral = await models.ReferralTree.findOne({
        where: {
          referrer_id: referrer.user_id,
          referred_id: userId
        },
        transaction
      });
      if (existingReferral) {
        console.log(`Referral already recorded for user ${userId}`);
        await transaction.commit();
        return { success: true, message: 'Referral already recorded' };
      }
      
      // Create referral record
      await models.ReferralTree.create({
        referrer_id: referrer.user_id,
        referred_id: userId,
        level: 1,
        status: 'active',
        created_at: new Date()
      }, { transaction });
      
      // Update referrer's referral count (atomic increment)
      await models.User.increment('direct_referral_count', {
        by: 1,
        where: { user_id: referrer.user_id },
        transaction
      });
      
      await transaction.commit();
      console.log(`✅ Referral recorded: ${referrer.user_id} -> ${userId}`);
      return { success: true };
    } catch (error) {
      await transaction.rollback();
      if (error.name === 'SequelizeDeadlockError' && attempt < maxRetries) {
        console.warn(`Deadlock detected for referral ${userId}, retrying (${attempt}/${maxRetries})`);
        // 🚀 Randomized exponential backoff
        const delay = Math.random() * 100 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
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
  console.error('Permanent job failure:', {
    jobId: job.id,
    jobData: job.data,
    error: error.message,
    timestamp: new Date().toISOString()
  });
  
  // Could also store in database for monitoring
}

worker.on('completed', job => {
  console.log(`[BullMQ] Registration job completed:`, job.id);
});

worker.on('failed', (job, err) => {
  console.error(`[BullMQ] Registration job failed:`, job.id, err.message);
  if (err.name === 'SequelizeDeadlockError') {
    console.error('🚨 DEADLOCK DETECTED in registration worker:', {
      job: job.data,
      timestamp: new Date().toISOString(),
      stack: err.stack
    });
  }
});

const registrationQueue = new Queue('registration', { connection: queueConnections.registration });
setInterval(() => {
  registrationQueue.clean(24 * 60 * 60 * 1000, 100, 'completed').catch(() => {});
  registrationQueue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed').catch(() => {});
}, 6 * 60 * 60 * 1000); // Every 6 hours

module.exports = worker; 