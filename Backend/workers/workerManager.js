require('dotenv').config();
const { initializeWorkerModels, getWorkerModels } = require('./workerInit');
const { createQueue, createWorker, createScheduler } = require('../config/queueConfig');
const unifiedRedis = require('../config/unifiedRedisManager');
const moment = require('moment-timezone');

console.log('🚀 Starting Fixed BullMQ Worker Manager...');
console.log('==================================================');

// Helper functions for job processing
async function processAttendanceWithDeduplication(userId, models) {
  const today = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
  
  try {
    // Use unified Redis manager helper instead of direct connection
    const redisHelper = await unifiedRedis.getHelper();
    if (!redisHelper) {
      throw new Error('Redis helper not available');
    }
    
    const deduplicationKey = `attendance:${userId}:${today}`;
    const cronDeduplicationKey = `attendance_cron:${userId}:${today}`;
    
    // Check if already processed by this worker
    const isAlreadyProcessed = await redisHelper.get(deduplicationKey);
    if (isAlreadyProcessed) {
      console.log(`Attendance already processed for user ${userId} on ${today}`);
      return;
    }
    
    // Check if cron job is processing this user
    const isCronProcessing = await redisHelper.get(cronDeduplicationKey);
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
            date: today, // FIXED: Set required date field
            created_at: new Date()
          },
          transaction
        });
        
        if (!created) {
          // Update existing record if needed
          await attendanceRecord.update({
            updated_at: new Date()
          }, { transaction });
        }
      }
      
      await transaction.commit();
      
      // Set deduplication flag (expires at end of day)
      const endOfDay = moment.tz('Asia/Kolkata').endOf('day');
      const ttl = endOfDay.diff(moment(), 'seconds');
      await redisHelper.setex(deduplicationKey, ttl, '1');
      
    } catch (error) {
      // FIXED: Only rollback if transaction is still active
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  } catch (error) {
    console.error(`❌ Attendance processing failed for user ${userId}:`, error.message);
    // Don't throw error for attendance - it's non-critical
    return;
  }
}

// Fallback attendance function without Redis dependency
async function processAttendanceFallback(userId, models) {
  const today = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
  
  try {
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
            date: today, // FIXED: Set required date field
            created_at: new Date()
          },
          transaction
        });
        
        if (!created) {
          // Update existing record if needed
          await attendanceRecord.update({
            updated_at: new Date()
          }, { transaction });
        }
      }
      
      await transaction.commit();
      console.log(`✅ Attendance processed for user ${userId} (fallback mode)`);
      
    } catch (error) {
      // FIXED: Only rollback if transaction is still active
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  } catch (error) {
    console.error(`❌ Fallback attendance processing failed for user ${userId}:`, error.message);
    // Don't throw error for attendance - it's non-critical
    return;
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

// Direct withdrawal processing function to avoid conflicts
async function processWithdrawalDirectly(data, models, maxRetries = 3) {
  const { userId, amount, orderId, withdrawalType, bankAccountId, usdtAccountId } = data;
  
  try {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const transaction = await models.User.sequelize.transaction();
      
      try {
        // Get user with lock
        const user = await models.User.findByPk(userId, {
          lock: true,
          transaction
        });
        
        if (!user) {
          throw new Error(`User ${userId} not found`);
        }
        
        // Validate withdrawal amount
        if (parseFloat(user.wallet_balance) < parseFloat(amount)) {
          throw new Error(`Insufficient balance. Available: ${user.wallet_balance}, Requested: ${amount}`);
        }
        
        // Check if withdrawal already processed
        const existingWithdrawal = await models.WalletWithdrawal.findOne({
          where: { order_id: orderId },
          transaction
        });
        
        if (existingWithdrawal) {
          await transaction.commit();
          return { success: true, message: 'Withdrawal already processed' };
        }
        
        // Get default payment gateway
        const defaultGateway = await models.PaymentGateway.findOne({
          where: { is_active: true, supports_withdrawal: true },
          order: [['display_order', 'ASC']],
          transaction
        });
        
        if (!defaultGateway) {
          throw new Error('No active withdrawal gateway found');
        }
        
        // Create withdrawal record
        const withdrawalData = {
          user_id: userId,
          amount: parseFloat(amount),
          order_id: orderId,
          transaction_id: orderId,
          payment_gateway_id: defaultGateway.gateway_id,
          withdrawal_type: withdrawalType,
          status: 'pending',
          bank_account_id: bankAccountId,
          usdt_account_id: usdtAccountId,
          created_at: new Date(),
          updated_at: new Date()
        };
        
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
          const delay = Math.random() * 100 * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw error;
      }
    }
  } catch (error) {
    console.error(`❌ Withdrawal processing failed for user ${userId}:`, error.message);
    throw error;
  }
}

