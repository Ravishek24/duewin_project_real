// Backend/scripts/masterCronJobs.js - Master Cron System - FIXED VERSION
const cron = require('node-cron');
const { Op } = require('sequelize');
const moment = require('moment-timezone');
const logger = require('../utils/logger');

// Database and models will be initialized when needed
let sequelize = null;
let models = {};
let isInitialized = false;

/**
 * Initialize database connection and models for cron jobs
 */
const initializeDatabaseForCron = async () => {
    if (isInitialized) {
        return { sequelize, models };
    }

    try {
        console.log('🔄 Initializing database connection for cron jobs...');
        
        // Import database config and connect
        const { connectDB, waitForDatabase, getSequelizeInstance } = require('../config/db');
        
        // Connect to database
        await connectDB();
        console.log('✅ Database connected for cron jobs');
        
        // Wait for database to be fully ready
        await waitForDatabase();
        console.log('✅ Database is ready for cron jobs');
        
        // Get sequelize instance
        sequelize = await getSequelizeInstance();
        console.log('✅ Sequelize instance obtained for cron jobs');
        
        // Initialize models
        const { getModels } = require('../models');
        models = await getModels();
        console.log('✅ Models initialized for cron jobs');
        
        isInitialized = true;
        return { sequelize, models };
        
    } catch (error) {
        console.error('❌ Failed to initialize database for cron jobs:', error);
        throw error;
    }
};

/**
 * Get initialized sequelize and models
 */
const getDatabaseInstances = async () => {
    if (!isInitialized) {
        return await initializeDatabaseForCron();
    }
    return { sequelize, models };
};

/**
 * Import services dynamically when needed
 */
const getServices = () => {
    try {
        return {
            updateWalletBalance: require('../services/referralService').updateWalletBalance
        };
    } catch (error) {
        console.error('❌ Error importing services:', error);
        throw error;
    }
};

/**
 * Auto-record attendance for all users (runs once daily at 12:30 AM IST)
 */
const autoRecordDailyAttendance = async () => {
    const lockKey = 'daily_attendance_cron_lock';
    const lockValue = `${Date.now()}_${process.pid}`;
    
    try {
        console.log('🕐 Starting daily attendance auto-record at 12:30 AM IST...');
        
        // Initialize database if needed
        const { sequelize: db, models: dbModels } = await getDatabaseInstances();
        
        // Try to acquire lock (expires in 30 minutes)
        const { redis } = require('../config/redisConfig');
        const acquired = await redis.set(lockKey, lockValue, 'EX', 1800, 'NX');
        
        if (!acquired) {
            console.log('⚠️ Daily attendance cron already running on another instance, skipping...');
            return;
        }

        console.log('🔒 Acquired attendance lock, proceeding with daily attendance recording');
        
        const today = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
        console.log('📅 Recording attendance for date:', today);

        // Get all active users
        const users = await dbModels.User.findAll({
            attributes: ['user_id', 'user_name'],
        });

        console.log(`👥 Processing attendance for ${users.length} users`);

        let successCount = 0;
        let skipCount = 0;
        let errorCount = 0;

        for (const user of users) {
            try {
                // Check if attendance already recorded for today
                const existingAttendance = await dbModels.AttendanceRecord.findOne({
                    where: {
                        user_id: user.user_id,
                        attendance_date: today
                    }
                });

                if (existingAttendance) {
                    skipCount++;
                    continue;
                }

                // Get yesterday's attendance for streak calculation
                const yesterday = moment.tz('Asia/Kolkata').subtract(1, 'day').format('YYYY-MM-DD');
                const yesterdayAttendance = await dbModels.AttendanceRecord.findOne({
                    where: {
                        user_id: user.user_id,
                        attendance_date: yesterday
                    }
                });

                // Calculate streak (continues only if user recharged yesterday)
                let streak = 1;
                if (yesterdayAttendance && yesterdayAttendance.has_recharged) {
                    streak = (yesterdayAttendance.streak_count || 0) + 1;
                }

                // Create attendance record (auto-record, no recharge yet)
                await dbModels.AttendanceRecord.create({
                    user_id: user.user_id,
                    date: today,
                    attendance_date: today,
                    streak_count: streak,
                    has_recharged: false,
                    recharge_amount: 0,
                    additional_bonus: 0,
                    bonus_amount: 0,
                    bonus_claimed: false,
                    claim_eligible: false,
                    created_at: new Date(),
                    updated_at: new Date()
                });

                successCount++;
            } catch (userError) {
                console.error(`❌ Error recording attendance for user ${user.user_id}:`, userError.message);
                errorCount++;
            }
        }

        console.log(`✅ Daily attendance recording completed: ${successCount} success, ${skipCount} skipped, ${errorCount} errors`);
        
        logger.info('Daily attendance auto-record completed', {
            date: today,
            totalUsers: users.length,
            successful: successCount,
            skipped: skipCount,
            errors: errorCount,
            timestamp: moment.tz('Asia/Kolkata').toISOString()
        });

    } catch (error) {
        console.error('❌ Error in daily attendance cron:', error);
        logger.error('Error in daily attendance cron:', {
            error: error.message,
            stack: error.stack,
            timestamp: moment.tz('Asia/Kolkata').toISOString()
        });
    } finally {
        // Release lock
        try {
            const { redis } = require('../config/redisConfig');
            const currentValue = await redis.get(lockKey);
            if (currentValue === lockValue) {
                await redis.del(lockKey);
                console.log('🔓 Released attendance lock');
            }
        } catch (lockError) {
            console.error('❌ Error releasing attendance lock:', lockError);
        }
    }
};

