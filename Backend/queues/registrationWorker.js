const { Worker } = require('bullmq');
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
        
      case 'recordReferral':
        await recordReferralWithRetry(data.userId, data.referredBy, models);
        console.log(`[BullMQ] Referral recorded for user ${data.userId} with code: ${data.referredBy}`);
        break;
        
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
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const transaction = await models.User.sequelize.transaction({
      isolationLevel: models.User.sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
    });
    
    try {
      // Use FOR UPDATE to prevent race conditions
      const user = await models.User.findByPk(userId, {
        lock: transaction.LOCK.UPDATE,
        transaction
      });
      
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      
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
        await transaction.commit();
        return { success: true, message: 'Bonus already applied' };
      }
      
      // Apply bonus atomically
      const BONUS_AMOUNT = 25.00;
      
      await models.User.increment('wallet_balance', {
        by: BONUS_AMOUNT,
        where: { user_id: userId },
        transaction
      });
      
      await models.Transaction.create({
        user_id: userId,
        type: 'referral_bonus', // Use existing enum value
        amount: BONUS_AMOUNT,
        status: 'completed',
        description: 'Welcome bonus for new registration',
        reference_id: `reg_bonus_${userId}_${Date.now()}`,
        metadata: {
          bonus_type: 'registration',
          usage_restriction: 'house_games_only',
          allowed_games: ['wingo', '5d', 'k3', 'trx_wix'],
          restriction_note: 'This bonus can only be used for house games (lottery games)',
          applied_at: new Date().toISOString()
        }
      }, { transaction });
      
      await transaction.commit();
      console.log(`✅ Registration bonus applied for user ${userId}`);
      return { success: true, amount: BONUS_AMOUNT };
      
    } catch (error) {
      await transaction.rollback();
      
      // Check if it's a deadlock error
      if (error.name === 'SequelizeDeadlockError' && attempt < maxRetries) {
        console.warn(`Deadlock detected for user ${userId}, retrying (${attempt}/${maxRetries})`);
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
        continue;
      }
      
      console.error(`Failed to apply bonus for user ${userId} (attempt ${attempt}):`, error);
      throw error;
    }
  }
}

// Enhanced referral recording with deadlock prevention
async function recordReferralWithRetry(userId, referredBy, models, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const transaction = await models.User.sequelize.transaction({
      isolationLevel: models.User.sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED
    });
    
    try {
      // Always acquire locks in consistent order: Users first, then Referrals
      const [referrer, newUser] = await Promise.all([
        models.User.findOne({
          where: { referring_code: referredBy },
          lock: transaction.LOCK.UPDATE,
          transaction
        }),
        models.User.findByPk(userId, {
          lock: transaction.LOCK.UPDATE,
          transaction
        })
      ]);
      
      if (!referrer) {
        throw new Error(`Invalid referral code: ${referredBy}`);
      }
      
      if (!newUser) {
        throw new Error(`User ${userId} not found`);
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
      
      // Update referrer's referral count
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
});

module.exports = worker; 