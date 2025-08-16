const { Worker, Queue } = require('bullmq');
const { getWorkerModels } = require('../workers/workerInit');
const { createWorker, createQueue } = require('../config/queueConfig');
const unifiedRedis = require('../config/unifiedRedisManager');

async function startWorker() {
  await unifiedRedis.initialize();
  // connections handled within createWorker/createQueue via unifiedRedis

  const worker = createWorker('registration', async job => {
    try {
      // CRITICAL: Log everything about the job at the very beginning
      console.log(`\n🚨 [REGISTRATION WORKER DEBUG] ==========================================`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG] JOB RECEIVED - COMPLETE ANALYSIS:`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Job ID: ${job.id}`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Job Name: ${job.name}`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Job Queue Name: ${job.queueName}`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Job Data Type: ${typeof job.data}`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Job Data (RAW):`, job.data);
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Job Data (JSON):`, JSON.stringify(job.data, null, 2));
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Job Timestamp: ${job.timestamp}`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Job Processed On: ${job.processedOn}`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Job Created At: ${new Date(job.timestamp).toISOString()}`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Job Attempts Made: ${job.attemptsMade}`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Job Max Attempts: ${job.opts?.attempts || 'not set'}`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Job Priority: ${job.opts?.priority || 'not set'}`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Job Delay: ${job.opts?.delay || 'not set'}`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Job Options:`, JSON.stringify(job.opts, null, 2));
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Job Stack Trace (where created):`, job.stacktrace || 'not available');
      console.log(`🚨 [REGISTRATION WORKER DEBUG] ==========================================\n`);
      
      // Enhanced job data validation and logging
      console.log(`[BullMQ] Processing registration job:`, {
        jobId: job.id,
        jobName: job.name,
        jobData: job.data,
        timestamp: new Date().toISOString()
      });
      
      // FIXED: Handle job data structure correctly with comprehensive debugging
      let type, data, userId;
      
      console.log(`[BullMQ] 🔍 DEBUG: Job data analysis:`, {
        jobName: job.name,
        jobDataType: typeof job.data,
        jobDataKeys: job.data ? Object.keys(job.data) : 'null',
        jobData: job.data,
        jobDataStringified: JSON.stringify(job.data, null, 2)
      });
      
      // CRITICAL: Log the exact structure we're receiving
      if (job.data) {
        console.log(`🚨 [REGISTRATION WORKER DEBUG] DETAILED STRUCTURE ANALYSIS:`);
        console.log(`🚨 [REGISTRATION WORKER DEBUG] Object.keys(job.data):`, Object.keys(job.data));
        console.log(`🚨 [REGISTRATION WORKER DEBUG] Object.values(job.data):`, Object.values(job.data));
        console.log(`🚨 [REGISTRATION WORKER DEBUG] Structure Check:`, {
          hasType: 'type' in job.data,
          hasData: 'data' in job.data,
          hasUserId: 'userId' in job.data,
          hasUserData: 'userData' in job.data,
          hasUserIdInData: job.data.data && 'userId' in job.data.data,
          typeValue: job.data.type,
          typeValueType: typeof job.data.type,
          dataValue: job.data.data,
          dataValueType: typeof job.data.data,
          userIdValue: job.data.userId,
          userIdValueType: typeof job.data.userId,
          userDataValue: job.data.userData,
          userDataValueType: typeof job.data.userData,
          userIdInDataValue: job.data.data ? job.data.data.userId : 'N/A',
          userIdInDataValueType: job.data.data ? typeof job.data.data.userId : 'N/A'
        });
        console.log(`🚨 [REGISTRATION WORKER DEBUG] All possible userId locations:`, {
          'job.data.userId': job.data.userId,
          'job.data.data.userId': job.data.data?.userId,
          'job.data.user_id': job.data.user_id,
          'job.data.data.user_id': job.data.data?.user_id,
          'job.data.userData.userId': job.data.userData?.userId,
          'job.data.userData.user_id': job.data.userData?.user_id
        });
      } else {
        console.log(`🚨 [REGISTRATION WORKER DEBUG] ❌ NO JOB DATA FOUND!`);
      }
      
      // SIMPLE AND DIRECT: Extract based on the actual structure being created
      console.log(`🚨 [REGISTRATION WORKER DEBUG] STARTING EXTRACTION PROCESS:`);
      
      // Check nested structure: { type: 'applyBonus', data: { userId: 123 } }
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Checking nested structure...`);
      if (job.data && job.data.type && job.data.data && job.data.data.userId) {
        type = job.data.type;
        data = job.data.data;
        userId = data.userId;
        console.log(`🚨 [REGISTRATION WORKER DEBUG] ✅ NESTED STRUCTURE MATCHED:`, {
          type: type,
          userId: userId,
          userIdType: typeof userId,
          data: data
        });
      } 
      // Check flat structure with type: { type: 'applyBonus', userId: 123 }
      else if (job.data && job.data.type && job.data.userId) {
        type = job.data.type;
        data = job.data;
        userId = data.userId;
        console.log(`🚨 [REGISTRATION WORKER DEBUG] ✅ FLAT STRUCTURE MATCHED:`, {
          type: type,
          userId: userId,
          userIdType: typeof userId,
          data: data
        });
      } 
      // Check direct structure: { userId: 123 }
      else if (job.data && job.data.userId) {
        type = job.name || 'unknown';
        data = job.data;
        userId = data.userId;
        console.log(`🚨 [REGISTRATION WORKER DEBUG] ✅ DIRECT STRUCTURE MATCHED:`, {
          type: type,
          userId: userId,
          userIdType: typeof userId,
          data: data
        });
      } 
      // Check alternative worker manager structure: { userId, userData }
      else if (job.data && job.data.userId && job.data.userData) {
        type = job.name || 'workerManager';
        data = job.data;
        userId = job.data.userId;
        console.log(`🚨 [REGISTRATION WORKER DEBUG] ✅ WORKER MANAGER STRUCTURE MATCHED:`, {
          type: type,
          userId: userId,
          userIdType: typeof userId,
          userData: job.data.userData
        });
      }
      else {
        // Try to extract from any available structure
        console.log(`🚨 [REGISTRATION WORKER DEBUG] ⚠️ NO STANDARD STRUCTURE MATCHED - ATTEMPTING FALLBACK...`);
        
        if (job.data && typeof job.data === 'object') {
          // Try to find userId anywhere in the data
          const findUserId = (obj) => {
            console.log(`🚨 [REGISTRATION WORKER DEBUG] Searching for userId in:`, obj);
            
            // Check all possible locations for userId
            if (obj.userId) {
              console.log(`🚨 [REGISTRATION WORKER DEBUG] Found userId at obj.userId:`, obj.userId);
              return obj.userId;
            }
            if (obj.data && obj.data.userId) {
              console.log(`🚨 [REGISTRATION WORKER DEBUG] Found userId at obj.data.userId:`, obj.data.userId);
              return obj.data.userId;
            }
            if (obj.user_id) {
              console.log(`🚨 [REGISTRATION WORKER DEBUG] Found userId at obj.user_id:`, obj.user_id);
              return obj.user_id;
            }
            
            // Check if it's in a nested structure
            if (obj.data && typeof obj.data === 'object') {
              if (obj.data.userId) {
                console.log(`🚨 [REGISTRATION WORKER DEBUG] Found userId at obj.data.userId (nested):`, obj.data.userId);
                return obj.data.userId;
              }
              if (obj.data.user_id) {
                console.log(`🚨 [REGISTRATION WORKER DEBUG] Found userId at obj.data.user_id (nested):`, obj.data.user_id);
                return obj.data.user_id;
              }
            }
            
            console.log(`🚨 [REGISTRATION WORKER DEBUG] No userId found in object`);
            return null;
          };
          
          userId = findUserId(job.data);
          type = job.name || job.data.type || 'unknown';
          data = job.data;
          
          if (userId) {
            console.log(`🚨 [REGISTRATION WORKER DEBUG] ✅ FALLBACK EXTRACTION SUCCESSFUL:`, {
              type: type,
              userId: userId,
              userIdType: typeof userId
            });
          } else {
            console.log(`🚨 [REGISTRATION WORKER DEBUG] ❌ FALLBACK EXTRACTION FAILED - NO USERID FOUND`);
            console.log(`🚨 [REGISTRATION WORKER DEBUG] COMPLETE FAILURE ANALYSIS:`, {
              jobId: job.id,
              jobName: job.name,
              jobQueueName: job.queueName,
              jobData: job.data,
              jobDataKeys: Object.keys(job.data || {}),
              jobDataValues: Object.values(job.data || {}),
              jobDataStringified: JSON.stringify(job.data, null, 2),
              jobTimestamp: job.timestamp,
              jobCreatedAt: new Date(job.timestamp).toISOString(),
              jobAttempts: job.attemptsMade
            });
          }
        } else {
          console.log(`🚨 [REGISTRATION WORKER DEBUG] ❌ JOB DATA IS NOT AN OBJECT OR IS NULL`);
        }
      }
      
      // CRITICAL: If we still don't have userId, try to extract it from the job name
      if (!userId && job.name) {
        console.log(`[BullMQ] 🔍 Attempting to extract userId from job name: ${job.name}`);
        
        // Check if job name follows pattern: bonus-{userId}
        if (job.name.startsWith('bonus-')) {
          const extractedUserId = job.name.replace('bonus-', '');
          if (extractedUserId && !isNaN(extractedUserId)) {
            userId = parseInt(extractedUserId);
            type = 'applyBonus';
            data = job.data || {};
            console.log(`[BullMQ] ✅ Extracted userId from job name: ${userId}`);
          }
        }
        
        // Check if job name follows pattern: attendance:{userId}:{date}
        if (job.name.startsWith('attendance:')) {
          const parts = job.name.split(':');
          if (parts.length >= 2) {
            const extractedUserId = parts[1];
            if (extractedUserId && !isNaN(extractedUserId)) {
              userId = parseInt(extractedUserId);
              type = 'attendance';
              data = job.data || {};
              console.log(`[BullMQ] ✅ Extracted userId from job name: ${userId}`);
            }
          }
        }
      }
      
      // CRITICAL: Final validation and logging
      console.log(`\n🚨 [REGISTRATION WORKER DEBUG] FINAL EXTRACTION RESULTS:`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Final Type: ${type} (${typeof type})`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Final Data:`, JSON.stringify(data, null, 2));
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Final UserId: ${userId} (${typeof userId})`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Final UserId Valid: ${userId && userId !== undefined && userId !== null && userId !== 'undefined'}`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG] Validation Status:`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG]   - Type exists: ${!!type}`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG]   - Data exists: ${!!data && typeof data === 'object'}`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG]   - UserId exists: ${!!userId}`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG]   - UserId is not undefined: ${userId !== undefined}`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG]   - UserId is not null: ${userId !== null}`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG]   - UserId is not string 'undefined': ${userId !== 'undefined'}`);
      console.log(`🚨 [REGISTRATION WORKER DEBUG] ==========================================\n`);
      
      // Validate required data
      if (!type) {
        throw new Error('Job type is missing');
      }
      
      if (!data || typeof data !== 'object') {
        throw new Error('Job data is missing or invalid');
      }
      
      if (!userId) {
        // FIXED: Better error message with job details
        console.error(`[BullMQ] ❌ CRITICAL: User ID extraction failed:`, {
          jobId: job.id,
          jobName: job.name,
          jobData: job.data,
          extractedType: type,
          extractedData: data,
          extractedUserId: userId
        });
        throw new Error(`User ID extraction failed for job type: ${type}. Job data: ${JSON.stringify(job.data)}`);
      }
      
      console.log(`[BullMQ] 🎯 Processing job: type=${type}, userId=${userId}`);
      
      const models = getWorkerModels();
      switch (type) {
        case 'applyBonus':
          await applyRegistrationBonusWithRetry(userId, models);
          console.log(`[BullMQ] Registration bonus applied for user ${userId}`);
          break;
        case 'recordReferral': {
          const referralService = require('../services/referralService');
          await referralService.autoRecordReferral(userId, data.referredBy);
          console.log(`[BullMQ] Referral tree (multi-level) processed for user ${userId} with code: ${data.referredBy}`);
          break;
        }
        default:
          throw new Error(`Unknown job type: ${type}`);
      }
    } catch (error) {
      console.error(`[BullMQ] ❌ REGISTRATION JOB FAILED:`, {
        jobId: job.id,
        jobName: job.name,
        jobData: job.data,
        error: error.message,
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
    concurrency: 3
  });

  // Enhanced bonus application with deadlock prevention
  async function applyRegistrationBonusWithRetry(userId, models, maxRetries = 3) {
    // FIXED: Use unified Redis helper instead of direct connection
    const redisHelper = await unifiedRedis.getHelper();
    if (!redisHelper) {
      throw new Error('Redis helper not available');
    }
    
    const deduplicationKey = `registration_bonus:${userId}`;
    const cronDeduplicationKey = `registration_bonus_cron:${userId}`;
    
    // Check if already processed by this worker
    const isAlreadyProcessed = await redisHelper.get(deduplicationKey);
    if (isAlreadyProcessed) {
      console.log(`Registration bonus already processed for user ${userId}`);
      return { success: true, message: 'Bonus already applied' };
    }
    
    // Check if cron job is processing this user
    const isCronProcessing = await redisHelper.get(cronDeduplicationKey);
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
            type: 'registration_bonus' // Use correct enum value for registration bonus
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
            type: 'registration_bonus', // Use correct enum value for registration bonus
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

          // Create RebateTeam entry for new user
          await models.RebateTeam.create({
            user_id: userId,
            current_rebet_level: 0,
            current_team_number: 0,
            current_deposit: 0.00,
            level_1_count: 0,
            level_2_count: 0,
            level_3_count: 0,
            level_4_count: 0,
            level_5_count: 0,
            level_6_count: 0,
            last_updated: new Date()
          }, { transaction });
          
          await transaction.commit();
          finished = true;
          
          // Set deduplication flag (expires in 30 days)
          await redisHelper.set(deduplicationKey, '1', null, 2592000);
          
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

        // Create or update RebateTeam entry for referrer
        await models.RebateTeam.findOrCreate({
          where: { user_id: referrer.user_id },
          defaults: {
            user_id: referrer.user_id,
            current_rebet_level: 0,
            current_team_number: 0,
            current_deposit: 0.00,
            level_1_count: 0,
            level_2_count: 0,
            level_3_count: 0,
            level_4_count: 0,
            level_5_count: 0,
            level_6_count: 0,
            last_updated: new Date()
          },
          transaction
        });

        // Increment level_1_count for referrer
        await models.RebateTeam.increment('level_1_count', {
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
    console.error(`[BullMQ] 🚨 WORKER EVENT HANDLER - Job failed:`, {
      jobId: job.id,
      jobName: job.name,
      jobData: job.data,
      error: err.message,
      errorName: err.name,
      errorStack: err.stack,
      timestamp: new Date().toISOString(),
      errorLocation: 'Worker failed event handler'
    });
    
    // FIXED: Better error categorization
    if (err.name === 'SequelizeDeadlockError') {
      console.error('🚨 DEADLOCK DETECTED in registration worker:', {
        job: job.data,
        timestamp: new Date().toISOString(),
        stack: err.stack
      });
    } else if (err.message.includes('User ID extraction failed')) {
      console.error('🚨 CRITICAL: User ID extraction failed in registration job:', {
        jobId: job.id,
        jobData: job.data,
        timestamp: new Date().toISOString()
      });
    } else if (err.message.includes('User undefined not found')) {
      console.error('🚨 CRITICAL: User undefined error in registration job:', {
        jobId: job.id,
        jobData: job.data,
        timestamp: new Date().toISOString()
      });
    } else if (err.message.includes('User ID is missing')) {
      console.error('⚠️ USER ID MISSING in registration job:', {
        jobId: job.id,
        jobData: job.data,
        timestamp: new Date().toISOString()
      });
    }
  });

  const registrationQueue = await createQueue('registration');
  
  // FIXED: Immediately clean up any invalid jobs on startup
  try {
    console.log(`[BullMQ] 🧹 Cleaning up invalid jobs on startup...`);
    const allJobs = await registrationQueue.getJobs(['waiting', 'active', 'delayed'], 0, 1000);
    let cleanedCount = 0;
    
    for (const job of allJobs) {
      try {
        // Check if job has valid structure
        let hasValidStructure = false;
        
        if (job.data && job.data.type && job.data.data && job.data.data.userId) {
          hasValidStructure = true;
        } else if (job.data && job.data.type && job.data.userId) {
          hasValidStructure = true;
        } else if (job.data && job.data.userId) {
          hasValidStructure = true;
        } else if (job.name && (job.name.startsWith('bonus-') || job.name.startsWith('attendance:'))) {
          // Job name contains userId, so it's valid
          hasValidStructure = true;
        }
        
        if (!hasValidStructure) {
          console.log(`[BullMQ] 🗑️ Cleaning invalid job on startup: ${job.id} - ${job.name}`);
          await job.remove();
          cleanedCount++;
        }
      } catch (cleanupError) {
        console.error(`[BullMQ] Error cleaning job ${job.id} on startup:`, cleanupError.message);
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`[BullMQ] ✅ Cleaned ${cleanedCount} invalid jobs on startup`);
    }
  } catch (error) {
    console.error(`[BullMQ] Startup cleanup error:`, error.message);
  }
  
  // FIXED: Enhanced queue cleanup and maintenance
  setInterval(async () => {
    try {
      // Clean completed jobs
      await registrationQueue.clean(24 * 60 * 60 * 1000, 100, 'completed');
      
      // Clean failed jobs
      await registrationQueue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed');
      
      // FIXED: Clean old invalid jobs that might be causing issues
      const oldJobs = await registrationQueue.getJobs(['waiting', 'active', 'delayed'], 0, 1000);
      let cleanedCount = 0;
      
      for (const job of oldJobs) {
        try {
          // Check if job data is valid
          if (!job.data || typeof job.data !== 'object') {
            console.log(`[BullMQ] Cleaning invalid registration job ${job.id} - no data`);
            await job.remove();
            cleanedCount++;
            continue;
          }
          
          // Check if job is too old (more than 1 hour)
          const jobAge = Date.now() - job.timestamp;
          if (jobAge > 60 * 60 * 1000) { // 1 hour
            console.log(`[BullMQ] Cleaning old registration job ${job.id} - age: ${Math.round(jobAge / 1000 / 60)} minutes`);
            await job.remove();
            cleanedCount++;
            continue;
          }
          
          // Check for jobs with missing or invalid userId
          let hasValidUserId = false;
          if (job.data.userId) {
            hasValidUserId = true;
          } else if (job.data.data && job.data.data.userId) {
            hasValidUserId = true;
          } else if (job.data.user_id) {
            hasValidUserId = true;
          }
          
          if (!hasValidUserId) {
            console.log(`[BullMQ] Cleaning invalid registration job ${job.id} - missing userId`);
            await job.remove();
            cleanedCount++;
            continue;
          }
          
        } catch (cleanupError) {
          console.error(`[BullMQ] Error cleaning registration job ${job.id}:`, cleanupError.message);
        }
      }
      
      if (cleanedCount > 0) {
        console.log(`[BullMQ] Cleaned ${cleanedCount} invalid/old registration jobs`);
      }
      
    } catch (error) {
      console.error(`[BullMQ] Registration queue cleanup error:`, error.message);
    }
  }, 6 * 60 * 60 * 1000); // Every 6 hours

  return worker;
}

module.exports = startWorker(); 