/**
 * Process all attendance bonuses at 12:30 AM IST
 */
const processAttendanceBonuses = async () => {
    const lockKey = 'attendance_bonus_cron_lock';
    const lockValue = `${Date.now()}_${process.pid}`;
    
    try {
        console.log('💰 Starting attendance bonus processing at 12:30 AM IST...');
        
        // Initialize database if needed
        const { sequelize: db, models: dbModels } = await getDatabaseInstances();
        
        const { redis } = require('../config/redisConfig');
        const acquired = await redis.set(lockKey, lockValue, 'EX', 1800, 'NX');
        
        if (!acquired) {
            console.log('⚠️ Attendance bonus cron already running, skipping...');
            return;
        }

        console.log('🔒 Acquired bonus lock, processing attendance bonuses');
        
        const today = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');

        // Get all eligible attendance records
        const eligibleRecords = await dbModels.AttendanceRecord.findAll({
            where: {
                attendance_date: today,
                has_recharged: true,
                claim_eligible: true,
                bonus_claimed: false,
                bonus_amount: { [Op.gt]: 0 }
            },
            include: [{
                model: dbModels.User,
                as: 'attendance_user',
                attributes: ['user_id', 'user_name', 'wallet_balance']
            }]
        });

        console.log(`🎁 Processing ${eligibleRecords.length} attendance bonuses`);

        let successCount = 0;
        let errorCount = 0;
        let totalBonusAmount = 0;

        for (const record of eligibleRecords) {
            const userId = record.user_id;
            const bonusAmount = parseFloat(record.bonus_amount);
            
            // Add deduplication key to prevent conflicts with BullMQ workers
            const deduplicationKey = `attendance_bonus:${userId}:${today}`;
            const isAlreadyProcessed = await redis.get(deduplicationKey);
            
            if (isAlreadyProcessed) {
                console.log(`⏭️ Attendance bonus already processed for user ${userId} on ${today}`);
                continue;
            }
            
            const t = await db.transaction();
            
            try {
                // Use atomic operation to prevent deadlocks
                await dbModels.User.increment('wallet_balance', {
                    by: bonusAmount,
                    where: { user_id: userId },
                    transaction: t
                });

                // Mark bonus as claimed
                await record.update({
                    bonus_claimed: true,
                    claimed_at: new Date()
                }, { transaction: t });

                // Create transaction record
                await dbModels.Transaction.create({
                    user_id: userId,
                    type: 'attendance_bonus',
                    amount: bonusAmount,
                    status: 'completed',
                    description: `Daily attendance bonus - Day ${record.streak_count}`,
                    reference_id: `attendance_${record.id}_${Date.now()}`,
                    metadata: {
                        attendance_id: record.id,
                        streak_count: record.streak_count,
                        attendance_date: record.attendance_date
                    }
                }, { transaction: t });

                await t.commit();
                
                // Set deduplication flag (expires in 24 hours)
                await redis.setex(deduplicationKey, 86400, '1');
                
                successCount++;
                totalBonusAmount += bonusAmount;
                
                console.log(`✅ Attendance bonus processed for user ${userId}: ${bonusAmount}`);
                
            } catch (error) {
                await t.rollback();
                console.error(`❌ Failed to process attendance bonus for user ${userId}:`, error.message);
                errorCount++;
                
                // Don't throw error to continue processing other users
                continue;
            }
        }

        console.log(`✅ Attendance bonus processing completed: ${successCount} success, ${errorCount} errors, total: ${totalBonusAmount}`);
        
        logger.info('Attendance bonus processing completed', {
            date: today,
            totalRecords: eligibleRecords.length,
            successful: successCount,
            errors: errorCount,
            totalBonusAmount: totalBonusAmount,
            timestamp: moment.tz('Asia/Kolkata').toISOString()
        });

    } catch (error) {
        console.error('❌ Error in attendance bonus cron:', error);
        logger.error('Error in attendance bonus cron:', {
            error: error.message,
            stack: error.stack,
            timestamp: moment.tz('Asia/Kolkata').toISOString()
        });
    } finally {
        // Release lock
        try {
            const { redis } = require('../config/redisConfig');
            const currentValue = await redis.get(lockKey);
            if (currentValue === lockValue) {
                await redis.del(lockKey);
                console.log('🔓 Released bonus lock');
            }
        } catch (lockError) {
            console.error('❌ Error releasing bonus lock:', lockError);
        }
    }
};

