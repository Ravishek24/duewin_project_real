const { Worker } = require('bullmq');
const { getModels } = require('../models');

const connection = {
  host: '127.0.0.1',
  port: 6379,
  db: 0
};

const worker = new Worker('registration', async job => {
  const { type, data } = job.data;
  
  try {
    const models = await getModels();
    
    switch (type) {
      case 'applyBonus':
        await applyRegistrationBonus(data.userId, models);
        console.log(`[BullMQ] Registration bonus applied for user ${data.userId}`);
        break;
        
      case 'recordReferral':
        await recordReferral(data.userId, data.referredBy, models);
        console.log(`[BullMQ] Referral recorded for user ${data.userId} with code: ${data.referredBy}`);
        break;
        
      default:
        console.error(`[BullMQ] Unknown job type: ${type}`);
    }
  } catch (err) {
    console.error(`[BullMQ] Registration job failed (${type}):`, err.message);
    throw err;
  }
}, { connection });

// Registration bonus application
async function applyRegistrationBonus(userId, models) {
  const REGISTRATION_BONUS = 25.00;
  
  // Credit registration bonus to wallet
  await models.User.increment('wallet_balance', {
    by: REGISTRATION_BONUS,
    where: { user_id: userId }
  });

  // Create transaction record
  await models.Transaction.create({
    user_id: userId,
    type: 'registration_bonus',
    amount: REGISTRATION_BONUS,
    status: 'completed',
    description: 'Welcome bonus for new registration',
    reference_id: `reg_bonus_${userId}_${Date.now()}`,
    metadata: {
      bonus_type: 'registration',
      usage_restriction: 'house_games_only',
      allowed_games: ['wingo', '5d', 'k3', 'trx_wix'],
      restriction_note: 'This bonus can only be used for house games (lottery games)'
    }
  });
}

// Referral recording
async function recordReferral(userId, referredBy, models) {
  const { autoRecordReferral } = require('../services/referralService');
  await autoRecordReferral(userId, referredBy);
}

worker.on('completed', job => {
  console.log(`[BullMQ] Registration job completed:`, job.id);
});

worker.on('failed', (job, err) => {
  console.error(`[BullMQ] Registration job failed:`, job.id, err.message);
});

module.exports = worker; 