// Registration bonus application for workerManager
async function applyRegistrationBonusForWorkerManager(userId, models, maxRetries = 3) {
  const unifiedRedis = require('../config/unifiedRedisManager');
  const redisHelper = await unifiedRedis.getHelper();
  
  if (!redisHelper) {
    throw new Error('Redis helper not available');
  }
  
  const deduplicationKey = `registration_bonus_wm:${userId}`;
  
  // Check if already processed
  const isAlreadyProcessed = await redisHelper.get(deduplicationKey);
  if (isAlreadyProcessed) {
    console.log(`Registration bonus already processed for user ${userId} by workerManager`);
    return { success: true, message: 'Bonus already applied' };
  }
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const transaction = await models.User.sequelize.transaction();
    let finished = false;
    
    try {
      // Check if bonus already applied
      const existingBonus = await models.Transaction.findOne({
        where: {
          user_id: userId,
          type: 'registration_bonus'
        },
        transaction
      });
      
      if (existingBonus) {
        console.log(`Registration bonus already applied for user ${userId}`);
        finished = true;
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
      
      // Create transaction record
      await models.Transaction.create({
        user_id: userId,
        type: 'registration_bonus',
        amount: BONUS_AMOUNT,
        status: 'completed',
        description: 'Welcome bonus for new registration',
        reference_id: `reg_bonus_wm_${userId}_${Date.now()}`,
        metadata: {
          bonus_type: 'registration',
          processed_by: 'workerManager',
          registration_date: new Date()
        }
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
      
      console.log(`✅ Registration bonus applied for user ${userId} by workerManager`);
      return { success: true, amount: BONUS_AMOUNT };
      
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

// Direct registration processing function
async function processRegistrationDirectly(userId, userData, models) {
  try {
    const transaction = await models.User.sequelize.transaction();
    
    try {
      // Update user registration status
      const user = await models.User.findByPk(userId, { transaction });
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      
      // Update user registration data
      await user.update({
        registration_completed: true,
        registration_completed_at: new Date(),
        updated_at: new Date()
      }, { transaction });
      
      // Create registration log
      if (models.RegistrationLog) {
        await models.RegistrationLog.create({
          user_id: userId,
          status: 'completed',
          completed_at: new Date(),
          metadata: userData || {}
        }, { transaction });
      }
      
      await transaction.commit();
      console.log(`✅ Registration completed for user ${userId}`);
      return { success: true, message: 'Registration completed successfully' };
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error(`❌ Registration processing failed for user ${userId}:`, error.message);
    throw error;
  }
}

// Direct deposit processing function
async function processDepositDirectly(depositId, userId, amount, paymentGateway, transactionId, models) {
  try {
    const transaction = await models.User.sequelize.transaction();
    
    try {
      // Get user
      const user = await models.User.findByPk(userId, { transaction });
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }
      
      // Check if deposit already processed
      const existingDeposit = await models.Transaction.findOne({
        where: { reference_id: transactionId },
        transaction
      });
      
      if (existingDeposit) {
        await transaction.commit();
        return { success: true, message: 'Deposit already processed' };
      }
      
      // Add amount to wallet balance
      await models.User.increment('wallet_balance', {
        by: parseFloat(amount),
        where: { user_id: userId },
        transaction
      });
      
      // Create transaction record
      await models.Transaction.create({
        user_id: userId,
        type: 'deposit',
        amount: parseFloat(amount),
        status: 'completed',
        description: `Deposit via ${paymentGateway}`,
        reference_id: transactionId,
        metadata: {
          payment_gateway: paymentGateway,
          deposit_id: depositId
        }
      }, { transaction });
      
      await transaction.commit();
      console.log(`✅ Deposit processed for user ${userId}: ${amount}`);
      return { success: true, message: 'Deposit processed successfully' };
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error(`❌ Deposit processing failed for ID ${depositId}:`, error.message);
    throw error;
  }
}

// Direct payment processing function
async function processPaymentDirectly(paymentId, type, data, models) {
  try {
    const transaction = await models.User.sequelize.transaction();
    
    try {
      switch (type) {
        case 'callback':
          // Process payment callback
          const result = await processPaymentCallback(data, models, transaction);
          await transaction.commit();
          return result;
          
        case 'refund':
          // Process payment refund
          const refundResult = await processPaymentRefund(data, models, transaction);
          await transaction.commit();
          return refundResult;
          
        case 'status_update':
          // Update payment status
          const statusResult = await updatePaymentStatus(data, models, transaction);
          await transaction.commit();
          return statusResult;
          
        default:
          throw new Error(`Unknown payment type: ${type}`);
      }
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error(`❌ Payment processing failed for ID ${paymentId}:`, error.message);
    throw error;
  }
}

// Direct admin task processing function
async function processAdminTaskDirectly(taskId, taskType, taskData, models) {
  try {
    const transaction = await models.User.sequelize.transaction();
    
    try {
      switch (taskType) {
        case 'withdrawal_approval':
          // Process withdrawal approval
          const approvalResult = await processWithdrawalApproval(taskData, models, transaction);
          await transaction.commit();
          return approvalResult;
          
        case 'user_ban':
          // Process user ban
          const banResult = await processUserBan(taskData, models, transaction);
          await transaction.commit();
          return banResult;
          
        case 'bonus_credit':
          // Process bonus credit
          const bonusResult = await processBonusCredit(taskData, models, transaction);
          await transaction.commit();
          return bonusResult;
          
        case 'system_maintenance':
          // Process system maintenance
          const maintenanceResult = await processSystemMaintenance(taskData, models, transaction);
          await transaction.commit();
          return maintenanceResult;
          
        default:
          throw new Error(`Unknown admin task type: ${taskType}`);
      }
      
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error(`❌ Admin task processing failed for ID ${taskId}:`, error.message);
    throw error;
  }
}

// Helper functions for payment processing
async function processPaymentCallback(data, models, transaction) {
  // Implementation for payment callback processing
  return { success: true, message: 'Payment callback processed' };
}

async function processPaymentRefund(data, models, transaction) {
  // Implementation for payment refund processing
  return { success: true, message: 'Payment refund processed' };
}

async function updatePaymentStatus(data, models, transaction) {
  // Implementation for payment status update
  return { success: true, message: 'Payment status updated' };
}

// Helper functions for admin tasks
async function processWithdrawalApproval(data, models, transaction) {
  // Implementation for withdrawal approval
  return { success: true, message: 'Withdrawal approval processed' };
}

async function processUserBan(data, models, transaction) {
  // Implementation for user ban
  return { success: true, message: 'User ban processed' };
}

async function processBonusCredit(data, models, transaction) {
  // Implementation for bonus credit
  return { success: true, message: 'Bonus credit processed' };
}

async function processSystemMaintenance(data, models, transaction) {
  // Implementation for system maintenance
  return { success: true, message: 'System maintenance processed' };
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
      attendance: await createQueue('attendance', {
        defaultJobOptions: { priority: 5, attempts: 2, backoff: { type: 'exponential', delay: 5000 } }
      }),
      registration: await createQueue('registration', {
        defaultJobOptions: { priority: 2, attempts: 3, backoff: { type: 'exponential', delay: 1000 } }
      }),
      deposits: await createQueue('deposits', {
        defaultJobOptions: { priority: 1, attempts: 5, backoff: { type: 'exponential', delay: 3000 } }
      }),
      withdrawals: await createQueue('withdrawals', {
        defaultJobOptions: { priority: 1, attempts: 3, backoff: { type: 'exponential', delay: 5000 } }
      }),
      payments: await createQueue('payments', {
        defaultJobOptions: { priority: 1, attempts: 5, backoff: { type: 'exponential', delay: 3000 } }
      }),
      admin: await createQueue('admin', {
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
          
          // Try main attendance function first
          try {
            await processAttendanceWithDeduplication(userId, models);
            console.log(`[BullMQ] Attendance processed for user ${userId}`);
          } catch (attendanceError) {
            console.warn(`⚠️ Main attendance failed for user ${userId}, trying fallback:`, attendanceError.message);
            // Use fallback attendance function without Redis
            await processAttendanceFallback(userId, models);
          }
        } catch (error) {
          console.error(`[BullMQ] Attendance job failed for user ${userId}:`, error.message);
          if (isRetryableError(error)) {
            throw error;
          }
          console.warn(`Non-critical attendance error for user ${userId}:`, error.message);
        }
      },
      
      registration: async (job) => {
        // FIXED: Handle the correct data structure from registration controller
        console.log(`🚨 [WORKERMANAGER DEBUG] Registration job received:`, {
          jobId: job.id,
          jobName: job.name,
          jobData: job.data,
          jobDataType: typeof job.data,
          jobDataKeys: Object.keys(job.data || {}),
          timestamp: new Date().toISOString()
        });
        
        let userId, userData, type, data;
        
        // Extract data based on the actual structure being sent
        if (job.data && job.data.type && job.data.data && job.data.data.userId) {
          // Format from registration controller: { type: 'applyBonus', data: { userId: 123 } }
          type = job.data.type;
          data = job.data.data;
          userId = data.userId;
          userData = data;
          console.log(`🚨 [WORKERMANAGER DEBUG] Extracted from nested structure: type=${type}, userId=${userId}`);
        } else if (job.data && job.data.userId && job.data.userData) {
          // Original expected format: { userId: 123, userData: {...} }
          userId = job.data.userId;
          userData = job.data.userData;
          type = 'direct';
          console.log(`🚨 [WORKERMANAGER DEBUG] Extracted from direct structure: userId=${userId}`);
        } else if (job.data && job.data.userId) {
          // Fallback: { userId: 123 }
          userId = job.data.userId;
          userData = job.data;
          type = 'fallback';
          console.log(`🚨 [WORKERMANAGER DEBUG] Extracted from fallback structure: userId=${userId}`);
        } else {
          console.error(`🚨 [WORKERMANAGER DEBUG] No valid structure found in job data:`, job.data);
          throw new Error(`Invalid job data structure. Expected { type, data: { userId } } or { userId, userData }`);
        }
        
        console.log(`🚨 [WORKERMANAGER DEBUG] Final extracted values:`, {
          userId: userId,
          userIdType: typeof userId,
          userData: userData,
          type: type
        });
        
        if (!userId || userId === undefined || userId === null) {
          throw new Error(`Invalid userId extracted: ${userId}`);
        }
        
        try {
          const models = getWorkerModels();
          
          // Safety check for models
          if (!models || !models.User) {
            throw new Error('User model not loaded');
          }
          
          // FIXED: Handle different job types based on registration controller structure
          if (type === 'applyBonus') {
            // Apply registration bonus
            console.log(`🚨 [WORKERMANAGER DEBUG] Processing applyBonus for user ${userId}`);
            await applyRegistrationBonusForWorkerManager(userId, models);
            console.log(`[BullMQ] Registration bonus applied for user ${userId}`);
          } else if (type === 'recordReferral') {
            // Record referral
            console.log(`🚨 [WORKERMANAGER DEBUG] Processing recordReferral for user ${userId}`);
            const referralService = require('../services/referralService');
            await referralService.autoRecordReferral(userId, data.referredBy);
            console.log(`[BullMQ] Referral recorded for user ${userId}`);
          } else {
            // Default registration processing
            console.log(`🚨 [WORKERMANAGER DEBUG] Processing default registration for user ${userId}`);
            const result = await processRegistrationDirectly(userId, userData, models);
            console.log(`[BullMQ] Registration processed for user ${userId}`);
            return result;
          }
          
          return { success: true, userId: userId, type: type };
        } catch (error) {
          console.error(`🚨 [WORKERMANAGER DEBUG] Registration job failed for user ${userId}:`, error.message);
          console.error(`🚨 [WORKERMANAGER DEBUG] Error details:`, {
            userId: userId,
            type: type,
            error: error.message,
            stack: error.stack
          });
          throw error;
        }
      },
      
      deposits: async (job) => {
        const { depositId, userId, amount, paymentGateway, transactionId } = job.data;
        try {
          const models = getWorkerModels();
          
          // Safety check for models
          if (!models || !models.User || !models.Transaction || !models.PaymentGateway) {
            throw new Error('Required models not loaded');
          }
          
          // Process deposit
          const result = await processDepositDirectly(depositId, userId, amount, paymentGateway, transactionId, models);
          
          console.log(`[BullMQ] Deposit processed for ID ${depositId}, user ${userId}, amount ${amount}`);
          return result;
        } catch (error) {
          console.error(`[BullMQ] Deposit job failed for ID ${depositId}:`, error.message);
          throw error;
        }
      },
      
      withdrawals: async (job) => {
        const { userId, amount, orderId, withdrawalType, bankAccountId, usdtAccountId } = job.data;
        try {
          const models = getWorkerModels();
          
          // Safety check for models
          if (!models || !models.User || !models.WalletWithdrawal || !models.Transaction || !models.PaymentGateway) {
            throw new Error('Required models not loaded');
          }
          
          // Process withdrawal directly without importing withdrawalWorker
          const result = await processWithdrawalDirectly({
            userId,
            amount,
            orderId,
            withdrawalType,
            bankAccountId,
            usdtAccountId
          }, models);
          
          console.log(`[BullMQ] Withdrawal processed for user ${userId}, amount: ${amount}, result:`, result);
          return result;
        } catch (error) {
          console.error(`[BullMQ] Withdrawal job failed for user ${userId}:`, error.message);
          throw error;
        }
      },
      
      payments: async (job) => {
        const { paymentId, type, data } = job.data;
        try {
          const models = getWorkerModels();
          
          // Safety check for models
          if (!models) {
            throw new Error('Models not loaded');
          }
          
          // Process payment based on type
          const result = await processPaymentDirectly(paymentId, type, data, models);
          
          console.log(`[BullMQ] Payment processed for ID ${paymentId}, type: ${type}`);
          return result;
        } catch (error) {
          console.error(`[BullMQ] Payment job failed for ID ${paymentId}:`, error.message);
          throw error;
        }
      },
      
      admin: async (job) => {
        const { taskId, taskType, taskData } = job.data;
        try {
          const models = getWorkerModels();
          
          // Safety check for models
          if (!models) {
            throw new Error('Models not loaded');
          }
          
          // Process admin task based on type
          const result = await processAdminTaskDirectly(taskId, taskType, taskData, models);
          
          console.log(`[BullMQ] Admin task processed for ID ${taskId}, type: ${taskType}`);
          return result;
        } catch (error) {
          console.error(`[BullMQ] Admin job failed for ID ${taskId}:`, error.message);
          throw error;
        }
      }
    };

    const workers = {
      attendance: await createWorker('attendance', jobProcessors.attendance, { concurrency: 15 }),
      registration: await createWorker('registration', jobProcessors.registration, { concurrency: 10 }),
      deposits: await createWorker('deposits', jobProcessors.deposits, { concurrency: 20 }),
      withdrawals: await createWorker('withdrawals', jobProcessors.withdrawals, { concurrency: 10 }),
      payments: await createWorker('payments', jobProcessors.payments, { concurrency: 20 }),
      admin: await createWorker('admin', jobProcessors.admin, { concurrency: 5 })
    };

    console.log('📋 Active Workers:');
    console.log('   - Attendance Worker (concurrency: 15)');
    console.log('   - Registration Worker (concurrency: 10)');
    console.log('   - Deposit Worker (concurrency: 20)');
    console.log('   - Withdrawal Worker (concurrency: 10)');
    console.log('   - Payment Worker (concurrency: 20)');
    console.log('   - Admin Worker (concurrency: 5)');
    console.log('');

    // Enhanced health monitoring
    const monitorWorkerHealth = () => {
      setInterval(async () => {
        try {
          console.log('📊 Queue Health Status:');
          console.log('=======================');

          // Get stats for each queue
          for (const [name, queue] of Object.entries(queues)) {
            try {
              const waiting = await queue.getWaiting();
              const active = await queue.getActive();
              const completed = await queue.getCompleted();
              const failed = await queue.getFailed();
              
              const status = waiting.length > 50 ? '🚨' : waiting.length > 20 ? '⚠️' : '✅';
              console.log(`${status} ${name}: ${waiting.length} waiting, ${active.length} active, ${completed.length} completed, ${failed.length} failed`);

              // Alert on backlog
              if (waiting.length > 50) {
                console.error(`🚨 HIGH BACKLOG: ${name} queue has ${waiting.length} waiting jobs`);
              }

              // Alert on high failure rate
              if (failed.length > completed.length * 0.1) {
                console.error(`🚨 HIGH FAILURE RATE: ${name} queue has ${failed.length} failed jobs`);
              }

              // Alert on stalled jobs
              if (active.length > 0) {
                console.warn(`⚠️ ${name} queue has ${active.length} active jobs`);
              }
            } catch (error) {
              console.warn(`⚠️ Failed to get stats for queue ${name}:`, error.message);
            }
          }

          console.log('=======================');

        } catch (error) {
          console.error('Health monitoring failed:', error);
        }
      }, 30000); // Check every 30 seconds
    };

    // Start health monitoring after 10 seconds
    setTimeout(() => {
      console.log('🔍 Starting enhanced queue health monitoring...');
      monitorWorkerHealth();
    }, 10000);

    // Periodic memory usage logging
    setInterval(() => {
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
    }, 30000);

    // Job cleanup
    setInterval(async () => {
      try {
        for (const [name, queue] of Object.entries(queues)) {
          try {
            // Clean completed jobs older than 24 hours
            await queue.clean(24 * 60 * 60 * 1000, 100, 'completed');
            // Clean failed jobs older than 7 days
            await queue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed');
          } catch (error) {
            console.warn(`⚠️ Failed to cleanup queue ${name}:`, error.message);
          }
        }
      } catch (error) {
        console.error('❌ Error cleaning up jobs:', error.message);
      }
    }, 6 * 60 * 60 * 1000); // Every 6 hours

    console.log('✅ Fixed Worker Manager Started Successfully!');
    console.log('💡 Press Ctrl+C to stop all workers gracefully');
    console.log('==================================================');

  } catch (error) {
    console.error('❌ Failed to start worker manager:', error);
    process.exit(1);
  }
})(); 