/**
 * Process daily rebate commissions at 12:30 AM IST
 */
const processDailyRebates = async () => {
    const lockKey = 'daily_rebate_cron_lock';
    const lockValue = `${Date.now()}_${process.pid}`;
    
    try {
        console.log('💸 Starting daily rebate processing at 12:30 AM IST...');
        
        // Initialize database if needed
        await getDatabaseInstances();
        
        const { redis } = require('../config/redisConfig');
        const acquired = await redis.set(lockKey, lockValue, 'EX', 1800, 'NX');
        
        if (!acquired) {
            console.log('⚠️ Daily rebate cron already running, skipping...');
            return;
        }

        console.log('🔒 Acquired rebate lock, processing daily rebates');
        
        // Process lottery rebates (internal games)
        await processRebateCommissionType('lottery');
        
        // Process casino rebates (third-party games)
        await processRebateCommissionType('casino');

    } catch (error) {
        console.error('❌ Error in daily rebate cron:', error);
        logger.error('Error in daily rebate cron:', {
            error: error.message,
            stack: error.stack
        });
    } finally {
        // Release lock
        try {
            const { redis } = require('../config/redisConfig');
            const currentValue = await redis.get(lockKey);
            if (currentValue === lockValue) {
                await redis.del(lockKey);
                console.log('🔓 Released rebate lock');
            }
        } catch (lockError) {
            console.error('❌ Error releasing rebate lock:', lockError);
        }
    }
};

/**
 * Process rebate commission for specific type (lottery/casino)
 */
const processRebateCommissionType = async (gameType) => {
    const { sequelize: db, models: dbModels } = await getDatabaseInstances();
    const t = await db.transaction();

    try {
        console.log(`🎰 Processing ${gameType} rebates...`);
        
        const batchId = `${gameType}-${Date.now()}`;
        const yesterday = moment.tz('Asia/Kolkata').subtract(1, 'day').startOf('day').toDate();
        const endOfYesterday = moment.tz('Asia/Kolkata').subtract(1, 'day').endOf('day').toDate();

        let betRecords;

        if (gameType === 'lottery') {
            betRecords = await db.query(`
                SELECT user_id, SUM(bet_amount) as total_bet_amount
                FROM (
                    SELECT user_id, bet_amount FROM bet_record_wingo 
                    WHERE created_at BETWEEN :start AND :end AND status = 'completed'
                    UNION ALL
                    SELECT user_id, bet_amount FROM bet_record_5ds
                    WHERE created_at BETWEEN :start AND :end AND status = 'completed'
                    UNION ALL
                    SELECT user_id, bet_amount FROM bet_record_k3s
                    WHERE created_at BETWEEN :start AND :end AND status = 'completed'
                    UNION ALL
                    SELECT user_id, bet_amount FROM bet_record_trx_wix
                    WHERE created_at BETWEEN :start AND :end AND status = 'completed'
                ) as combined_bets
                GROUP BY user_id
                HAVING total_bet_amount > 0
            `, {
                replacements: { start: yesterday, end: endOfYesterday },
                type: db.QueryTypes.SELECT,
                transaction: t
            });
        } else if (gameType === 'casino') {
            betRecords = await db.query(`
                SELECT user_id, SUM(amount) as total_bet_amount
                FROM seamless_transactions
                WHERE type = 'debit' AND created_at BETWEEN :start AND :end
                GROUP BY user_id
                HAVING total_bet_amount > 0
            `, {
                replacements: { start: yesterday, end: endOfYesterday },
                type: db.QueryTypes.SELECT,
                transaction: t
            });
        }

        console.log(`📊 Found ${betRecords.length} users with ${gameType} bets yesterday`);

        // OPTIMIZATION: Batch load all users and referrers
        const userIds = betRecords.map(record => record.user_id);
        const users = await dbModels.User.findAll({
            where: { user_id: { [Op.in]: userIds } },
            attributes: ['user_id', 'user_name', 'referral_code'],
            transaction: t
        });

        const userMap = new Map(users.map(user => [user.user_id, user]));
        const referralCodes = [...new Set(users.map(user => user.referral_code).filter(Boolean))];
        
        const referrers = await dbModels.User.findAll({
            where: { referring_code: { [Op.in]: referralCodes } },
            attributes: ['user_id', 'user_name', 'referring_code'],
            include: [{
                model: dbModels.UserRebateLevel,
                required: false,
                as: 'userrebateleveluser',
                attributes: ['rebate_level']
            }],
            transaction: t
        });

        const referrerMap = new Map(referrers.map(ref => [ref.referring_code, ref]));
        
        const rebateLevels = await dbModels.RebateLevel.findAll({
            attributes: ['level', 'lottery_l1_rebate', 'casino_l1_rebate'],
            transaction: t
        });

        const rebateLevelMap = new Map(rebateLevels.map(level => [level.level, level]));

        let processedCommissions = 0;
        let totalCommissionAmount = 0;

        // Process in batches to avoid long transactions
        const BATCH_SIZE = 50;
        for (let i = 0; i < betRecords.length; i += BATCH_SIZE) {
            const batch = betRecords.slice(i, i + BATCH_SIZE);
            
            for (const record of batch) {
                const userId = record.user_id;
                const betAmount = parseFloat(record.total_bet_amount);

                const user = userMap.get(userId);
                if (!user || !user.referral_code) continue;

                const referrer = referrerMap.get(user.referral_code);
                if (!referrer) continue;

                const rebateLevel = referrer.userrebateleveluser?.rebate_level || 'L0';
                const rebateLevelDetails = rebateLevelMap.get(rebateLevel);

                if (!rebateLevelDetails) continue;

                const level1Rate = gameType === 'lottery' ? 
                    parseFloat(rebateLevelDetails.lottery_l1_rebate) / 100 : 
                    parseFloat(rebateLevelDetails.casino_l1_rebate) / 100;

                const level1Commission = betAmount * level1Rate;

                if (level1Commission > 0) {
                    // Add deduplication key to prevent conflicts
                    const { redis } = require('../config/redisConfig');
                    const deduplicationKey = `rebate_commission:${referrer.user_id}:${batchId}:${userId}`;
                    const isAlreadyProcessed = await redis.get(deduplicationKey);
                    
                    if (isAlreadyProcessed) {
                        console.log(`⏭️ Rebate commission already processed for referrer ${referrer.user_id} from user ${userId}`);
                        continue;
                    }

                    // Create commission record
                    await dbModels.ReferralCommission.create({
                        user_id: referrer.user_id,
                        referred_user_id: userId,
                        level: 1,
                        amount: level1Commission,
                        type: 'rebate',
                        rebate_type: gameType,
                        distribution_batch_id: batchId,
                        status: 'paid',
                        created_at: new Date()
                    }, { transaction: t });

                    // Use atomic operation to prevent deadlocks
                    await dbModels.User.increment('wallet_balance', {
                        by: level1Commission,
                        where: { user_id: referrer.user_id },
                        transaction: t
                    });

                    // Create transaction record
                    await dbModels.Transaction.create({
                        user_id: referrer.user_id,
                        type: 'referral_commission',
                        amount: level1Commission,
                        status: 'completed',
                        description: `${gameType} rebate commission from ${user.user_name || userId}`,
                        reference_id: `rebate_${batchId}_${userId}`,
                        metadata: {
                            rebate_type: gameType,
                            referred_user_id: userId,
                            bet_amount: betAmount,
                            commission_rate: level1Rate
                        }
                    }, { transaction: t });

                    // Set deduplication flag (expires in 7 days)
                    await redis.setex(deduplicationKey, 604800, '1');

                    processedCommissions++;
                    totalCommissionAmount += level1Commission;
                }
            }
        }

        await t.commit();

        console.log(`✅ ${gameType} rebate processing completed: ${processedCommissions} commissions, Total: ${totalCommissionAmount}`);
        
        logger.info(`${gameType} rebate processing completed`, {
            processedCommissions,
            totalAmount: totalCommissionAmount,
            batchId,
            timestamp: moment.tz('Asia/Kolkata').toISOString()
        });

    } catch (error) {
        await t.rollback();
        console.error(`❌ Error processing ${gameType} rebates:`, error);
        throw error;
    }
};

/**
 * Process VIP level-up rewards at 12:30 AM IST
 */
const processVipLevelUpRewards = async () => {
    const lockKey = 'vip_levelup_cron_lock';
    const lockValue = `${Date.now()}_${process.pid}`;
    
    try {
        console.log('👑 Starting VIP level-up reward processing at 12:30 AM IST...');
        
        // Initialize database if needed
        const { sequelize: db, models: dbModels } = await getDatabaseInstances();
        
        const { redis } = require('../config/redisConfig');
        const acquired = await redis.set(lockKey, lockValue, 'EX', 1800, 'NX');
        
        if (!acquired) {
            console.log('⚠️ VIP level-up cron already running, skipping...');
            return;
        }

        console.log('🔒 Acquired VIP lock, processing level-up rewards');
        
        // Get all pending VIP level-up rewards
        const pendingRewards = await dbModels.VipReward.findAll({
            where: {
                reward_type: 'level_up',
                status: 'pending'
            },
            include: [{
                model: dbModels.User,
                as: 'viprewarduser',
                attributes: ['user_id', 'user_name', 'vip_level']
            }]
        });

        console.log(`🎁 Processing ${pendingRewards.length} VIP level-up rewards`);

        let successCount = 0;
        let errorCount = 0;
        let totalRewardAmount = 0;

        for (const reward of pendingRewards) {
            const userId = reward.user_id;
            const rewardAmount = parseFloat(reward.reward_amount);
            
            // Add deduplication key to prevent conflicts
            const deduplicationKey = `vip_levelup:${userId}:${reward.id}`;
            const isAlreadyProcessed = await redis.get(deduplicationKey);
            
            if (isAlreadyProcessed) {
                console.log(`⏭️ VIP level-up reward already processed for user ${userId}, reward ID: ${reward.id}`);
                continue;
            }
            
            const t = await db.transaction();
            
            try {
                // Use atomic operation to prevent deadlocks
                await dbModels.User.increment('wallet_balance', {
                    by: rewardAmount,
                    where: { user_id: userId },
                    transaction: t
                });

                // Mark reward as completed
                await reward.update({
                    status: 'completed',
                    processed_at: new Date()
                }, { transaction: t });

                // Create transaction record
                await dbModels.Transaction.create({
                    user_id: userId,
                    type: 'vip_reward',
                    amount: rewardAmount,
                    status: 'completed',
                    description: `VIP Level ${reward.level} upgrade bonus`,
                    reference_id: `vip_levelup_${reward.id}_${Date.now()}`,
                    metadata: {
                        vip_level: reward.level,
                        reward_type: 'level_up'
                    }
                }, { transaction: t });

                await t.commit();
                
                // Set deduplication flag (expires in 30 days)
                await redis.setex(deduplicationKey, 2592000, '1');

                successCount++;
                totalRewardAmount += rewardAmount;

                console.log(`✅ VIP level-up reward processed for user ${userId}: ${rewardAmount} (Level ${reward.level})`);

            } catch (error) {
                await t.rollback();
                console.error(`❌ Failed to process VIP reward for user ${userId}:`, error.message);
                errorCount++;
                
                // Don't throw error to continue processing other rewards
                continue;
            }
        }

        console.log(`✅ VIP level-up processing completed: ${successCount} success, ${errorCount} errors, total: ${totalRewardAmount}`);
        
        logger.info('VIP level-up processing completed', {
            processedRewards: successCount,
            errors: errorCount,
            totalAmount: totalRewardAmount,
            timestamp: moment.tz('Asia/Kolkata').toISOString()
        });

    } catch (error) {
        console.error('❌ Error in VIP level-up cron:', error);
        logger.error('Error in VIP level-up cron:', {
            error: error.message,
            stack: error.stack,
            timestamp: moment.tz('Asia/Kolkata').toISOString()
        });
    } finally {
        // Release lock
        try {
            const { redis } = require('../config/redisConfig');
            const currentValue = await redis.get(lockKey);
            if (currentValue === lockValue) {
                await redis.del(lockKey);
                console.log('🔓 Released VIP lock');
            }
        } catch (lockError) {
            console.error('❌ Error releasing VIP lock:', lockError);
        }
    }
};

/**
 * Process monthly VIP rewards (1st of every month at 12:30 AM IST)
 */
const processMonthlyVipRewards = async () => {
    const lockKey = 'monthly_vip_cron_lock';
    const lockValue = `${Date.now()}_${process.pid}`;
    
    try {
        console.log('🗓️ Starting monthly VIP reward processing...');
        
        // Initialize database if needed
        const { sequelize: db, models: dbModels } = await getDatabaseInstances();
        
        const { redis } = require('../config/redisConfig');
        const acquired = await redis.set(lockKey, lockValue, 'EX', 1800, 'NX');
        
        if (!acquired) {
            console.log('⚠️ Monthly VIP cron already running, skipping...');
            return;
        }

        console.log('🔒 Acquired monthly VIP lock, processing monthly rewards');
        
        const currentMonth = moment.tz('Asia/Kolkata').format('YYYY-MM');

        // Get all VIP users (level > 0)
        const vipUsers = await dbModels.User.findAll({
            where: {
                vip_level: { [Op.gt]: 0 }
            },
            attributes: ['user_id', 'user_name', 'vip_level']
        });

        console.log(`👑 Processing monthly rewards for ${vipUsers.length} VIP users`);

        let successCount = 0;
        let errorCount = 0;
        let totalRewardAmount = 0;

        for (const user of vipUsers) {
            const userId = user.user_id;
            
            // Add deduplication key to prevent conflicts
            const deduplicationKey = `vip_monthly:${userId}:${currentMonth}`;
            const isAlreadyProcessed = await redis.get(deduplicationKey);
            
            if (isAlreadyProcessed) {
                console.log(`⏭️ Monthly VIP reward already processed for user ${userId} in ${currentMonth}`);
                continue;
            }
            
            const t = await db.transaction();
            
            try {
                // Check if monthly reward already claimed this month
                const existingReward = await dbModels.VipReward.findOne({
                    where: {
                        user_id: userId,
                        level: user.vip_level,
                        reward_type: 'monthly',
                        created_at: {
                            [Op.gte]: moment.tz('Asia/Kolkata').startOf('month').toDate()
                        }
                    },
                    transaction: t
                });

                if (existingReward) {
                    await t.rollback();
                    continue; // Already claimed this month
                }

                // Get VIP level details
                const vipLevel = await dbModels.VipLevel.findOne({
                    where: { level: user.vip_level },
                    transaction: t
                });

                if (!vipLevel || parseFloat(vipLevel.monthly_reward) <= 0) {
                    await t.rollback();
                    continue;
                }

                const monthlyReward = parseFloat(vipLevel.monthly_reward);

                // Create VIP reward record
                await dbModels.VipReward.create({
                    user_id: userId,
                    level: user.vip_level,
                    reward_type: 'monthly',
                    reward_amount: monthlyReward,
                    status: 'completed'
                }, { transaction: t });

                // Use atomic operation to prevent deadlocks
                await dbModels.User.increment('wallet_balance', {
                    by: monthlyReward,
                    where: { user_id: userId },
                    transaction: t
                });

                // Create transaction record
                await dbModels.Transaction.create({
                    user_id: userId,
                    type: 'vip_reward',
                    amount: monthlyReward,
                    status: 'completed',
                    description: `VIP Level ${user.vip_level} monthly reward - ${currentMonth}`,
                    reference_id: `vip_monthly_${userId}_${currentMonth}`,
                    metadata: {
                        vip_level: user.vip_level,
                        reward_type: 'monthly',
                        month: currentMonth
                    }
                }, { transaction: t });

                await t.commit();
                
                // Set deduplication flag (expires in 60 days)
                await redis.setex(deduplicationKey, 5184000, '1');

                successCount++;
                totalRewardAmount += monthlyReward;

                console.log(`✅ Monthly VIP reward processed for user ${userId}: ${monthlyReward} (Level ${user.vip_level})`);

            } catch (error) {
                await t.rollback();
                console.error(`❌ Failed to process monthly VIP reward for user ${userId}:`, error.message);
                errorCount++;
                
                // Don't throw error to continue processing other users
                continue;
            }
        }

        console.log(`✅ Monthly VIP processing completed: ${successCount} success, ${errorCount} errors, total: ${totalRewardAmount}`);
        
        logger.info('Monthly VIP processing completed', {
            processedUsers: successCount,
            errors: errorCount,
            totalAmount: totalRewardAmount,
            month: currentMonth,
            timestamp: moment.tz('Asia/Kolkata').toISOString()
        });

    } catch (error) {
        console.error('❌ Error in monthly VIP cron:', error);
        logger.error('Error in monthly VIP cron:', {
            error: error.message,
            stack: error.stack,
            timestamp: moment.tz('Asia/Kolkata').toISOString()
        });
    } finally {
        // Release lock
        try {
            const { redis } = require('../config/redisConfig');
            const currentValue = await redis.get(lockKey);
            if (currentValue === lockValue) {
                await redis.del(lockKey);
                console.log('🔓 Released monthly VIP lock');
            }
        } catch (lockError) {
            console.error('❌ Error releasing monthly VIP lock:', lockError);
        }
    }
};

const processDailyVaultInterest = async () => {
    try {
        console.log('🏦 Processing daily vault interest...');
        const { processDailyInterest } = require('../services/vaultService');
        const result = await processDailyInterest();
        
        if (result.success) {
            console.log(`✅ Vault interest processed: ${result.processedUsers} users, Total: ${result.totalInterestPaid}`);
        }
    } catch (error) {
        console.error('❌ Error in vault interest processing:', error);
    }
};

/**
 * Initialize all master cron jobs
 */
const initializeMasterCronJobs = async () => {
    try {
        console.log('🚀 Initializing Master Cron Job System...');
        
        // Initialize database connection first
        await initializeDatabaseForCron();
        console.log('✅ Database initialized for cron jobs');

        // Daily cron at 12:30 AM IST
        cron.schedule('30 0 * * *', async () => {
            console.log('🕐 12:30 AM IST - Starting daily cron jobs...');
            
            try {
                // Run all daily processes sequentially
                await autoRecordDailyAttendance();
                await processAttendanceBonuses();
                await processDailyRebates();
                await processVipLevelUpRewards();
                await processDailyVaultInterest();
                console.log('✅ All daily cron jobs completed successfully');
            } catch (error) {
                console.error('❌ Error in daily cron jobs:', error);
                logger.error('Error in daily cron jobs:', {
                    error: error.message,
                    stack: error.stack
                });
            }
        }, {
            timezone: "Asia/Kolkata"
        });

        // Monthly cron on 1st of every month at 12:30 AM IST
        cron.schedule('30 0 1 * *', async () => {
            console.log('🗓️ 1st of month 12:30 AM IST - Starting monthly cron jobs...');
            
            try {
                await processMonthlyVipRewards();
                console.log('✅ Monthly cron jobs completed successfully');
            } catch (error) {
                console.error('❌ Error in monthly cron jobs:', error);
                logger.error('Error in monthly cron jobs:', {
                    error: error.message,
                    stack: error.stack
                });
            }
        }, {
            timezone: "Asia/Kolkata"
        });

        console.log('✅ Master Cron Job System initialized successfully');
        console.log('📅 Daily jobs: 12:30 AM IST (Attendance, Bonuses, Rebates, VIP Level-ups)');
        console.log('🗓️ Monthly jobs: 1st of month 12:30 AM IST (Monthly VIP rewards)');

    } catch (error) {
        console.error('❌ Error initializing master cron jobs:', error);
        logger.error('Error initializing master cron jobs:', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
};

module.exports = {
    initializeMasterCronJobs,
    autoRecordDailyAttendance,
    processAttendanceBonuses,
    processDailyRebates,
    processVipLevelUpRewards,
    processMonthlyVipRewards
};