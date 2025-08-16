// services/referralService.js - COMPLETE FIXED VERSION
const { sequelize, getSequelizeInstance } = require('../config/db');
const { Op } = require('sequelize');
const moment = require('moment-timezone');

// Import only the models that actually exist
const User = require('../models/User');
const WalletRecharge = require('../models/WalletRecharge');
const WalletWithdrawal = require('../models/WalletWithdrawal');

// Import models that exist in your codebase, but handle gracefully if they don't exist
let ReferralTree, ReferralCommission, VipLevel, RebateLevel, UserRebateLevel, AttendanceRecord, ValidReferral, VipReward, Transaction;

// Try to import models, but handle gracefully if they don't exist
try {
    ReferralTree = require('../models/ReferralTree');
} catch (e) {
    console.warn('ReferralTree model not found - using fallback logic');
}

try {
    ReferralCommission = require('../models/ReferralCommission');
} catch (e) {
    console.warn('ReferralCommission model not found - using fallback logic');
}

try {
    VipLevel = require('../models/VipLevel');
} catch (e) {
    console.warn('VipLevel model not found - using fallback logic');
}

try {
    RebateLevel = require('../models/RebateLevel');
} catch (e) {
    console.warn('RebateLevel model not found - using fallback logic');
}

try {
    UserRebateLevel = require('../models/UserRebateLevel');
} catch (e) {
    console.warn('UserRebateLevel model not found - using fallback logic');
}

try {
    AttendanceRecord = require('../models/AttendanceRecord');
} catch (e) {
    console.warn('AttendanceRecord model not found - using fallback logic');
}

try {
    ValidReferral = require('../models/ValidReferral');
} catch (e) {
    console.warn('ValidReferral model not found - using fallback logic');
}

try {
    VipReward = require('../models/VipReward');
} catch (e) {
    console.warn('VipReward model not found - using fallback logic');
}

try {
    Transaction = require('../models/Transaction');
} catch (e) {
    console.warn('Transaction model not found - using fallback logic');
}

// Import self rebate service
const selfRebateService = require('./selfRebateService');

// Import wallet balance utility
const { updateWalletBalance } = require('./walletBalanceUtils');

// 🎯 Import CreditService for wagering system integration
const CreditService = require('./creditService');

/**
 * Create or update a user's referral tree when a new user is registered
 * @param {number} userId - Newly registered user ID
 * @param {string} referralCode - Referral code used during registration
 * @returns {Object} - Operation result
 */
const createReferralTree = async (userId, referralCode) => {
    try {
        // Find the referrer using the referral code
        const referrer = await User.findOne({
            where: { referring_code: referralCode }
        });

        if (!referrer) {
            throw new Error('Invalid referral code');
        }

        // If ReferralTree model exists, create tree entry
        if (ReferralTree) {
            const referralTree = await ReferralTree.create({
                user_id: userId,
                referrer_id: referrer.user_id,
                level: 1,
                commission_rate: 5.00 // Default commission rate
            });

            return {
                success: true,
                data: referralTree
            };
        } else {
            // Fallback: just update the user's referral info
            await User.update(
                { referral_code: referralCode },
                { where: { user_id: userId } }
            );

            return {
                success: true,
                message: 'Referral relationship created (simplified)'
            };
        }
    } catch (error) {
        console.error('Error creating referral tree:', error);
        throw error;
    }
};

/**
 * Process rebate commission distribution (daily cron job)
 * @param {string} gameType - 'lottery' or 'casino'
 * @returns {Object} - Processing result
 */
const processRebateCommission = async (gameType) => {
    let t;
    
    try {
        // Get properly initialized sequelize instance
        const sequelizeInstance = await getSequelizeInstance();
        if (!sequelizeInstance) {
            throw new Error('Database connection not available');
        }
        
        t = await sequelizeInstance.transaction();

        const batchId = `${gameType}-${Date.now()}`;
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);
        const endOfYesterday = new Date(yesterday);
        endOfYesterday.setHours(23, 59, 59, 999);

        let betRecords;

        if (gameType === 'lottery') {
            betRecords = await sequelizeInstance.query(`
                SELECT user_id, SUM(bet_amount) as total_bet_amount
                FROM (
                    SELECT user_id, bet_amount FROM bet_record_wingos 
                    WHERE created_at BETWEEN :start AND :end
                    UNION ALL
                    SELECT user_id, bet_amount FROM bet_record_5ds
                    WHERE created_at BETWEEN :start AND :end
                    UNION ALL
                    SELECT user_id, bet_amount FROM bet_record_k3s
                    WHERE created_at BETWEEN :start AND :end
                    UNION ALL
                    SELECT user_id, bet_amount FROM bet_record_trx_wix
                    WHERE created_at BETWEEN :start AND :end
                ) as combined_bets
                GROUP BY user_id
            `, {
                replacements: { start: yesterday, end: endOfYesterday },
                type: sequelizeInstance.QueryTypes.SELECT,
                transaction: t
            });
        } else if (gameType === 'casino') {
            betRecords = await sequelizeInstance.query(`
                SELECT user_id, SUM(amount) as total_bet_amount
                FROM game_transactions
                WHERE type = 'bet' AND created_at BETWEEN :start AND :end
                GROUP BY user_id
            `, {
                replacements: { start: yesterday, end: endOfYesterday },
                type: sequelizeInstance.QueryTypes.SELECT,
                transaction: t
            });
        }

        // OPTIMIZATION: Batch load all users and referrers
        const userIds = betRecords.map(record => record.user_id);
        const users = await User.findAll({
            where: { user_id: { [Op.in]: userIds } },
            attributes: ['user_id', 'user_name', 'referral_code'],
            transaction: t
        });

        const userMap = new Map(users.map(user => [user.user_id, user]));
        const referralCodes = [...new Set(users.map(user => user.referral_code).filter(Boolean))];
        
        const referrers = await User.findAll({
            where: { referring_code: { [Op.in]: referralCodes } },
            attributes: ['user_id', 'user_name', 'referring_code'],
            include: UserRebateLevel ? [{
                model: UserRebateLevel,
                required: false,
                attributes: ['rebate_level']
            }] : [],
            transaction: t
        });

        const referrerMap = new Map(referrers.map(ref => [ref.referring_code, ref]));
        
        const rebateLevels = await RebateLevel.findAll({
            attributes: ['level', 'lottery_l1_rebate', 'casino_l1_rebate'],
            transaction: t
        });

        const rebateLevelMap = new Map(rebateLevels.map(level => [level.level, level]));

        // Process in batches
        const BATCH_SIZE = 50;
        let processedCommissions = 0;
        let totalCommissionAmount = 0;

        for (let i = 0; i < betRecords.length; i += BATCH_SIZE) {
            const batch = betRecords.slice(i, i + BATCH_SIZE);
            
            for (const record of batch) {
                const userId = record.user_id;
                const betAmount = parseFloat(record.total_bet_amount);

                const user = userMap.get(userId);
                if (!user || !user.referral_code) continue;

                const referrer = referrerMap.get(user.referral_code);
                if (!referrer) continue;

                const rebateLevel = referrer.UserRebateLevel?.rebate_level || 'L0';
                const rebateLevelDetails = rebateLevelMap.get(rebateLevel);

                if (!rebateLevelDetails) continue;

                const level1Rate = gameType === 'lottery' ? 
                    parseFloat(rebateLevelDetails.lottery_l1_rebate) / 100 : 
                    parseFloat(rebateLevelDetails.casino_l1_rebate) / 100;

                const level1Commission = betAmount * level1Rate;

                if (level1Commission > 0) {
                    // Create commission record
                    const commissionRecord = await ReferralCommission.create({
                        user_id: referrer.user_id,
                        referred_user_id: userId,
                        level: 1,
                        amount: level1Commission,
                        type: 'bet',
                        rebate_type: gameType,
                        distribution_batch_id: batchId,
                        created_at: new Date()
                    }, { transaction: t });

                    // Create transaction record for referral bonus
                    const Transaction = require('../models/Transaction');
                    await Transaction.create({
                        user_id: referrer.user_id,
                        type: 'referral_bonus',
                        amount: level1Commission,
                        status: 'completed',
                        description: `${gameType} referral bonus from ${user.user_name || userId}`,
                        reference_id: `referral_bonus_${batchId}_${userId}`,
                        metadata: {
                            bonus_type: 'referral_commission',
                            referred_user_id: userId,
                            referred_user_name: user.user_name,
                            bet_amount: betAmount,
                            commission_rate: level1Rate,
                            game_type: gameType,
                            commission_id: commissionRecord.id,
                            distribution_batch_id: batchId
                        }
                    }, { transaction: t });

                    await updateWalletBalance(
                        referrer.user_id,
                        level1Commission,
                        'add',
                        t
                    );

                    processedCommissions++;
                    totalCommissionAmount += level1Commission;
                }
            }
        }

        await t.commit();
        return {
            success: true,
            message: 'Rebate commission processed successfully',
            processedCommissions,
            totalCommissionAmount
        };
    } catch (error) {
        if (t) {
            await t.rollback();
        }
        console.error('Error processing rebate commission:', error);
        return {
            success: false,
            message: 'Error processing rebate commission'
        };
    }
};

/**
 * Get a user's direct referrals (level 1)
 * @param {number} userId - User ID
 * @param {Object} dateFilter - Optional date filter
 * @returns {Array} - Array of direct referrals
 */
const getDirectReferrals = async (userId, dateFilter = null) => {
    try {
        console.log('🔍 Getting direct referrals for user:', userId);
        console.log('🔧 ReferralTree model available:', !!ReferralTree);

        // ALWAYS use the fallback method since ReferralTree model isn't working
        console.log('⚠️ Using fallback method (direct referral code lookup)');
        
        // Find users who used this user's referral code
        const user = await User.findByPk(userId);
        console.log('👤 Found user:', !!user);
        console.log('🔑 User referring code:', user?.referring_code);
        
        if (!user || !user.referring_code) {
            console.log('❌ No user or no referring code found');
            return {
                success: true,
                directReferrals: [],
                total: 0,
                message: 'No referral code found for this user'
            };
        }

        const whereClause = { referral_code: user.referring_code };
        if (dateFilter) {
            whereClause.created_at = dateFilter;
        }

        console.log('🔍 Searching for referrals with where clause:', whereClause);

        const directReferrals = await User.findAll({
            where: whereClause,
            attributes: [
                'user_id', 'user_name',
                'created_at', 'wallet_balance', 'vip_level', 'actual_deposit_amount'
            ],
            order: [['created_at', 'DESC']]
        });

        console.log('📊 Found direct referrals:', directReferrals.length);

        // Add commission data to each direct referral
        const directReferralsWithCommission = [];
        let totalCommissionEarned = 0;

        for (const referral of directReferrals) {
            let userCommission = 0;
            
            if (ReferralCommission) {
                // Get total commission earned from this user
                const commissionRecords = await ReferralCommission.findAll({
                    where: {
                        user_id: userId,
                        referred_user_id: referral.user_id
                    },
                    attributes: ['id', 'user_id', 'referred_user_id', 'level', 'amount', 'type', 'rebate_type', 'distribution_batch_id', 'status', 'created_at', 'updated_at']
                });
                
                userCommission = commissionRecords.reduce(
                    (sum, record) => sum + parseFloat(record.amount), 0
                );
            }

            // Add commission data to user object
            const referralWithCommission = {
                ...(typeof referral.toJSON === 'function' ? referral.toJSON() : referral),
                commission_earned: userCommission
            };
            
            directReferralsWithCommission.push(referralWithCommission);
            totalCommissionEarned += userCommission;
        }

        console.log('💰 Total commission earned from direct referrals:', totalCommissionEarned);

        return {
            success: true,
            directReferrals: directReferralsWithCommission,
            total: directReferralsWithCommission.length,
            totalCommissionEarned: totalCommissionEarned
        };
    } catch (error) {
        console.error('💥 Error getting direct referrals:', error);
        console.error('📋 Error stack:', error.stack);
        return {
            success: false,
            message: 'Error getting direct referrals: ' + error.message
        };
    }
};

/**
 * Get a user's team referrals (levels 1-6)
 * @param {number} userId - User ID
 * @param {Object} dateFilter - Optional date filter
 * @returns {Object} - Team referral data by level
 */
const getTeamReferrals = async (userId, dateFilter = null, page = 1, limit = 5) => {
    try {
        console.log('🏆 Getting team referrals for user:', userId);
        console.log('🔧 ReferralTree model available:', !!ReferralTree);

        // Initialize result structure
        const teamReferrals = {
            level1: [],
            level2: [],
            level3: [],
            level4: [],
            level5: [],
            level6: []
        };

        let totalCount = 0;

        if (ReferralTree) {
            console.log('✅ Using ReferralTree model for multi-level team referrals');
            
            // Get the user's referral tree entry
            const userTree = await ReferralTree.findOne({
                where: { user_id: userId }
            });

            if (userTree) {
                console.log('🌳 Found user referral tree entry');
                
                // Process each level (1-6)
                for (let level = 1; level <= 6; level++) {
                    const levelField = `level_${level}`;
                    const levelData = userTree[levelField];
                    
                    if (levelData && levelData.trim()) {
                        console.log(`📊 Processing level ${level}: ${levelData}`);
                        
                        // Parse user IDs from the level data (comma-separated)
                        const userIds = levelData.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                        
                        if (userIds.length > 0) {
                            // Build where clause for this level
                            const whereClause = { user_id: { [Op.in]: userIds } };
                            
                            // Add date filter if provided
                            if (dateFilter) {
                                whereClause.created_at = dateFilter;
                            }
                            
                            // Get users for this level with enhanced financial data
                            const levelUsers = await User.findAll({
                                where: whereClause,
                                attributes: [
                                    'user_id', 'user_name',
                                    'created_at', 'wallet_balance', 'vip_level', 'actual_deposit_amount'
                                ],
                                order: [['created_at', 'DESC']]
                            });

                            // Get withdrawal data for all users in this level
                            const levelUserIds = levelUsers.map(user => user.user_id);
                            let withdrawalData = {};
                            
                            if (levelUserIds.length > 0 && WalletWithdrawal) {
                                try {
                                    const withdrawals = await WalletWithdrawal.findAll({
                                        where: {
                                            user_id: { [Op.in]: levelUserIds },
                                            status: 'approved'
                                        },
                                        attributes: [
                                            'user_id',
                                            [sequelize.fn('SUM', sequelize.col('amount')), 'total_withdrawal']
                                        ],
                                        group: ['user_id']
                                    });
                                    
                                    // Convert to lookup object
                                    withdrawalData = withdrawals.reduce((acc, item) => {
                                        acc[item.user_id] = parseFloat(item.dataValues.total_withdrawal || 0);
                                        return acc;
                                    }, {});
                                } catch (error) {
                                    console.log('⚠️ Error fetching withdrawal data:', error.message);
                                    // Continue without withdrawal data
                                }
                            }

                            // Get commission data for each user if ReferralCommission model exists
                            const levelUsersWithCommission = [];
                            for (const user of levelUsers) {
                                let userCommission = 0;
                                
                                if (ReferralCommission) {
                                    // Get total commission earned from this user
                                    const commissionRecords = await ReferralCommission.findAll({
                                        where: {
                                            user_id: userId,
                                            referred_user_id: user.user_id
                                        },
                                        attributes: ['amount']
                                    });
                                    
                                    userCommission = commissionRecords.reduce(
                                        (sum, record) => sum + parseFloat(record.amount), 0
                                    );
                                }

                                // Add commission and withdrawal data to user object
                                const userWithCommission = {
                                    userId: user.user_id,
                                    userName: user.user_name,
                                    createdAt: user.created_at,
                                    walletBalance: user.wallet_balance,
                                    vipLevel: user.vip_level,
                                    totalDeposit: user.actual_deposit_amount,
                                    commissionEarned: userCommission,
                                    totalWithdrawal: withdrawalData[user.user_id] || 0
                                };
                                
                                levelUsersWithCommission.push(userWithCommission);
                            }
                            
                            teamReferrals[`level${level}`] = levelUsersWithCommission;
                            totalCount += levelUsersWithCommission.length;
                            
                            console.log(`✅ Level ${level}: Found ${levelUsersWithCommission.length} users`);
                        } else {
                            console.log(`⚠️ Level ${level}: No valid user IDs found in data: ${levelData}`);
                        }
                    } else {
                        console.log(`ℹ️ Level ${level}: No data available`);
                    }
                }
            } else {
                console.log('⚠️ No referral tree entry found for user, falling back to direct referrals only');
                
                // Fallback to direct referrals only
                const directResult = await getDirectReferrals(userId, dateFilter);
                if (directResult.success) {
                    // Add commission data to direct referrals
                    const directReferralsWithCommission = [];
                    for (const user of directResult.directReferrals) {
                        let userCommission = 0;
                        
                        if (ReferralCommission) {
                            // Get total commission earned from this user
                            const commissionRecords = await ReferralCommission.findAll({
                                where: {
                                    user_id: userId,
                                    referred_user_id: user.user_id
                                },
                                attributes: ['amount']
                            });
                            
                            userCommission = commissionRecords.reduce(
                                (sum, record) => sum + parseFloat(record.amount), 0
                            );
                        }

                        // Add commission data to user object
                        const userWithCommission = {
                            ...(typeof user.toJSON === 'function' ? user.toJSON() : user),
                            commission_earned: userCommission
                        };
                        
                        directReferralsWithCommission.push(userWithCommission);
                    }
                    
                    teamReferrals.level1 = directReferralsWithCommission;
                    totalCount = directReferralsWithCommission.length;
                }
            }
        } else {
            console.log('⚠️ ReferralTree model not available, using fallback method');
            
            // Fallback method - only direct referrals
            const directResult = await getDirectReferrals(userId, dateFilter);
            if (directResult.success) {
                // Add commission and withdrawal data to direct referrals
                const directReferralsWithCommission = [];
                for (const user of directResult.directReferrals) {
                    let userCommission = 0;
                    let userWithdrawal = 0;
                    
                    if (ReferralCommission) {
                        // Get total commission earned from this user
                        const commissionRecords = await ReferralCommission.findAll({
                            where: {
                                user_id: userId,
                                referred_user_id: user.user_id
                            },
                            attributes: ['amount']
                        });
                        
                        userCommission = commissionRecords.reduce(
                            (sum, record) => sum + parseFloat(record.amount), 0
                        );
                    }

                    // Get withdrawal data for this user
                    if (WalletWithdrawal) {
                        try {
                            const withdrawalRecord = await WalletWithdrawal.findOne({
                                where: {
                                    user_id: user.user_id,
                                    status: 'approved'
                                },
                                attributes: [
                                    [sequelize.fn('SUM', sequelize.col('amount')), 'total_withdrawal']
                                ]
                            });
                            
                            if (withdrawalRecord) {
                                userWithdrawal = parseFloat(withdrawalRecord.dataValues.total_withdrawal || 0);
                            }
                        } catch (error) {
                            console.log('⚠️ Error fetching withdrawal data for user:', user.user_id, error.message);
                        }
                    }

                    // Add commission and withdrawal data to user object
                    const userWithCommission = {
                        userId: user.user_id,
                        userName: user.user_name,
                        createdAt: user.created_at,
                        walletBalance: user.wallet_balance,
                        vipLevel: user.vip_level,
                        totalDeposit: user.actual_deposit_amount,
                        commissionEarned: userCommission,
                        totalWithdrawal: userWithdrawal
                    };
                    
                    directReferralsWithCommission.push(userWithCommission);
                }
                
                teamReferrals.level1 = directReferralsWithCommission;
                totalCount = directReferralsWithCommission.length;
            }
        }

        // Calculate total commission earned from all team members
        let totalCommissionEarned = 0;
        for (let level = 1; level <= 6; level++) {
            const levelKey = `level${level}`;
            const levelUsers = teamReferrals[levelKey] || [];
            
            for (const user of levelUsers) {
                totalCommissionEarned += parseFloat(user.commissionEarned || 0);
            }
        }

        console.log(`🎉 Team referrals completed. Total: ${totalCount} users across all levels`);
        console.log(`💰 Total commission earned from team: ${totalCommissionEarned}`);

        // ✅ FIXED: Only apply pagination if page and limit are provided
        let paginatedTeamReferrals = teamReferrals;
        let levelCounts = {};
        let totalPages = 1;
        
        if (page && limit) {
            console.log(`📊 Applying pagination: page ${page}, limit ${limit}`);
            
            // Track total counts for each level
            levelCounts = {};
            
            for (let level = 1; level <= 6; level++) {
                const levelKey = `level${level}`;
                const levelUsers = teamReferrals[levelKey] || [];
                
                // Store total count for this level
                levelCounts[levelKey] = levelUsers.length;
            }
            
            // Apply pagination to the combined user list across all levels
            const allUsers = [];
            const levelMapping = {};
            
            // Collect all users from all levels with their level info
            for (let level = 1; level <= 6; level++) {
                const levelKey = `level${level}`;
                const levelUsers = teamReferrals[levelKey] || [];
                
                levelUsers.forEach(user => {
                    allUsers.push({
                        ...user,
                        level: level
                    });
                    levelMapping[user.userId] = level;
                });
            }
            
            // Apply pagination to the combined user list
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedUsers = allUsers.slice(startIndex, endIndex);
            
            // Group paginated users back by level
            paginatedTeamReferrals = {
                level1: [],
                level2: [],
                level3: [],
                level4: [],
                level5: [],
                level6: []
            };
            
            paginatedUsers.forEach(user => {
                const levelKey = `level${user.level}`;
                const { level, ...userWithoutLevel } = user;
                paginatedTeamReferrals[levelKey].push(userWithoutLevel);
            });
            
            // Calculate total pages based on all users combined
            totalPages = Math.ceil(allUsers.length / limit);
            
            console.log(`📊 Pagination applied: ${allUsers.length} total users, page ${page}, limit ${limit}`);
            console.log(`📄 Showing users ${startIndex + 1}-${Math.min(endIndex, allUsers.length)} of ${allUsers.length}`);
        } else {
            // No pagination - return all users
            console.log('📊 No pagination applied - returning all users');
            
            // Just count users per level
            for (let level = 1; level <= 6; level++) {
                const levelKey = `level${level}`;
                const levelUsers = teamReferrals[levelKey] || [];
                levelCounts[levelKey] = levelUsers.length;
            }
        }
        
        // Add level summary information
        const levelSummary = {
            totalLevels: Object.values(levelCounts).filter(count => count > 0).length,
            levelsWithUsers: Object.entries(levelCounts)
                .filter(([level, count]) => count > 0)
                .map(([level, count]) => ({ level, userCount: count }))
        };
        
        console.log(`📋 Users per level:`, levelCounts);
        console.log(`📄 Total pages: ${totalPages}`);

        return {
            success: true,
            teamReferrals: paginatedTeamReferrals,
            total: totalCount,
            totalCommissionEarned: totalCommissionEarned,
            pagination: {
                currentPage: page,
                limit: limit,
                totalPages: totalPages,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                levelCounts: levelCounts, // ✅ Added: Total count for each level
                levelSummary: levelSummary // ✅ Added: Summary of levels with users
            }
        };
    } catch (error) {
        console.error('💥 Error getting team referrals:', error);
        console.error('📋 Error stack:', error.stack);
        return {
            success: false,
            message: 'Error getting team referrals: ' + error.message
        };
    }
};

/**
 * Get direct referral deposit statistics
 * @param {number} userId - User ID
 * @param {Object} dateFilter - Optional date filter
 * @returns {Object} - Deposit statistics
 */
const getDirectReferralDeposits = async (userId, dateFilter = null) => {
    try {
        console.log('💰 Getting direct referral deposits for user:', userId);
        
        const directReferralsResult = await getDirectReferrals(userId);

        if (!directReferralsResult.success) {
            return directReferralsResult;
        }

        const directReferralIds = directReferralsResult.directReferrals.map(user => user.user_id);

        if (directReferralIds.length === 0) {
            return {
                success: true,
                totalAmount: 0,
                totalCount: 0,
                firstDepositCount: 0,
                firstDepositAmount: 0,
                details: []
            };
        }

        const whereClause = { user_id: { [Op.in]: directReferralIds } };

        if (dateFilter) {
            // Try different possible field names for date filtering
            if (dateFilter.time_of_request) {
                whereClause.created_at = dateFilter.time_of_request;
            } else {
                whereClause.created_at = dateFilter;
            }
        }

        // Get all deposits
        const deposits = await WalletRecharge.findAll({
            where: whereClause,
            attributes: [
                'user_id',
                'amount',
                'status',
                'created_at'
            ],
            order: [['created_at', 'DESC']]
        });

        // Get successful deposits
        const successfulDeposits = deposits.filter(d => d.status === 'completed');

        // Calculate total amount
        const totalAmount = successfulDeposits.reduce(
            (sum, deposit) => sum + parseFloat(deposit.amount),
            0
        );

        // Count first deposits
        const userFirstDeposits = {};
        const firstDeposits = [];

        for (const deposit of successfulDeposits) {
            if (!userFirstDeposits[deposit.user_id]) {
                userFirstDeposits[deposit.user_id] = deposit;
                firstDeposits.push(deposit);
            }
        }

        const firstDepositAmount = firstDeposits.reduce(
            (sum, deposit) => sum + parseFloat(deposit.amount),
            0
        );

        // Group deposits by user
        const depositsByUser = {};

        for (const deposit of successfulDeposits) {
            if (!depositsByUser[deposit.user_id]) {
                depositsByUser[deposit.user_id] = [];
            }
            depositsByUser[deposit.user_id].push(deposit);
        }

        // Create details array
        const details = Object.entries(depositsByUser).map(([userId, userDeposits]) => {
            const totalUserDeposits = userDeposits.reduce(
                (sum, d) => sum + parseFloat(d.amount),
                0
            );

            return {
                userId: parseInt(userId),
                depositCount: userDeposits.length,
                totalAmount: totalUserDeposits,
                lastDepositDate: userDeposits[0].created_at
            };
        });

        return {
            success: true,
            totalAmount,
            totalCount: successfulDeposits.length,
            firstDepositCount: firstDeposits.length,
            firstDepositAmount,
            details
        };
    } catch (error) {
        console.error('Error getting direct referral deposits:', error);
        return {
            success: false,
            message: 'Error getting direct referral deposits'
        };
    }
};

/**
 * Get team referral deposit statistics
 * @param {number} userId - User ID
 * @param {Object} dateFilter - Optional date filter
 * @returns {Object} - Deposit statistics
 */
const getTeamReferralDeposits = async (userId, dateFilter = null) => {
    try {
        console.log('🏆💰 Getting team referral deposits for user:', userId);
        
        const teamReferralsResult = await getTeamReferrals(userId);

        if (!teamReferralsResult.success) {
            return teamReferralsResult;
        }

        // Collect all team member IDs
        const teamUserIds = [];

        for (let level = 1; level <= 6; level++) {
            const levelUsers = teamReferralsResult.teamReferrals[`level${level}`];
            levelUsers.forEach(user => teamUserIds.push(user.user_id));
        }

        if (teamUserIds.length === 0) {
            return {
                success: true,
                totalAmount: 0,
                totalCount: 0,
                firstDepositCount: 0,
                firstDepositAmount: 0,
                details: []
            };
        }

        const whereClause = { user_id: { [Op.in]: teamUserIds } };

        if (dateFilter) {
            if (dateFilter.time_of_request) {
                whereClause.created_at = dateFilter.time_of_request;
            } else {
                whereClause.created_at = dateFilter;
            }
        }

        // Get all deposits
        const deposits = await WalletRecharge.findAll({
            where: whereClause,
            attributes: [
                'user_id',
                'amount',
                'status',
                'created_at'
            ],
            order: [['created_at', 'DESC']]
        });

        // Get successful deposits
        const successfulDeposits = deposits.filter(d => d.status === 'completed');

        // Calculate total amount
        const totalAmount = successfulDeposits.reduce(
            (sum, deposit) => sum + parseFloat(deposit.amount),
            0
        );

        // Count first deposits
        const userFirstDeposits = {};
        const firstDeposits = [];

        for (const deposit of successfulDeposits) {
            if (!userFirstDeposits[deposit.user_id]) {
                userFirstDeposits[deposit.user_id] = deposit;
                firstDeposits.push(deposit);
            }
        }

        const firstDepositAmount = firstDeposits.reduce(
            (sum, deposit) => sum + parseFloat(deposit.amount),
            0
        );

        // Group deposits by user
        const depositsByUser = {};

        for (const deposit of successfulDeposits) {
            if (!depositsByUser[deposit.user_id]) {
                depositsByUser[deposit.user_id] = [];
            }
            depositsByUser[deposit.user_id].push(deposit);
        }

        // Create details array
        const details = Object.entries(depositsByUser).map(([userId, userDeposits]) => {
            const totalUserDeposits = userDeposits.reduce(
                (sum, d) => sum + parseFloat(d.amount),
                0
            );

            return {
                userId: parseInt(userId),
                depositCount: userDeposits.length,
                totalAmount: totalUserDeposits,
                lastDepositDate: userDeposits[0].created_at
            };
        });

        return {
            success: true,
            totalAmount,
            totalCount: successfulDeposits.length,
            firstDepositCount: firstDeposits.length,
            firstDepositAmount,
            details
        };
    } catch (error) {
        console.error('Error getting team referral deposits:', error);
        return {
            success: false,
            message: 'Error getting team referral deposits'
        };
    }
};

/**
 * Get user's commission earnings
 * @param {number} userId - User ID
 * @param {Object} dateFilter - Optional date filter
 * @returns {Object} - Commission earnings statistics
 */
const getCommissionEarnings = async (userId, dateFilter = null) => {
    try {
        console.log('💸 Getting commission earnings for user:', userId);
        
        // If ReferralCommission doesn't exist, return empty data
        if (!ReferralCommission) {
            return {
                success: true,
                totalAmount: 0,
                totalCount: 0,
                byType: {},
                byLevel: {},
                // New section: Commission History with datewise data
                commissionHistory: await getCommissionHistoryData(userId, dateFilter)
            };
        }

        const whereClause = { user_id: userId };

        // Add date filtering if provided
        if (dateFilter) {
            if (dateFilter.startDate && dateFilter.endDate) {
                whereClause.created_at = {
                    [Op.between]: [new Date(dateFilter.startDate), new Date(dateFilter.endDate)]
                };
            } else if (dateFilter.startDate) {
                whereClause.created_at = {
                    [Op.gte]: new Date(dateFilter.startDate)
                };
            } else if (dateFilter.endDate) {
                whereClause.created_at = {
                    [Op.lte]: new Date(dateFilter.endDate)
                };
            } else if (dateFilter.created_at) {
                // Handle existing date filter format
                whereClause.created_at = dateFilter.created_at;
            }
        }

        const commissions = await ReferralCommission.findAll({
            where: whereClause,
            attributes: [
                'id',
                'referred_user_id',
                'level',
                'amount',
                'type',
                'rebate_type',
                'created_at'
            ],
            order: [['created_at', 'DESC']]
        });

        const totalAmount = commissions.reduce(
            (sum, commission) => sum + parseFloat(commission.amount),
            0
        );

        // Group by type and level
        const byType = {};
        const byLevel = {};

        for (const commission of commissions) {
            const typeKey = commission.rebate_type || commission.type;
            if (!byType[typeKey]) {
                byType[typeKey] = { count: 0, amount: 0 };
            }

            byType[typeKey].count++;
            byType[typeKey].amount += parseFloat(commission.amount);

            const levelKey = `level${commission.level}`;
            if (!byLevel[levelKey]) {
                byLevel[levelKey] = { count: 0, amount: 0 };
            }

            byLevel[levelKey].count++;
            byLevel[levelKey].amount += parseFloat(commission.amount);
        }

        return {
            success: true,
            totalAmount,
            totalCount: commissions.length,
            byType,
            byLevel,
            // New section: Commission History with datewise data
            commissionHistory: await getCommissionHistoryData(userId, dateFilter)
        };
    } catch (error) {
        console.error('Error getting commission earnings:', error);
        return {
            success: false,
            message: 'Error getting commission earnings'
        };
    }
};

/**
 * Get referral tree details for API
 * @param {number} userId - User ID
 * @param {number} maxLevel - Maximum level to return (default: 5)
 * @returns {Object} - Referral tree details
 */
const getReferralTreeDetails = async (userId, maxLevel = 5) => {
    try {
        console.log('🌳 Getting referral tree for user:', userId);
        console.log('🔧 ReferralTree model available:', !!ReferralTree);
        
        // ALWAYS use fallback method since ReferralTree isn't working
        console.log('⚠️ Using fallback method (returning direct referrals only)');
        
        const directResult = await getDirectReferrals(userId);
        
        if (!directResult.success) {
            return { 
                success: false,
                message: directResult.message,
                referrals: [], 
                totalCount: 0 
            };
        }

        return {
            success: true,
            referrals: directResult.directReferrals.length > 0 ? [
                {
                    level: 1,
                    users: directResult.directReferrals.map(user => ({
                        ...user.toJSON(),
                        deposit_total: user.actual_deposit_amount || 0
                    }))
                }
            ] : [],
            totalCount: directResult.total
        };
    } catch (error) {
        console.error('💥 Error in getReferralTreeDetails:', error);
        console.error('📋 Error stack:', error.stack);
        return {
            success: false,
            message: 'Error getting referral tree details: ' + error.message,
            referrals: [],
            totalCount: 0
        };
    }
};

/**
 * Record VIP experience points from betting (UPDATED VERSION)
 * @param {number} userId - User ID
 * @param {number} betAmount - Bet amount
 * @param {string} gameType - Game type
 * @param {string} gameId - Game ID (optional)
 * @returns {Object} - Operation result
 */
const recordBetExperience = async (userId, betAmount, gameType = 'unknown', gameId = null) => {
    try {
        // Import the auto VIP service
        const { recordVipExperience } = require('./autoVipService');
        
        // Record VIP experience with full tracking
        const result = await recordVipExperience(userId, betAmount, gameType, gameId);
        
        return {
            success: true,
            message: 'VIP experience recorded successfully',
            expGained: result.expGained,
            newTotalExp: result.newTotalExp,
            levelUp: result.leveledUp,
            levelUpDetails: result.leveledUp ? {
                oldLevel: result.oldLevel,
                newLevel: result.newLevel,
                rewardAmount: result.levelUpReward
            } : null
        };
    } catch (error) {
        console.error('Error recording bet experience:', error);
        return {
            success: false,
            message: 'Error recording VIP experience: ' + error.message
        };
    }
};

/**
 * Auto-record referral when user signs up (SHOULD BE CALLED FROM REGISTRATION)
 * @param {number} newUserId - Newly registered user ID
 * @param {string} referralCode - Referral code used during registration
 * @param {Object} transaction - Optional existing transaction
 * @returns {Object} - Operation result
 */
const autoRecordReferral = async (newUserId, referralCode, transaction = null) => {
    try {
        console.log(`🔗 Auto-recording referral for new user ${newUserId} with code: ${referralCode}`);

        // Import sequelize properly
        const { getSequelizeInstance } = require('../config/db');
        const sequelize = await getSequelizeInstance();
        
        // Use provided transaction or create new one
        const t = transaction || await sequelize.transaction();
        const shouldCommit = !transaction; // Only commit if we created the transaction

        try {
            // Find the referrer
            const referrer = await User.findOne({
                where: { referring_code: referralCode },
                transaction: t
            });

            if (!referrer) {
                if (shouldCommit) await t.rollback();
                return {
                    success: false,
                    message: 'Invalid referral code'
                };
            }

            console.log(`✅ Found referrer: ${referrer.user_name} (${referrer.user_id})`);

            // Update the new user's referral_code field
            await User.update(
                { referral_code: referralCode },
                { where: { user_id: newUserId }, transaction: t }
            );

            // Increment referrer's direct referral count
            await User.increment('direct_referral_count', {
                by: 1,
                where: { user_id: referrer.user_id },
                transaction: t
            });

            // Create referral tree entry if model exists
            if (ReferralTree) {
                try {
                    // Create the new user's referral tree entry
                    const newUserTree = await ReferralTree.create({
                        user_id: newUserId,
                        referrer_id: referrer.user_id,
                        level_1: '', // Will be populated by direct referrals
                        level_2: '',
                        level_3: '',
                        level_4: '',
                        level_5: '',
                        level_6: '',
                        created_at: new Date(),
                        updated_at: new Date()
                    }, { transaction: t });

                    // Update the referrer's referral tree to include this new user
                    let referrerTree = await ReferralTree.findOne({
                        where: { user_id: referrer.user_id },
                        transaction: t
                    });

                    if (!referrerTree) {
                        // Create referrer's tree entry if it doesn't exist
                        referrerTree = await ReferralTree.create({
                            user_id: referrer.user_id,
                            referrer_id: null, // Top-level user
                            level_1: newUserId.toString(),
                            level_2: '',
                            level_3: '',
                            level_4: '',
                            level_5: '',
                            level_6: '',
                            created_at: new Date(),
                            updated_at: new Date()
                        }, { transaction: t });
                    } else {
                        // Update referrer's level_1 to include the new user
                        const currentLevel1 = referrerTree.level_1 || '';
                        const newLevel1 = currentLevel1 ? `${currentLevel1},${newUserId}` : newUserId.toString();
                        
                        await referrerTree.update({
                            level_1: newLevel1,
                            updated_at: new Date()
                        }, { transaction: t });
                    }

                    // Update all upline users' referral trees
                    await updateUplineReferralTrees(referrer.user_id, newUserId, t);

                    console.log(`✅ Created referral tree entries for user ${newUserId}`);
                } catch (treeError) {
                    console.warn('Could not create referral tree entry:', treeError.message);
                }
            }

            // Create valid referral entry if model exists
            if (ValidReferral) {
                try {
                    await ValidReferral.create({
                        referrer_id: referrer.user_id,
                        referred_id: newUserId,
                        total_recharge: 0,
                        is_valid: false,
                        created_at: new Date(),
                        updated_at: new Date()
                    }, { transaction: t });
                } catch (validError) {
                    console.warn('Could not create valid referral entry:', validError.message);
                }
            }

            if (shouldCommit) await t.commit();

            console.log(`✅ Referral auto-recorded: User ${newUserId} referred by ${referrer.user_id}`);

            return {
                success: true,
                message: 'Referral recorded successfully',
                referrerId: referrer.user_id,
                referrerName: referrer.user_name,
                newDirectReferralCount: (referrer.direct_referral_count || 0) + 1
            };

        } catch (error) {
            if (shouldCommit) await t.rollback();
            throw error;
        }

    } catch (error) {
        console.error('💥 Error auto-recording referral:', error);
        return {
            success: false,
            message: 'Error recording referral: ' + error.message
        };
    }
};

/**
 * Auto-process recharge for attendance (SHOULD BE CALLED FROM RECHARGE PROCESSING)
 * @param {number} userId - User ID
 * @param {number} rechargeAmount - Recharge amount
 * @returns {Object} - Operation result
 */
const autoProcessRechargeForAttendance = async (userId, rechargeAmount) => {
    try {
        // Import the auto attendance service
        const { autoProcessRechargeForAttendance } = require('./autoAttendanceService');
        
        // Process recharge for attendance
        const result = await autoProcessRechargeForAttendance(userId, rechargeAmount);
        
        return result;
    } catch (error) {
        console.error('💥 Error in auto-process recharge for attendance:', error);
        return {
            success: false,
            message: 'Error processing recharge for attendance: ' + error.message
        };
    }
};

/**
 * Process direct invitation bonus based on referral count
 * @param {number} userId - User ID
 * @returns {Object} - Operation result
 */
const processDirectInvitationBonus = async (userId) => {
    let t;
    
    try {
        // Get properly initialized sequelize instance
        const sequelizeInstance = await getSequelizeInstance();
        if (!sequelizeInstance) {
            throw new Error('Database connection not available');
        }
        
        t = await sequelizeInstance.transaction();

        const user = await User.findByPk(userId, {
            transaction: t
        });

        if (!user) {
            await t.rollback();
            return {
                success: false,
                message: 'User not found'
            };
        }

        const directReferralCount = user.direct_referral_count;

        // Define bonus tiers based on referral document
        const bonusTiers = [
            { invitees: 1, amount: 55 },
            { invitees: 3, amount: 155 },
            { invitees: 10, amount: 555 },
            { invitees: 30, amount: 1555 },
            { invitees: 60, amount: 2955 },
            { invitees: 100, amount: 5655 },
            { invitees: 200, amount: 11555 },
            { invitees: 500, amount: 28555 },
            { invitees: 1000, amount: 58555 },
            { invitees: 5000, amount: 365555 },
            { invitees: 10000, amount: 765555 },
            { invitees: 20000, amount: 1655555 },
            { invitees: 50000, amount: 3655555 }
        ];

        // Find the highest eligible tier
        let highestEligibleTier = null;

        for (const tier of bonusTiers) {
            if (directReferralCount >= tier.invitees) {
                highestEligibleTier = tier;
            } else {
                break;
            }
        }

        if (!highestEligibleTier) {
            await t.rollback();
            return {
                success: true,
                message: 'No bonus tier reached yet',
                nextTier: bonusTiers[0]
            };
        }

        // Check if this bonus has already been claimed (if ReferralCommission exists)
        if (ReferralCommission) {
            const existingBonus = await ReferralCommission.findOne({
                where: {
                    user_id: userId,
                    type: 'direct_bonus',
                    amount: highestEligibleTier.amount
                },
                attributes: ['id', 'user_id', 'referred_user_id', 'level', 'amount', 'type', 'rebate_type', 'distribution_batch_id', 'status', 'created_at', 'updated_at'],
                transaction: t
            });

            if (existingBonus) {
                await t.rollback();

                const currentIndex = bonusTiers.findIndex(tier => tier.amount === highestEligibleTier.amount);
                const nextTier = currentIndex < bonusTiers.length - 1 ? bonusTiers[currentIndex + 1] : null;

                return {
                    success: true,
                    message: 'Bonus already claimed for this tier',
                    currentTier: highestEligibleTier,
                    nextTier
                };
            }

            // Award the bonus
            await updateWalletBalance(userId, highestEligibleTier.amount, 'add', t);

            // Create commission record
            const commissionRecord = await ReferralCommission.create({
                user_id: userId,
                referred_user_id: userId,
                level: 0,
                amount: highestEligibleTier.amount,
                type: 'direct_bonus',
                distribution_batch_id: `direct-bonus-${Date.now()}`,
                status: 'paid', // Set status to 'paid' since bonus is awarded
                created_at: new Date()
            }, { transaction: t });

            // Create transaction record for direct bonus
            const Transaction = require('../models/Transaction');
            await Transaction.create({
                user_id: userId,
                type: 'direct_bonus',
                amount: highestEligibleTier.amount,
                status: 'completed',
                description: `Direct invitation bonus for ${highestEligibleTier.invitees} referrals`,
                reference_id: `direct_bonus_${userId}_${Date.now()}`,
                metadata: {
                    bonus_type: 'direct_invitation',
                    referral_count: highestEligibleTier.invitees,
                    bonus_tier: highestEligibleTier,
                    commission_id: commissionRecord.id
                }
            }, { transaction: t });
        } else {
            // Simplified: just award the bonus
            await updateWalletBalance(userId, highestEligibleTier.amount, 'add', t);

            // Create transaction record for direct bonus (when ReferralCommission doesn't exist)
            const Transaction = require('../models/Transaction');
            await Transaction.create({
                user_id: userId,
                type: 'direct_bonus',
                amount: highestEligibleTier.amount,
                status: 'completed',
                description: `Direct invitation bonus for ${highestEligibleTier.invitees} referrals`,
                reference_id: `direct_bonus_${userId}_${Date.now()}`,
                metadata: {
                    bonus_type: 'direct_invitation',
                    referral_count: highestEligibleTier.invitees,
                    bonus_tier: highestEligibleTier
                }
            }, { transaction: t });
        }

        const currentIndex = bonusTiers.findIndex(tier => tier.amount === highestEligibleTier.amount);
        const nextTier = currentIndex < bonusTiers.length - 1 ? bonusTiers[currentIndex + 1] : null;

        await t.commit();

        return {
            success: true,
            message: 'Direct invitation bonus awarded',
            bonusTier: highestEligibleTier,
            bonusAmount: highestEligibleTier.amount,
            nextTier
        };
    } catch (error) {
        await t.rollback();
        console.error('Error processing direct invitation bonus:', error);
        return {
            success: false,
            message: 'Error processing direct invitation bonus'
        };
    }
};

/**
 * Process first recharge bonus
 * @param {number} userId - User ID
 * @param {number} rechargeAmount - Recharge amount
 * @returns {Object} - Operation result
 */
const processFirstRechargeBonus = async (userId, rechargeAmount) => {
    let t;
    
    try {
        // Get properly initialized sequelize instance
        const sequelizeInstance = await getSequelizeInstance();
        if (!sequelizeInstance) {
            throw new Error('Database connection not available');
        }
        
        t = await sequelizeInstance.transaction();

        // Check if this is the first recharge
        const previousRecharges = await WalletRecharge.findAll({
            where: {
                user_id: userId,
                status: 'completed'
            },
            transaction: t
        });

        if (previousRecharges.length > 1) {
            await t.rollback();
            return {
                success: false,
                message: 'Not eligible for first recharge bonus'
            };
        }

        // Define bonus tiers
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

        // Find applicable bonus tier
        let applicableTier = null;
        for (let i = bonusTiers.length - 1; i >= 0; i--) {
            if (rechargeAmount >= bonusTiers[i].amount) {
                applicableTier = bonusTiers[i];
                break;
            }
        }

        if (!applicableTier) {
            await t.rollback();
            return {
                success: false,
                message: 'Recharge amount too small for bonus'
            };
        }

        // Get user data for balance tracking
        const user = await sequelizeInstance.models.User.findByPk(userId, { 
            attributes: ['wallet_balance'],
            transaction: t 
        });

        // Award bonus
        await updateWalletBalance(userId, applicableTier.bonus, 'add', t);

        // 🎯 Create credit transaction for wagering tracking
        await CreditService.addCredit(
            userId,
            applicableTier.bonus,
            'welcome_bonus',
            'external',
            `first_deposit_bonus_${userId}_${Date.now()}`,
            `First deposit bonus for ₹${rechargeAmount} deposit`
        );

        // Create transaction record for first deposit bonus
        const Transaction = require('../models/Transaction');
        await Transaction.create({
            user_id: userId,
            type: 'first_deposit_bonus',
            amount: applicableTier.bonus,
            status: 'completed',
            description: `First deposit bonus for ₹${rechargeAmount} deposit`,
            reference_id: `first_deposit_bonus_${userId}_${Date.now()}`,
            metadata: {
                bonus_type: 'first_deposit',
                deposit_amount: rechargeAmount,
                bonus_tier: applicableTier,
                usage_restriction: 'house_games_only',
                allowed_games: ['wingo', '5d', 'k3', 'trx_wix']
            },
            previous_balance: parseFloat(user?.wallet_balance || 0),
            new_balance: parseFloat(user?.wallet_balance || 0) + applicableTier.bonus
        }, { transaction: t });

        await t.commit();

        return {
            success: true,
            message: 'First recharge bonus awarded',
            rechargeAmount,
            bonusAmount: applicableTier.bonus
        };
    } catch (error) {
        if (t) {
            await t.rollback();
        }
        console.error('Error processing first recharge bonus:', error);
        return {
            success: false,
            message: 'Error processing first recharge bonus'
        };
    }
};

/**
 * Process recharge for attendance bonus
 * @param {number} userId - User ID
 * @param {number} rechargeAmount - Amount of recharge
 * @returns {Object} - Processing result
 */
const processRechargeForAttendance = async (userId, rechargeAmount) => {
    let t;
    
    try {
        // Get properly initialized sequelize instance
        const sequelizeInstance = await getSequelizeInstance();
        if (!sequelizeInstance) {
            throw new Error('Database connection not available');
        }
        
        t = await sequelizeInstance.transaction();

        // If AttendanceRecord doesn't exist, return simple response
        if (!AttendanceRecord) {
            await t.commit();
            return {
                success: true,
                message: 'Recharge processed (attendance feature not available)'
            };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let attendanceRecord = await AttendanceRecord.findOne({
            where: {
                user_id: userId,
                attendance_date: today
            },
            transaction: t
        });

        if (!attendanceRecord) {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            const yesterdayAttendance = await AttendanceRecord.findOne({
                where: {
                    user_id: userId,
                    attendance_date: yesterday
                },
                transaction: t
            });

            let streak = 1;
            if (yesterdayAttendance && yesterdayAttendance.has_recharged) {
                streak = yesterdayAttendance.streak_count + 1;
            }

            attendanceRecord = await AttendanceRecord.create({
                user_id: userId,
                attendance_date: today,
                streak_count: streak,
                has_recharged: true,
                recharge_amount: rechargeAmount,
                additional_bonus: 0,
                bonus_amount: 0,
                bonus_claimed: false,
                claim_eligible: false,
                created_at: new Date(),
                updated_at: new Date()
            }, { transaction: t });
        } else {
            await attendanceRecord.update({
                has_recharged: true,
                recharge_amount: parseFloat(attendanceRecord.recharge_amount) + parseFloat(rechargeAmount)
            }, { transaction: t });
        }

        // Calculate additional bonus based on recharge amount
        let additionalBonus = 0;

        const rechargeBonusTiers = [
            { amount: 300, bonus: 10 },
            { amount: 1000, bonus: 30 },
            { amount: 3000, bonus: 300 },
            { amount: 8000, bonus: 300 },
            { amount: 20000, bonus: 650 },
            { amount: 80000, bonus: 3150 },
            { amount: 200000, bonus: 7500 }
        ];

        for (let i = rechargeBonusTiers.length - 1; i >= 0; i--) {
            if (parseFloat(attendanceRecord.recharge_amount) >= rechargeBonusTiers[i].amount) {
                additionalBonus = rechargeBonusTiers[i].bonus;
                break;
            }
        }

        // Define streak bonus amounts
        const bonusAmounts = [7, 20, 100, 200, 450, 2400, 6400];
        const bonusIndex = Math.min(attendanceRecord.streak_count - 1, bonusAmounts.length - 1);
        const streakBonus = bonusAmounts[bonusIndex];

        // Update additional bonus and total bonus
        await attendanceRecord.update({
            additional_bonus: additionalBonus,
            bonus_amount: streakBonus + additionalBonus,
            claim_eligible: true
        }, { transaction: t });

        await t.commit();

        return {
            success: true,
            message: 'Recharge processed for attendance bonus',
            streak: attendanceRecord.streak_count,
            streakBonus,
            additionalBonus,
            totalBonus: streakBonus + additionalBonus,
            isEligible: true
        };
    } catch (error) {
        if (t) {
            await t.rollback();
        }
        console.error('Error processing recharge for attendance:', error);
        return {
            success: false,
            message: 'Error processing recharge for attendance'
        };
    }
};

/**
 * Update referral status when a user recharges
 * @param {number} userId - User ID who made the recharge
 * @param {number} rechargeAmount - Amount of recharge
 * @returns {Object} - Operation result
 */
const updateReferralOnRecharge = async (userId, rechargeAmount) => {
    let t;
    
    try {
        console.log(`🔄 Updating referral status for user ${userId} with recharge amount ${rechargeAmount}`);
        
        // Get properly initialized sequelize instance
        const sequelizeInstance = await getSequelizeInstance();
        if (!sequelizeInstance) {
            throw new Error('Database connection not available');
        }
        
        t = await sequelizeInstance.transaction();
        
        const user = await User.findByPk(userId, {
            transaction: t
        });

        if (!user) {
            await t.rollback();
            return {
                success: false,
                message: 'User not found'
            };
        }

        if (!user.referral_code) {
            await t.rollback();
            return {
                success: true,
                message: 'No referrer to update'
            };
        }

        const referrer = await User.findOne({
            where: { referring_code: user.referral_code },
            transaction: t
        });

        if (!referrer) {
            await t.rollback();
            return {
                success: true,
                message: 'Referrer not found'
            };
        }

        console.log(`👤 Found referrer: ${referrer.user_name} (${referrer.user_id})`);

        // If ValidReferral model exists, use it
        if (ValidReferral) {
            let validReferral = await ValidReferral.findOne({
                where: {
                    referrer_id: referrer.user_id,
                    referred_id: userId
                },
                transaction: t
            });

            let wasValidBefore = false;
            let newTotalRecharge = 0;

            if (!validReferral) {
                // Create new valid referral record
                validReferral = await ValidReferral.create({
                    referrer_id: referrer.user_id,
                    referred_id: userId,
                    total_recharge: rechargeAmount,
                    is_valid: rechargeAmount >= 300,
                    created_at: new Date(),
                    updated_at: new Date()
                }, { transaction: t });
                
                newTotalRecharge = rechargeAmount;
                console.log(`📝 Created new valid referral record for user ${userId}`);
            } else {
                // Update existing valid referral record
                wasValidBefore = validReferral.is_valid;
                newTotalRecharge = parseFloat(validReferral.total_recharge) + parseFloat(rechargeAmount);
                
                await validReferral.update({
                    total_recharge: newTotalRecharge,
                    is_valid: newTotalRecharge >= 300,
                    updated_at: new Date()
                }, { transaction: t });
                
                console.log(`📝 Updated valid referral record: total_recharge ${validReferral.total_recharge} → ${newTotalRecharge}, is_valid ${wasValidBefore} → ${newTotalRecharge >= 300}`);
            }

            // Check if this recharge made the referral valid (crossed ₹300 threshold)
            const isNowValid = newTotalRecharge >= 300;
            
            if (!wasValidBefore && isNowValid) {
                // This recharge made the referral valid - increment referrer's valid count
                await User.increment('valid_referral_count', {
                    by: 1,
                    where: { user_id: referrer.user_id },
                    transaction: t
                });
                
                console.log(`✅ Referral became valid! Incremented valid_referral_count for referrer ${referrer.user_id}`);
            }
        }

        await t.commit();

        console.log(`✅ Referral status updated successfully for user ${userId}`);

        return {
            success: true,
            message: 'Referral status updated successfully'
        };
    } catch (error) {
        if (t) {
            await t.rollback();
        }
        console.error('Error updating referral on recharge:', error);
        return {
            success: false,
            message: 'Error updating referral on recharge'
        };
    }
};

/**
 * Update a user's invitation tier - SIMPLIFIED FOR EXISTING DATABASE
 * @param {number} userId - User ID
 * @param {number} validReferralCount - Valid referral count (optional)
 * @param {Object} transaction - Database transaction (optional)
 * @returns {Object} - Operation result
 */
const updateInvitationTier = async (userId, validReferralCount = null, transaction = null) => {
    let t;
    
    try {
        console.log('🔄 Updating invitation tier for user:', userId);
        
        if (transaction) {
            t = transaction;
        } else {
            // Get properly initialized sequelize instance
            const sequelizeInstance = await getSequelizeInstance();
            if (!sequelizeInstance) {
                throw new Error('Database connection not available');
            }
            t = await sequelizeInstance.transaction();
        }
        
        if (validReferralCount === null) {
            const user = await User.findByPk(userId, {
                attributes: ['direct_referral_count'],
                transaction: t
            });

            if (!user) {
                if (!transaction) await t.rollback();
                return {
                    success: false,
                    message: 'User not found'
                };
            }

            validReferralCount = user.direct_referral_count || 0;
        }

        const bonusTiers = [
            { invitees: 1, amount: 55 },
            { invitees: 3, amount: 155 },
            { invitees: 10, amount: 555 },
            { invitees: 30, amount: 1555 },
            { invitees: 60, amount: 2955 },
            { invitees: 100, amount: 5655 },
            { invitees: 200, amount: 11555 },
            { invitees: 500, amount: 28555 },
            { invitees: 1000, amount: 58555 },
            { invitees: 5000, amount: 365555 },
            { invitees: 10000, amount: 765555 },
            { invitees: 20000, amount: 1655555 },
            { invitees: 50000, amount: 3655555 }
        ];

        let highestEligibleTier = null;

        for (const tier of bonusTiers) {
            if (validReferralCount >= tier.invitees) {
                highestEligibleTier = tier;
            } else {
                break;
            }
        }

        if (!highestEligibleTier) {
            if (!transaction) await t.commit();
            return {
                success: true,
                message: 'No bonus tier reached yet',
                nextTier: bonusTiers[0]
            };
        }

        // Check if this tier has already been claimed
        if (ReferralCommission) {
            const existingBonus = await ReferralCommission.findOne({
                where: {
                    user_id: userId,
                    type: 'direct_bonus',
                    amount: highestEligibleTier.amount
                },
                transaction: t
            });

            if (existingBonus) {
                if (!transaction) await t.commit();

                const currentIndex = bonusTiers.findIndex(tier => tier.amount === parseFloat(highestEligibleTier.amount));
                const nextTier = currentIndex < bonusTiers.length - 1 ? bonusTiers[currentIndex + 1] : null;

                return {
                    success: true,
                    message: 'Bonus already claimed for this tier',
                    currentTier: highestEligibleTier,
                    nextTier
                };
            }
        }

        if (!transaction) await t.commit();

        return {
            success: true,
            message: 'User is eligible for invitation bonus',
            eligibleTier: highestEligibleTier
        };
    } catch (error) {
        if (!transaction) await t.rollback();
        console.error('💥 Error updating invitation tier:', error);
        return {
            success: false,
            message: 'Error updating invitation tier: ' + error.message
        };
    }
};

/**
 * Claim invitation bonus for a user - FIXED FOR EXISTING DATABASE
 * @param {number} userId - User ID
 * @returns {Object} - Result of claim operation
 */
const claimInvitationBonus = async (userId) => {
    let t;
    
    try {
        console.log('🎁 Claiming invitation bonus for user:', userId);
        
        // Get properly initialized sequelize instance
        const sequelizeInstance = await getSequelizeInstance();
        if (!sequelizeInstance) {
            throw new Error('Database connection not available');
        }
        
        t = await sequelizeInstance.transaction();
        
        // Get user with both direct and valid referral counts
        const user = await User.findByPk(userId, {
            attributes: [
                'user_id',
                'direct_referral_count',
                'valid_referral_count'
            ],
            transaction: t
        });

        if (!user) {
            await t.rollback();
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Use valid_referral_count for bonus calculations (fallback to direct_referral_count if not available)
        const validReferralCount = user.valid_referral_count || 0;
        const directReferralCount = user.direct_referral_count || 0;
        
        console.log('📊 User has', directReferralCount, 'direct referrals');
        console.log('✅ User has', validReferralCount, 'valid referrals');
        console.log('🎯 Using valid referral count for bonus calculation:', validReferralCount);

        // Define bonus tiers
        const bonusTiers = [
            { invitees: 1, amount: 55 },
            { invitees: 3, amount: 155 },
            { invitees: 10, amount: 555 },
            { invitees: 30, amount: 1555 },
            { invitees: 60, amount: 2955 },
            { invitees: 100, amount: 5655 },
            { invitees: 200, amount: 11555 },
            { invitees: 500, amount: 28555 },
            { invitees: 1000, amount: 58555 },
            { invitees: 5000, amount: 365555 },
            { invitees: 10000, amount: 765555 },
            { invitees: 20000, amount: 1655555 },
            { invitees: 50000, amount: 3655555 }
        ];

        // Find the highest eligible tier based on valid referrals
        let eligibleTier = null;
        for (const tier of bonusTiers) {
            if (validReferralCount >= tier.invitees) {
                eligibleTier = tier;
            }
        }

        if (!eligibleTier) {
            await t.rollback();
            return {
                success: false,
                message: 'No eligible invitation bonus tier reached yet. You need valid referrals (users who have recharged at least ₹300).',
                details: {
                    validReferralCount,
                    directReferralCount,
                    nextTier: bonusTiers[0]
                }
            };
        }

        console.log('🎯 Eligible for tier:', eligibleTier.invitees, 'users, amount:', eligibleTier.amount);

        // Check if this tier has already been claimed (only if ReferralCommission exists)
        if (ReferralCommission) {
            const existingBonus = await ReferralCommission.findOne({
                where: {
                    user_id: userId,
                    type: 'direct_bonus',
                    amount: eligibleTier.amount
                },
                attributes: ['id', 'user_id', 'referred_user_id', 'level', 'amount', 'type', 'rebate_type', 'distribution_batch_id', 'status', 'created_at', 'updated_at'],
                transaction: t
            });

            if (existingBonus) {
                await t.rollback();
                return {
                    success: false,
                    message: 'This invitation bonus tier has already been claimed'
                };
            }

            // Create commission record
            const commissionRecord = await ReferralCommission.create({
                user_id: userId,
                referred_user_id: userId,
                level: 0,
                amount: eligibleTier.amount,
                type: 'direct_bonus',
                distribution_batch_id: `direct-bonus-${Date.now()}`,
                status: 'paid', // Set status to 'paid' since bonus is awarded
                created_at: new Date()
            }, { transaction: t });

            // Create transaction record for direct bonus
            const Transaction = require('../models/Transaction');
            await Transaction.create({
                user_id: userId,
                type: 'direct_bonus',
                amount: eligibleTier.amount,
                status: 'completed',
                description: `Direct invitation bonus for ${eligibleTier.invitees} referrals`,
                reference_id: `direct_bonus_${userId}_${Date.now()}`,
                metadata: {
                    bonus_type: 'direct_invitation',
                    referral_count: eligibleTier.invitees,
                    bonus_tier: eligibleTier,
                    commission_id: commissionRecord.id
                }
            }, { transaction: t });
        } else {
            // Create transaction record for direct bonus (when ReferralCommission doesn't exist)
            const Transaction = require('../models/Transaction');
            await Transaction.create({
                user_id: userId,
                type: 'direct_bonus',
                amount: eligibleTier.amount,
                status: 'completed',
                description: `Direct invitation bonus for ${eligibleTier.invitees} referrals`,
                reference_id: `direct_bonus_${userId}_${Date.now()}`,
                metadata: {
                    bonus_type: 'direct_invitation',
                    referral_count: eligibleTier.invitees,
                    bonus_tier: eligibleTier
                }
            }, { transaction: t });
        }

        // Credit wallet with bonus amount
        await updateWalletBalance(
            userId,
            parseFloat(eligibleTier.amount),
            'add',
            t
        );

        // 🎯 Create credit transaction for wagering tracking
        await CreditService.addCredit(
            userId,
            parseFloat(eligibleTier.amount),
            'referral_reward',
            'external',
            `direct_bonus_${userId}_${Date.now()}`,
            `Direct invitation bonus for ${eligibleTier.invitees} referrals`
        );

        console.log('💰 Added', eligibleTier.amount, 'to user wallet');

        await t.commit();

        return {
            success: true,
            message: 'Invitation bonus claimed successfully',
            tier: eligibleTier.invitees,
            amount: parseFloat(eligibleTier.amount),
            details: {
                validReferralCount,
                directReferralCount,
                usedValidReferrals: true
            }
        };
    } catch (error) {
        if (t) {
            await t.rollback();
        }
        console.error('💥 Error claiming invitation bonus:', error);
        return {
            success: false,
            message: 'Error claiming invitation bonus: ' + error.message
        };
    }
};

/**
 * Get invitation bonus status for a user - FIXED FOR EXISTING DATABASE
 * @param {number} userId - User ID
 * @returns {Object} - Detailed invitation bonus status
 */
const getInvitationBonusStatus = async (userId) => {
    try {
        console.log('🎁 Getting invitation bonus status for user:', userId);
        
        // Get user with both direct and valid referral counts
        const user = await User.findByPk(userId, {
            attributes: [
                'user_id',
                'user_name',
                'direct_referral_count',
                'valid_referral_count'
            ]
        });

        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        console.log('👤 User found:', user.user_name);
        console.log('📊 Direct referral count:', user.direct_referral_count);
        console.log('✅ Valid referral count:', user.valid_referral_count);

        // Get claimed bonus tiers (only if ReferralCommission model exists)
        let claimedBonuses = [];
        if (ReferralCommission) {
            try {
                claimedBonuses = await ReferralCommission.findAll({
                    where: {
                        user_id: userId,
                        type: 'direct_bonus'
                    },
                    attributes: ['id', 'user_id', 'referred_user_id', 'level', 'amount', 'type', 'rebate_type', 'distribution_batch_id', 'status', 'created_at', 'updated_at']
                });
                console.log('💰 Found claimed bonuses:', claimedBonuses.length);
            } catch (error) {
                console.log('⚠️ Could not fetch claimed bonuses:', error.message);
            }
        }

        const bonusTiers = [
            { invitees: 1, amount: 55 },
            { invitees: 3, amount: 155 },
            { invitees: 10, amount: 555 },
            { invitees: 30, amount: 1555 },
            { invitees: 60, amount: 2955 },
            { invitees: 100, amount: 5655 },
            { invitees: 200, amount: 11555 },
            { invitees: 500, amount: 28555 },
            { invitees: 1000, amount: 58555 },
            { invitees: 5000, amount: 365555 },
            { invitees: 10000, amount: 765555 },
            { invitees: 20000, amount: 1655555 },
            { invitees: 50000, amount: 3655555 }
        ];

        const claimedTiers = claimedBonuses.map(bonus => {
            const tier = bonusTiers.find(t => t.amount === parseFloat(bonus.amount));
            return {
                tier: tier ? tier.invitees : null,
                amount: parseFloat(bonus.amount),
                claimedAt: bonus.created_at
            };
        });

        // Use valid_referral_count for bonus calculations (fallback to direct_referral_count if not available)
        const validReferralCount = user.valid_referral_count || 0;
        const directReferralCount = user.direct_referral_count || 0;
        
        console.log('🎯 Using valid referral count for bonus calculation:', validReferralCount);
        
        // Find next tier to reach based on valid_referral_count
        let nextTier = null;
        for (const tier of bonusTiers) {
            if (validReferralCount < tier.invitees) {
                nextTier = tier;
                break;
            }
        }

        // Check if user is eligible for any tier based on valid referrals
        let eligibleTier = null;
        for (const tier of bonusTiers) {
            if (validReferralCount >= tier.invitees) {
                // Check if this tier is already claimed
                const alreadyClaimed = claimedTiers.some(claimed => claimed.tier === tier.invitees);
                if (!alreadyClaimed) {
                    eligibleTier = tier;
                }
            }
        }

        return {
            success: true,
            totalReferrals: directReferralCount,
            validReferrals: validReferralCount,
            claimedTiers,
            nextTier,
            hasUnclaimedBonus: !!eligibleTier,
            unclaimedTier: eligibleTier ? {
                tier: eligibleTier.invitees,
                amount: eligibleTier.amount
            } : null,
            // Additional info for debugging
            bonusCalculation: {
                usedValidReferrals: true,
                validReferralCount,
                directReferralCount
            }
        };
    } catch (error) {
        console.error('💥 Error getting invitation bonus status:', error);
        console.error('📋 Error details:', error.message);
        return {
            success: false,
            message: 'Error getting invitation bonus status: ' + error.message
        };
    }
};

/**
 * 🆕 NEW: Get valid referral history for a user
 * Shows all valid referrals with details like user ID, deposit amount, registration date
 * @param {number} userId - User ID
 * @param {number} page - Page number for pagination
 * @param {number} limit - Items per page
 * @returns {Object} - Valid referral history with pagination
 */
const getValidReferralHistory = async (userId, page = 1, limit = 10) => {
    try {
        console.log('👥 Getting valid referral history for user:', userId, 'Page:', page, 'Limit:', limit);
        
        const offset = (page - 1) * limit;
        
        // Get user info
        const user = await User.findByPk(userId, {
            attributes: ['user_id', 'user_name', 'direct_referral_count', 'valid_referral_count']
        });

        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Get valid referrals from ValidReferral table
        let validReferrals = [];
        let totalValidReferrals = 0;
        
        if (ValidReferral) {
            try {
                const validResult = await ValidReferral.findAndCountAll({
                    where: {
                        referrer_id: userId,
                        is_valid: true
                    },
                    attributes: [
                        'id', 'referrer_id', 'referred_id', 'total_recharge', 
                        'is_valid', 'created_at', 'updated_at'
                    ],
                    order: [['updated_at', 'DESC']], // Most recent valid referrals first
                    limit: limit,
                    offset: offset
                });
                
                validReferrals = validResult.rows;
                totalValidReferrals = validResult.count;
                console.log('✅ Found valid referrals:', totalValidReferrals);
            } catch (error) {
                console.log('⚠️ Could not fetch valid referrals:', error.message);
            }
        }

        // Get detailed user information for each valid referral
        const detailedReferrals = [];
        
        console.log('🔍 Processing', validReferrals.length, 'valid referrals...');
        
        for (const referral of validReferrals) {
            try {
                // Get referred user details
                const referredUser = await User.findByPk(referral.referred_id, {
                    attributes: [
                        'user_id', 'user_name', 'created_at'
                    ]
                });

                if (referredUser) {
                    const referralRecord = {
                        referralId: referral.id,
                        userId: referredUser.user_id,
                        userName: referredUser.user_name,
                        registrationDate: referredUser.created_at,
                        totalRecharge: parseFloat(referral.total_recharge)
                    };

                    detailedReferrals.push(referralRecord);
                } else {
                    console.log(`❌ Referred user not found for ID: ${referral.referred_id}`);
                }
            } catch (error) {
                console.error('💥 Error processing referral:', referral.id, error);
                console.error('Error details:', error.message);
            }
        }

        console.log(`📊 Total detailed referrals processed: ${detailedReferrals.length}`);

        // Sort by registration date (most recent first)
        detailedReferrals.sort((a, b) => new Date(b.registrationDate) - new Date(a.registrationDate));

        // Apply pagination to combined results
        const totalReferrals = detailedReferrals.length;
        const paginatedReferrals = detailedReferrals.slice(offset, offset + limit);

        // Calculate summary statistics
        const totalRechargeAmount = detailedReferrals.reduce((sum, referral) => sum + referral.totalRecharge, 0);

        // Format the response
        const history = paginatedReferrals.map(referral => ({
            referralId: referral.referralId,
            userId: referral.userId,
            userName: referral.userName,
            registrationDate: referral.registrationDate,
            totalRecharge: referral.totalRecharge
        }));

        console.log(`📋 Final history array length: ${history.length}`);

        return {
            success: true,
            summary: {
                totalValidReferrals: totalValidReferrals,
                totalRechargeAmount: totalRechargeAmount,
                averageRechargePerReferral: totalValidReferrals > 0 ? totalRechargeAmount / totalValidReferrals : 0
            },
            history: history,
            pagination: {
                currentPage: page,
                limit: limit,
                totalPages: Math.ceil(totalValidReferrals / limit),
                totalItems: totalValidReferrals,
                hasNextPage: page * limit < totalValidReferrals,
                hasPrevPage: page > 1
            }
        };

    } catch (error) {
        console.error('💥 Error getting valid referral history:', error);
        return {
            success: false,
            message: 'Error getting valid referral history: ' + error.message
        };
    }
};

/**
 * 🆕 NEW: Get invitation reward history for a user
 * Shows all invitation bonuses claimed by the user
 * @param {number} userId - User ID
 * @param {number} page - Page number for pagination
 * @param {number} limit - Items per page
 * @returns {Object} - Invitation reward history with pagination
 */
const getInvitationRewardHistory = async (userId, page = 1, limit = 10) => {
    try {
        console.log('🎁 Getting invitation reward history for user:', userId, 'Page:', page, 'Limit:', limit);
        
        const offset = (page - 1) * limit;
        
        // Get user info
        const user = await User.findByPk(userId, {
            attributes: ['user_id', 'user_name', 'direct_referral_count', 'valid_referral_count']
        });

        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        // Get invitation rewards from ReferralCommission table
        let commissionRewards = [];
        let totalCommissionRewards = 0;
        
        if (ReferralCommission) {
            try {
                const commissionResult = await ReferralCommission.findAndCountAll({
                    where: {
                        user_id: userId,
                        type: 'direct_bonus'
                    },
                    attributes: [
                        'id', 'user_id', 'referred_user_id', 'level', 'amount', 
                        'type', 'rebate_type', 'distribution_batch_id', 'status', 
                        'created_at', 'updated_at'
                    ],
                    order: [['created_at', 'DESC']],
                    limit: limit,
                    offset: offset
                });
                
                commissionRewards = commissionResult.rows;
                totalCommissionRewards = commissionResult.count;
                console.log('💰 Found commission rewards:', totalCommissionRewards);
            } catch (error) {
                console.log('⚠️ Could not fetch commission rewards:', error.message);
            }
        }

        // Get invitation rewards from Transaction table
        let transactionRewards = [];
        let totalTransactionRewards = 0;
        
        try {
            const Transaction = require('../models/Transaction');
            const transactionResult = await Transaction.findAndCountAll({
                where: {
                    user_id: userId,
                    type: 'direct_bonus'
                },
                attributes: [
                    'id', 'user_id', 'type', 'amount', 'status', 'description',
                    'reference_id', 'created_at', 'metadata'
                ],
                order: [['created_at', 'DESC']],
                limit: limit,
                offset: offset
            });
            
            transactionRewards = transactionResult.rows;
            totalTransactionRewards = transactionResult.count;
            console.log('💳 Found transaction rewards:', totalTransactionRewards);
        } catch (error) {
            console.log('⚠️ Could not fetch transaction rewards:', error.message);
        }

        // Combine and deduplicate rewards based on reference_id or created_at
        const allRewards = [];
        const seenRewards = new Set();

        // Add commission rewards first
        for (const reward of commissionRewards) {
            const key = `commission_${reward.id}`;
            if (!seenRewards.has(key)) {
                seenRewards.add(key);
                allRewards.push({
                    id: reward.id,
                    type: 'commission_record',
                    amount: parseFloat(reward.amount),
                    status: reward.status,
                    description: `Direct invitation bonus`,
                    reference_id: reward.distribution_batch_id,
                    created_at: reward.created_at,
                    metadata: {
                        bonus_type: 'direct_invitation',
                        commission_id: reward.id,
                        level: reward.level,
                        rebate_type: reward.rebate_type
                    }
                });
            }
        }

        // Add transaction rewards
        for (const reward of transactionRewards) {
            const key = `transaction_${reward.id}`;
            if (!seenRewards.has(key)) {
                seenRewards.add(key);
                allRewards.push({
                    id: reward.id,
                    type: 'transaction_record',
                    amount: parseFloat(reward.amount),
                    status: reward.status,
                    description: reward.description,
                    reference_id: reward.reference_id,
                    created_at: reward.created_at,
                    metadata: reward.metadata || {}
                });
            }
        }

        // Sort by creation date (newest first)
        allRewards.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Apply pagination to combined results
        const totalRewards = allRewards.length;
        const paginatedRewards = allRewards.slice(offset, offset + limit);

        // Calculate summary statistics
        const totalAmount = allRewards.reduce((sum, reward) => sum + reward.amount, 0);
        // Consider both 'completed' (Transaction) and 'paid' (ReferralCommission) as completed
        const completedRewards = allRewards.filter(reward => 
            reward.status === 'completed' || 
            reward.status === 'paid' || 
            reward.status === 'success'
        );
        const totalCompletedAmount = completedRewards.reduce((sum, reward) => sum + reward.amount, 0);

        // Format the response
        const history = paginatedRewards.map(reward => ({
            id: reward.id,
            recordType: reward.type,
            amount: reward.amount,
            status: reward.status,
            // Show user-friendly status
            displayStatus: reward.status === 'completed' || reward.status === 'paid' ? 'completed' : reward.status,
            description: reward.description,
            referenceId: reward.reference_id,
            claimedAt: reward.created_at,
            metadata: reward.metadata
        }));

        return {
            success: true,
            user: {
                userId: user.user_id,
                userName: user.user_name,
                totalReferrals: user.direct_referral_count || 0,
                validReferrals: user.valid_referral_count || 0
            },
            summary: {
                totalRewards: totalRewards,
                totalAmount: totalAmount,
                completedRewards: completedRewards.length,
                totalCompletedAmount: totalCompletedAmount
            },
            pagination: {
                currentPage: page,
                limit: limit,
                totalPages: Math.ceil(totalRewards / limit),
                totalItems: totalRewards,
                hasNextPage: page * limit < totalRewards,
                hasPrevPage: page > 1
            },
            history: history,
            dataSources: {
                commissionRecords: totalCommissionRewards,
                transactionRecords: totalTransactionRewards
            }
        };

    } catch (error) {
        console.error('💥 Error getting invitation reward history:', error);
        return {
            success: false,
            message: 'Error getting invitation reward history: ' + error.message
        };
    }
};

// Helper function to get commission rate based on level
const getCommissionRate = (level) => {
    const rates = {
        1: 0.10, // 10% for level 1
        2: 0.05, // 5% for level 2
        3: 0.03, // 3% for level 3
        4: 0.02, // 2% for level 4
        5: 0.01, // 1% for level 5
        6: 0.005 // 0.5% for level 6
    };
    return rates[level] || 0;
};

// Helper function to calculate commission
const calculateCommission = (referredUser, rate) => {
    const totalBets = referredUser.total_bet_amount || 0;
    return totalBets * rate;
};

// Process referrals for all users
const processReferrals = async () => {
    try {
        // If ReferralTree doesn't exist, use simplified processing
        if (!ReferralTree) {
            console.log('ReferralTree model not available, using simplified referral processing');
            return {
                success: true,
                message: 'Referral processing completed (simplified)'
            };
        }

        // Get properly initialized sequelize instance
        const sequelizeInstance = await getSequelizeInstance();
        if (!sequelizeInstance) {
            throw new Error('Database connection not available');
        }

        // Use raw SQL query to avoid Sequelize's automatic join behavior
        const referralTrees = await sequelizeInstance.query(`
            SELECT 
                rt.id, rt.user_id, rt.referrer_id, 
                rt.level_1, rt.level_2, rt.level_3, rt.level_4, rt.level_5, rt.level_6,
                u1.user_id as referred_user_id, u1.user_name as referred_username, 
                u1.wallet_balance as referred_balance, u1.total_bet_amount as referred_total_bet,
                u2.user_id as referrer_user_id, u2.user_name as referrer_username, 
                u2.wallet_balance as referrer_balance
            FROM referral_trees rt
            LEFT JOIN users u1 ON rt.user_id = u1.user_id
            LEFT JOIN users u2 ON rt.referrer_id = u2.user_id
        `, {
            type: sequelizeInstance.QueryTypes.SELECT
        });

        for (const tree of referralTrees) {
            // Process each level
            for (let level = 1; level <= 6; level++) {
                const levelField = `level_${level}`;
                if (tree[levelField]) {
                    const userIds = tree[levelField].split(',').map(id => parseInt(id));
                    const rate = getCommissionRate(level);

                    // Get users at this level
                    const users = await User.findAll({
                        where: { user_id: userIds },
                        attributes: ['user_id', 'total_bet_amount']
                    });

                    // Calculate commission for each user at this level
                    for (const user of users) {
                        const commission = calculateCommission(user, rate);
                        if (commission > 0) {
                            // Update referrer's balance
                            await User.increment('wallet_balance', {
                                by: commission,
                                where: { user_id: tree.referrer_id }
                            });
                        }
                    }
                }
            }
        }

        return {
            success: true,
            message: 'Referral processing completed'
        };
    } catch (error) {
        console.error('Error processing referrals:', error);
        return {
            success: false,
            message: 'Error processing referrals'
        };
    }
};

// Helper function to get total deposits for a user
const getTotalDeposits = async (userId) => {
    try {
        const deposits = await WalletRecharge.findAll({
            where: {
                user_id: userId,
                status: 'completed'
            },
            attributes: ['amount']
        });

        return deposits.reduce((total, deposit) => total + parseFloat(deposit.amount), 0);
    } catch (error) {
        console.error('Error getting total deposits:', error);
        return 0;
    }
};

/**
 * Record attendance for a user
 * @param {number} userId - User ID
 * @returns {Object} - Operation result
 */
const recordAttendance = async (userId) => {
    try {
        const today = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
        
        // Get user's last login time
        const user = await User.findOne({
            where: { user_id: userId },
            attributes: ['last_login_at']
        });

        // Check if user has logged in today
        const hasLoggedInToday = user && user.last_login_at && 
            moment(user.last_login_at).format('YYYY-MM-DD') === today;

        if (!hasLoggedInToday) {
            return {
                success: false,
                message: 'You must log in today to record attendance'
            };
        }

        // Find today's attendance record
        let attendanceRecord = await AttendanceRecord.findOne({
            where: {
                user_id: userId,
                attendance_date: today
            }
        });

        if (attendanceRecord) {
            return {
                success: false,
                message: 'Attendance already recorded for today'
            };
        }

        // Get yesterday's attendance for streak calculation
        const yesterday = moment.tz('Asia/Kolkata').subtract(1, 'day').format('YYYY-MM-DD');
        const yesterdayAttendance = await AttendanceRecord.findOne({
            where: {
                user_id: userId,
                attendance_date: yesterday
            }
        });

        let streak = 1;
        if (yesterdayAttendance && yesterdayAttendance.has_recharged) {
            streak = (yesterdayAttendance.streak_count || 0) + 1;
        }

        // Create new attendance record
        attendanceRecord = await AttendanceRecord.create({
            user_id: userId,
            date: today,
            attendance_date: today,
            streak_count: streak,
            has_recharged: false,                    // Will be updated when user recharges
            recharge_amount: 0,
            additional_bonus: 0,
            bonus_amount: 0,
            bonus_claimed: false,
            claim_eligible: false,                   // Will be true only after recharge
            created_at: new Date(),
            updated_at: new Date()
        });

        return {
            success: true,
            message: 'Attendance recorded successfully',
            streak: streak,
            hasRecharged: false,
            isEligibleForBonus: false,
            attendanceDate: today
        };

    } catch (error) {
        console.error('Error recording attendance:', error);
        return {
            success: false,
            message: 'Error recording attendance: ' + error.message
        };
    }
};

/**
 * Get user's attendance history
 * @param {number} userId - User ID
 * @returns {Object} - Attendance history
 */
const getAttendanceHistory = async (userId) => {
    try {
        const today = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
        const thirtyDaysAgo = moment.tz('Asia/Kolkata').subtract(30, 'days').format('YYYY-MM-DD');

        // Get attendance records for last 30 days
        const attendanceRecords = await AttendanceRecord.findAll({
            where: {
                user_id: userId,
                attendance_date: {
                    [Op.between]: [thirtyDaysAgo, today]
                }
            },
            order: [['attendance_date', 'DESC']]
        });

        // Get today's attendance status
        const todayRecord = attendanceRecords.find(record => 
            record.attendance_date === today
        );

        // Calculate current streak
        let currentStreak = 0;
        let lastDate = moment.tz('Asia/Kolkata');
        
        for (const record of attendanceRecords) {
            const recordDate = moment(record.attendance_date);
            if (lastDate.diff(recordDate, 'days') === 1 && record.has_recharged) {
                currentStreak++;
                lastDate = recordDate;
            } else {
                break;
            }
        }

        // Format the response
        const history = attendanceRecords.map(record => ({
            date: record.attendance_date,
            hasAttended: true,
            hasRecharged: record.has_recharged,
            rechargeAmount: record.recharge_amount || 0,
            streakCount: record.streak_count,
            bonusAmount: record.bonus_amount,
            additionalBonus: record.additional_bonus,
            isBonusClaimed: record.bonus_claimed,
            isBonusEligible: record.claim_eligible
        }));

        return {
            success: true,
            today: {
                hasAttended: !!todayRecord,
                hasRecharged: todayRecord?.has_recharged || false,
                rechargeAmount: todayRecord?.recharge_amount || 0,
                streakCount: todayRecord?.streak_count || 0,
                bonusAmount: todayRecord?.bonus_amount || 0,
                additionalBonus: todayRecord?.additional_bonus || 0,
                isBonusClaimed: todayRecord?.bonus_claimed || false,
                isBonusEligible: todayRecord?.claim_eligible || false
            },
            currentStreak,
            history
        };

    } catch (error) {
        console.error('Error getting attendance history:', error);
        return {
            success: false,
            message: 'Error getting attendance history: ' + error.message
        };
    }
};

/**
 * Get user's self rebate history
 * @param {number} userId - User ID
 * @param {number} page - Page number
 * @param {number} limit - Items per page
 * @returns {Object} - Rebate history
 */
const getSelfRebateHistory = async (userId, page = 1, limit = 10) => {
    try {
        return await selfRebateService.getSelfRebateHistory(userId, page, limit);
    } catch (error) {
        console.error('Error getting self rebate history:', error);
        return {
            success: false,
            message: 'Error getting self rebate history: ' + error.message
        };
    }
};

/**
 * Get user's self rebate statistics
 * @param {number} userId - User ID
 * @returns {Object} - Rebate statistics
 */
const getSelfRebateStats = async (userId) => {
    try {
        return await selfRebateService.getSelfRebateStats(userId);
    } catch (error) {
        console.error('Error getting self rebate stats:', error);
        return {
            success: false,
            message: 'Error getting self rebate stats: ' + error.message
        };
    }
};

/**
 * Update upline referral trees when a new user is added
 * @param {number} directReferrerId - Direct referrer's user ID
 * @param {number} newUserId - New user's ID
 * @param {Object} transaction - Database transaction
 */
const updateUplineReferralTrees = async (directReferrerId, newUserId, transaction) => {
    try {
        console.log(`🔄 Updating upline referral trees for new user ${newUserId}`);
        
        // Get the direct referrer's tree
        let currentTree = await ReferralTree.findOne({
            where: { user_id: directReferrerId },
            transaction
        });

        if (!currentTree) {
            console.log('⚠️ Direct referrer tree not found, skipping upline updates');
            return;
        }

        // Traverse up the referral chain and update each level
        let currentUserId = directReferrerId;
        let level = 2; // Start from level 2 (the new user is at level 1)

        while (currentUserId && level <= 6) {
            // Find the current user's referrer
            const currentUser = await User.findByPk(currentUserId, { transaction });
            if (!currentUser || !currentUser.referral_code) {
                console.log(`🏁 Reached top of referral chain at level ${level - 1}`);
                break;
            }

            // Find the upline referrer
            const uplineReferrer = await User.findOne({
                where: { referring_code: currentUser.referral_code },
                transaction
            });

            if (!uplineReferrer) {
                console.log(`🏁 No upline referrer found at level ${level - 1}`);
                break;
            }

            // Get or create upline referrer's tree
            let uplineTree = await ReferralTree.findOne({
                where: { user_id: uplineReferrer.user_id },
                transaction
            });

            if (!uplineTree) {
                // Create upline tree entry
                uplineTree = await ReferralTree.create({
                    user_id: uplineReferrer.user_id,
                    referrer_id: null,
                    level_1: '',
                    level_2: '',
                    level_3: '',
                    level_4: '',
                    level_5: '',
                    level_6: '',
                    created_at: new Date(),
                    updated_at: new Date()
                }, { transaction });
            }

            // Update the appropriate level in upline tree
            const levelField = `level_${level}`;
            const currentLevelData = uplineTree[levelField] || '';
            const newLevelData = currentLevelData ? `${currentLevelData},${newUserId}` : newUserId.toString();

            await uplineTree.update({
                [levelField]: newLevelData,
                updated_at: new Date()
            }, { transaction });

            console.log(`✅ Updated level ${level} for upline user ${uplineReferrer.user_id}`);

            // Move up to next level
            currentUserId = uplineReferrer.user_id;
            level++;
        }

        console.log(`✅ Completed upline referral tree updates up to level ${level - 1}`);
    } catch (error) {
        console.error('💥 Error updating upline referral trees:', error);
        throw error;
    }
};

/**
 * Process multi-level rebate commission distribution (daily cron job)
 * This function processes rebates for all levels (1-6) based on team members' bets
 * @param {string} gameType - 'lottery' or 'casino'
 * @returns {Object} - Processing result
 */
const processMultiLevelRebateCommission = async (gameType) => {
    let t;
    
    try {
        console.log(`🔄 Starting multi-level rebate processing for ${gameType}`);
        
        // Get properly initialized sequelize instance
        const sequelizeInstance = await getSequelizeInstance();
        if (!sequelizeInstance) {
            throw new Error('Database connection not available');
        }
        
        t = await sequelizeInstance.transaction();
        
        // Generate a unique batch ID for this distribution run
        const batchId = `${gameType}-multilevel-${Date.now()}`;

        // Get yesterday's date range
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const endOfYesterday = new Date(yesterday);
        endOfYesterday.setHours(23, 59, 59, 999);

        let betRecords;

        // Get bet records based on game type
        if (gameType === 'lottery') {
            // Aggregate internal game bets (Wingo, 5D, K3, TRX Wix)
            betRecords = await sequelizeInstance.query(`
                SELECT user_id, SUM(bet_amount) as total_bet_amount
                FROM (
                    SELECT user_id, bet_amount FROM bet_record_wingos 
                    WHERE created_at BETWEEN :start AND :end
                    UNION ALL
                    SELECT user_id, bet_amount FROM bet_record_5ds
                    WHERE created_at BETWEEN :start AND :end
                    UNION ALL
                    SELECT user_id, bet_amount FROM bet_record_k3s
                    WHERE created_at BETWEEN :start AND :end
                    UNION ALL
                    SELECT user_id, bet_amount FROM bet_record_trx_wix
                    WHERE created_at BETWEEN :start AND :end
                ) as combined_bets
                GROUP BY user_id
            `, {
                replacements: { start: yesterday, end: endOfYesterday },
                type: sequelizeInstance.QueryTypes.SELECT,
                transaction: t
            });
        } else if (gameType === 'casino') {
            // Get external casino game bets
            betRecords = await sequelizeInstance.query(`
                SELECT user_id, SUM(amount) as total_bet_amount
                FROM game_transactions
                WHERE type = 'bet' AND created_at BETWEEN :start AND :end
                GROUP BY user_id
            `, {
                replacements: { start: yesterday, end: endOfYesterday },
                type: sequelizeInstance.QueryTypes.SELECT,
                transaction: t
            });
        }

        console.log(`📊 Found ${betRecords.length} users with bets for ${gameType}`);

        // Create a map of user bets for quick lookup
        const userBets = {};
        for (const record of betRecords) {
            userBets[record.user_id] = parseFloat(record.total_bet_amount);
        }

        // Get all users who have referral trees (potential referrers)
        const allReferrers = await ReferralTree.findAll({
            attributes: ['user_id', 'level_1', 'level_2', 'level_3', 'level_4', 'level_5', 'level_6'],
            transaction: t
        });

        console.log(`👥 Processing ${allReferrers.length} potential referrers`);

        let totalCommissionsProcessed = 0;
        let totalCommissionAmount = 0;

        for (const referrerTree of allReferrers) {
            const referrerId = referrerTree.user_id;
            
            // Get referrer's rebate level
            const referrer = await User.findOne({
                where: { user_id: referrerId },
                include: UserRebateLevel ? [
                    {
                        model: UserRebateLevel,
                        required: false
                    }
                ] : [],
                transaction: t
            });

            if (!referrer) continue;

            // Get rebate level details
            const rebateLevel = referrer.UserRebateLevel?.rebate_level || 'L0';
            const rebateLevelDetails = await RebateLevel.findOne({
                where: { level: rebateLevel },
                transaction: t
            });

            if (!rebateLevelDetails) {
                console.log(`⚠️ No rebate level details found for level ${rebateLevel}`);
                continue;
            }

            let referrerTotalCommission = 0;
            let levelCommissions = {};

            // Process each level (1-6)
            for (let level = 1; level <= 6; level++) {
                const levelField = `level_${level}`;
                const levelData = referrerTree[levelField];
                
                if (levelData && levelData.trim()) {
                    // Parse user IDs from the level data
                    const userIds = levelData.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                    
                    let levelTotalCommission = 0;
                    let levelUserCount = 0;

                    // Process each user at this level
                    for (const userId of userIds) {
                        const userBetAmount = userBets[userId];
                        
                        if (userBetAmount && userBetAmount > 0) {
                            // Get the rebate rate for this level and game type
                            const rebateRateField = gameType === 'lottery' ? 
                                `lottery_l${level}_rebate` : 
                                `casino_l${level}_rebate`;
                            
                            const rebateRate = parseFloat(rebateLevelDetails[rebateRateField]) || 0;
                            const commission = userBetAmount * rebateRate;

                            if (commission > 0) {
                                levelTotalCommission += commission;
                                levelUserCount++;

                                // Create commission record
                                if (ReferralCommission) {
                                    await ReferralCommission.create({
                                        user_id: referrerId,
                                        referred_user_id: userId,
                                        level: level,
                                        amount: commission,
                                        type: 'multilevel_rebate',
                                        rebate_type: gameType,
                                        distribution_batch_id: batchId,
                                        status: 'paid',
                                        created_at: new Date()
                                    }, { transaction: t });
                                }

                                console.log(`💰 Level ${level}: User ${userId} bet ${userBetAmount}, commission ${commission} (rate: ${rebateRate})`);
                            }
                        }
                    }

                    if (levelTotalCommission > 0) {
                        levelCommissions[`level${level}`] = {
                            userCount: levelUserCount,
                            totalCommission: levelTotalCommission
                        };
                        referrerTotalCommission += levelTotalCommission;
                    }
                }
            }

            // Credit total commission to referrer's wallet
            if (referrerTotalCommission > 0) {
                await updateWalletBalance(
                    referrerId,
                    referrerTotalCommission,
                    'add',
                    t
                );

                // Create transaction record
                if (Transaction) {
                    await Transaction.create({
                        user_id: referrerId,
                        type: 'multilevel_rebate_commission',
                        amount: referrerTotalCommission,
                        status: 'completed',
                        description: `${gameType} multi-level rebate commission`,
                        reference_id: `multilevel_rebate_${batchId}_${referrerId}`,
                        metadata: {
                            rebate_type: gameType,
                            batch_id: batchId,
                            level_breakdown: levelCommissions,
                            total_levels: Object.keys(levelCommissions).length
                        }
                    }, { transaction: t });
                }

                totalCommissionsProcessed++;
                totalCommissionAmount += referrerTotalCommission;

                console.log(`✅ Referrer ${referrerId}: Total commission ${referrerTotalCommission} from ${Object.keys(levelCommissions).length} levels`);
            }
        }

        await t.commit();

        console.log(`🎉 Multi-level rebate processing completed:`);
        console.log(`   - Processed: ${totalCommissionsProcessed} referrers`);
        console.log(`   - Total commission: ${totalCommissionAmount}`);
        console.log(`   - Game type: ${gameType}`);

        return {
            success: true,
            message: 'Multi-level rebate commission processed successfully',
            stats: {
                referrersProcessed: totalCommissionsProcessed,
                totalCommissionAmount: totalCommissionAmount,
                gameType: gameType,
                batchId: batchId
            }
        };
    } catch (error) {
        await t.rollback();
        console.error('Error processing multi-level rebate commission:', error);
        return {
            success: false,
            message: 'Error processing multi-level rebate commission: ' + error.message
        };
    }
};

/**
 * Get detailed rebate commission history for a user
 * Shows commission earned from each referred user at each level
 * @param {number} userId - User ID
 * @param {Object} dateFilter - Optional date filter
 * @param {number} page - Page number for pagination
 * @param {number} limit - Items per page
 * @returns {Object} - Commission history with user details
 */
const getRebateCommissionHistory = async (userId, dateFilter = null, page = 1, limit = 20) => {
    try {
        console.log('💰 Getting rebate commission history for user:', userId);

        if (!ReferralCommission) {
            return {
                success: false,
                message: 'ReferralCommission model not available'
            };
        }

        const offset = (page - 1) * limit;
        const whereClause = { user_id: userId };

        // Add date filter if provided
        if (dateFilter) {
            if (dateFilter.startDate && dateFilter.endDate) {
                whereClause.created_at = {
                    [Op.between]: [dateFilter.startDate, dateFilter.endDate]
                };
            } else if (dateFilter.created_at) {
                whereClause.created_at = dateFilter.created_at;
            }
        }

        // Get commission records with referred user details
        const commissionRecords = await ReferralCommission.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    as: 'referredUser',
                    foreignKey: 'referred_user_id',
                    attributes: ['user_id', 'user_name', 'created_at']
                }
            ],
            attributes: [
                'id', 'referred_user_id', 'level', 'amount', 'type', 
                'rebate_type', 'distribution_batch_id', 'status', 'created_at'
            ],
            order: [['created_at', 'DESC']],
            limit: limit,
            offset: offset
        });

        // Calculate summary statistics
        const totalCommission = commissionRecords.rows.reduce(
            (sum, record) => sum + parseFloat(record.amount), 0
        );

        const levelBreakdown = {};
        const userBreakdown = {};

        for (const record of commissionRecords.rows) {
            // Level breakdown
            const level = record.level;
            if (!levelBreakdown[level]) {
                levelBreakdown[level] = {
                    count: 0,
                    totalAmount: 0
                };
            }
            levelBreakdown[level].count++;
            levelBreakdown[level].totalAmount += parseFloat(record.amount);

            // User breakdown
            const referredUserId = record.referred_user_id;
            if (!userBreakdown[referredUserId]) {
                userBreakdown[referredUserId] = {
                    userId: referredUserId,
                    userName: record.referredUser?.user_name || 'Unknown',
                    totalCommission: 0,
                    levelCounts: {}
                };
            }
            userBreakdown[referredUserId].totalCommission += parseFloat(record.amount);
            
            if (!userBreakdown[referredUserId].levelCounts[level]) {
                userBreakdown[referredUserId].levelCounts[level] = 0;
            }
            userBreakdown[referredUserId].levelCounts[level]++;
        }

        // Convert user breakdown to array and sort by total commission
        const userBreakdownArray = Object.values(userBreakdown).sort(
            (a, b) => b.totalCommission - a.totalCommission
        );

        return {
            success: true,
            data: {
                commissionRecords: commissionRecords.rows,
                pagination: {
                    currentPage: page,
                    totalPages: Math.ceil(commissionRecords.count / limit),
                    totalRecords: commissionRecords.count,
                    recordsPerPage: limit
                },
                summary: {
                    totalCommission: totalCommission,
                    totalRecords: commissionRecords.count,
                    levelBreakdown: levelBreakdown,
                    userBreakdown: userBreakdownArray
                }
            }
        };
    } catch (error) {
        console.error('Error getting rebate commission history:', error);
        return {
            success: false,
            message: 'Error getting rebate commission history: ' + error.message
        };
    }
};

/**
 * Get rebate commission statistics for a user
 * Shows total earnings, team performance, and potential earnings
 * @param {number} userId - User ID
 * @param {Object} dateFilter - Optional date filter
 * @returns {Object} - Commission statistics
 */
const getRebateCommissionStats = async (userId, dateFilter = null) => {
    try {
        console.log('📊 Getting rebate commission stats for user:', userId);

        // Get user's rebate level
        const user = await User.findOne({
            where: { user_id: userId },
            include: UserRebateLevel ? [
                {
                    model: UserRebateLevel,
                    required: false
                }
            ] : []
        });

        if (!user) {
            return {
                success: false,
                message: 'User not found'
            };
        }

        const rebateLevel = user.UserRebateLevel?.rebate_level || 'L0';
        
        // Get rebate level details
        let rebateLevelDetails = null;
        if (RebateLevel) {
            rebateLevelDetails = await RebateLevel.findOne({
                where: { level: rebateLevel }
            });
        }

        // Get team structure
        const teamResult = await getTeamReferrals(userId, dateFilter);
        const teamStructure = teamResult.success ? teamResult.teamReferrals : {};

        // Calculate team statistics
        let totalTeamMembers = 0;
        let levelStats = {};

        for (let level = 1; level <= 6; level++) {
            const levelKey = `level${level}`;
            const levelUsers = teamStructure[levelKey] || [];
            const levelCount = levelUsers.length;
            
            totalTeamMembers += levelCount;
            
            // Calculate total betting for this level
            const levelTotalBetting = levelUsers.reduce(
                (sum, user) => sum + (parseFloat(user.total_bet_amount) || 0), 0
            );

            levelStats[level] = {
                userCount: levelCount,
                totalBetting: levelTotalBetting,
                rebateRate: rebateLevelDetails ? 
                    (rebateLevelDetails[`lottery_l${level}_rebate`] || 0) : 0,
                potentialCommission: levelTotalBetting * (rebateLevelDetails ? 
                    parseFloat(rebateLevelDetails[`lottery_l${level}_rebate`] || 0) : 0)
            };
        }

        // Get commission history if available
        let commissionHistory = null;
        if (ReferralCommission) {
            const historyResult = await getRebateCommissionHistory(userId, dateFilter, 1, 1000);
            if (historyResult.success) {
                commissionHistory = historyResult.data;
            }
        }

        // Calculate total earned commission
        const totalEarnedCommission = commissionHistory ? 
            commissionHistory.summary.totalCommission : 0;

        // Calculate potential daily commission based on current team betting
        let potentialDailyCommission = 0;
        for (let level = 1; level <= 6; level++) {
            if (levelStats[level]) {
                potentialDailyCommission += levelStats[level].potentialCommission;
            }
        }

        return {
            success: true,
            data: {
                userInfo: {
                    userId: user.user_id,
                    userName: user.user_name,
                    rebateLevel: rebateLevel,
                    rebateLevelDetails: rebateLevelDetails
                },
                teamStructure: {
                    totalMembers: totalTeamMembers,
                    levelBreakdown: levelStats
                },
                commissionStats: {
                    totalEarned: totalEarnedCommission,
                    potentialDaily: potentialDailyCommission,
                    commissionHistory: commissionHistory
                },
                rebateRates: rebateLevelDetails ? {
                    lottery: {
                        level1: rebateLevelDetails.lottery_l1_rebate,
                        level2: rebateLevelDetails.lottery_l2_rebate,
                        level3: rebateLevelDetails.lottery_l3_rebate,
                        level4: rebateLevelDetails.lottery_l4_rebate,
                        level5: rebateLevelDetails.lottery_l5_rebate,
                        level6: rebateLevelDetails.lottery_l6_rebate
                    },
                    casino: {
                        level1: rebateLevelDetails.casino_l1_rebate,
                        level2: rebateLevelDetails.casino_l2_rebate,
                        level3: rebateLevelDetails.casino_l3_rebate,
                        level4: rebateLevelDetails.casino_l4_rebate,
                        level5: rebateLevelDetails.casino_l5_rebate,
                        level6: rebateLevelDetails.casino_l6_rebate
                    }
                } : null
            }
        };
    } catch (error) {
        console.error('Error getting rebate commission stats:', error);
        return {
            success: false,
            message: 'Error getting rebate commission stats: ' + error.message
        };
    }
};

/**
 * Get commission details for a specific user in your team
 * Shows how much commission you earned from a specific referred user
 * @param {number} referrerId - Your user ID
 * @param {number} referredUserId - The referred user's ID
 * @param {Object} dateFilter - Optional date filter
 * @returns {Object} - Commission details for that specific user
 */
const getCommissionFromUser = async (referrerId, referredUserId, dateFilter = null) => {
    try {
        console.log(`💰 Getting commission details from user ${referredUserId} for referrer ${referrerId}`);

        if (!ReferralCommission) {
            return {
                success: false,
                message: 'ReferralCommission model not available'
            };
        }

        const whereClause = {
            user_id: referrerId,
            referred_user_id: referredUserId
        };

        // Add date filter if provided
        if (dateFilter) {
            if (dateFilter.startDate && dateFilter.endDate) {
                whereClause.created_at = {
                    [Op.between]: [dateFilter.startDate, dateFilter.endDate]
                };
            } else if (dateFilter.created_at) {
                whereClause.created_at = dateFilter.created_at;
            }
        }

        // Get commission records for this specific user
        const commissionRecords = await ReferralCommission.findAll({
            where: whereClause,
            include: [
                {
                    model: User,
                    as: 'referredUser',
                    foreignKey: 'referred_user_id',
                    attributes: ['user_id', 'user_name', 'created_at', 'total_bet_amount']
                }
            ],
            attributes: [
                'id', 'level', 'amount', 'type', 'rebate_type', 
                'distribution_batch_id', 'status', 'created_at'
            ],
            order: [['created_at', 'DESC']]
        });

        // Calculate summary
        const totalCommission = commissionRecords.reduce(
            (sum, record) => sum + parseFloat(record.amount), 0
        );

        const levelBreakdown = {};
        const typeBreakdown = {};

        for (const record of commissionRecords) {
            // Level breakdown
            const level = record.level;
            if (!levelBreakdown[level]) {
                levelBreakdown[level] = {
                    count: 0,
                    totalAmount: 0
                };
            }
            levelBreakdown[level].count++;
            levelBreakdown[level].totalAmount += parseFloat(record.amount);

            // Type breakdown (lottery vs casino)
            const rebateType = record.rebate_type || 'unknown';
            if (!typeBreakdown[rebateType]) {
                typeBreakdown[rebateType] = {
                    count: 0,
                    totalAmount: 0
                };
            }
            typeBreakdown[rebateType].count++;
            typeBreakdown[rebateType].totalAmount += parseFloat(record.amount);
        }

        // Get referred user info
        const referredUser = commissionRecords.length > 0 ? 
            commissionRecords[0].referredUser : null;

        return {
            success: true,
            data: {
                referredUser: referredUser,
                commissionRecords: commissionRecords,
                summary: {
                    totalCommission: totalCommission,
                    totalRecords: commissionRecords.length,
                    levelBreakdown: levelBreakdown,
                    typeBreakdown: typeBreakdown
                }
            }
        };
    } catch (error) {
        console.error('Error getting commission from user:', error);
        return {
            success: false,
            message: 'Error getting commission from user: ' + error.message
        };
    }
};

/**
 * Get team referrals for any user (Admin function) - SIMPLE VERSION
 * @param {number} targetUserId - Target user ID to get team for
 * @param {Object} dateFilter - Optional date filter
 * @param {number} page - Page number for pagination
 * @param {number} limit - Items per page
 * @returns {Object} - Team referral data by level
 */
const getTeamReferralsForAdmin = async (targetUserId, dateFilter = null, page = 1, limit = 20) => {
    try {
        console.log('👑 [ADMIN] Getting team referrals for user:', targetUserId, 'Page:', page, 'Limit:', limit);
        
        // First verify the target user exists
        const targetUser = await User.findByPk(targetUserId, {
            attributes: ['user_id', 'user_name', 'created_at', 'wallet_balance', 'vip_level', 'actual_deposit_amount']
        });
        
        if (!targetUser) {
            return {
                success: false,
                message: 'Target user not found'
            };
        }

        // ✅ ADMIN API: Per-Level Pagination (Fixed Version)
        console.log('🔧 Admin API: Implementing per-level pagination...');
        
        // Get direct referrals (level 1) - no pagination initially
        const directResult = await getDirectReferrals(targetUserId, dateFilter);
        if (!directResult.success) {
            return directResult;
        }
        
        // Build complete team structure first (all levels)
        const completeTeamReferrals = {
            level1: [],
            level2: [],
            level3: [],
            level4: [],
            level5: [],
            level6: []
        };
        
        let totalCount = 0;
        let totalCommissionEarned = 0;
        
        // Process level 1 (direct referrals)
        if (directResult.directReferrals && directResult.directReferrals.length > 0) {
            const level1Users = [];
            
            for (const user of directResult.directReferrals) {
                let userCommission = 0;
                
                // Get commission data if available
                if (ReferralCommission) {
                    const commissionRecords = await ReferralCommission.findAll({
                        where: {
                            user_id: targetUserId,
                            referred_user_id: user.user_id
                        },
                        attributes: ['amount']
                    });
                    
                    userCommission = commissionRecords.reduce(
                        (sum, record) => sum + parseFloat(record.amount), 0
                    );
                    totalCommissionEarned += userCommission;
                }
                
                const userWithCommission = {
                    userId: user.user_id,
                    userName: user.user_name,
                    createdAt: user.created_at,
                    walletBalance: user.wallet_balance,
                    vipLevel: user.vip_level,
                    totalDeposit: user.actual_deposit_amount,
                    commissionEarned: userCommission,
                    totalWithdrawal: 0
                };
                
                level1Users.push(userWithCommission);
            }
            
            completeTeamReferrals.level1 = level1Users;
            totalCount += level1Users.length;
            console.log(`✅ Level 1: Found ${level1Users.length} users`);
        }
        
        // For levels 2-6, build the referral chain
        for (let level = 2; level <= 6; level++) {
            const previousLevelUsers = completeTeamReferrals[`level${level - 1}`] || [];
            const currentLevelUsers = [];
            
            for (const prevUser of previousLevelUsers) {
                // Get users referred by this previous level user
                const nextLevelReferrals = await getDirectReferrals(prevUser.userId, dateFilter);
                
                if (nextLevelReferrals.success && nextLevelReferrals.directReferrals) {
                    for (const nextUser of nextLevelReferrals.directReferrals) {
                        let userCommission = 0;
                        
                        // Get commission data if available
                        if (ReferralCommission) {
                            const commissionRecords = await ReferralCommission.findAll({
                                where: {
                                    user_id: targetUserId,
                                    referred_user_id: nextUser.user_id
                                },
                                attributes: ['amount']
                            });
                            
                            userCommission = commissionRecords.reduce(
                                (sum, record) => sum + parseFloat(record.amount), 0
                            );
                            totalCommissionEarned += userCommission;
                        }
                        
                        const userWithCommission = {
                            userId: nextUser.user_id,
                            userName: nextUser.user_name,
                            createdAt: nextUser.created_at,
                            walletBalance: nextUser.wallet_balance,
                            vipLevel: nextUser.vip_level,
                            totalDeposit: nextUser.actual_deposit_amount,
                            commissionEarned: userCommission,
                            totalWithdrawal: 0
                        };
                        
                        currentLevelUsers.push(userWithCommission);
                    }
                }
            }
            
            completeTeamReferrals[`level${level}`] = currentLevelUsers;
            totalCount += currentLevelUsers.length;
            console.log(`✅ Level ${level}: Found ${currentLevelUsers.length} users`);
        }
        
        // ✅ IMPLEMENT PER-LEVEL PAGINATION (Fixed Version)
        const paginatedTeamReferrals = {
            level1: [],
            level2: [],
            level3: [],
            level4: [],
            level5: [],
            level6: []
        };
        
        // Apply pagination to each level independently
        for (let level = 1; level <= 6; level++) {
            const levelKey = `level${level}`;
            const allUsersInLevel = completeTeamReferrals[levelKey] || [];
            
            // Calculate pagination for this specific level
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedUsers = allUsersInLevel.slice(startIndex, endIndex);
            
            paginatedTeamReferrals[levelKey] = paginatedUsers;
            
            console.log(`📊 Level ${level}: ${paginatedUsers.length} users (page ${page}, limit ${limit})`);
        }
        
        // Calculate level counts for admin overview (total available, not paginated)
        const levelCounts = {};
        for (let level = 1; level <= 6; level++) {
            levelCounts[`level${level}`] = completeTeamReferrals[`level${level}`].length;
        }
        
        // Calculate total pages based on the level with the most users
        const maxUsersInAnyLevel = Math.max(...Object.values(levelCounts));
        const totalPages = Math.ceil(maxUsersInAnyLevel / limit);
        
        // Calculate pagination info
        const pagination = {
            currentPage: page,
            limit: limit,
            totalPages: totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            levelCounts: levelCounts, // Total users available in each level
            levelSummary: {
                totalLevels: 6,
                levelsWithUsers: Object.entries(levelCounts)
                    .filter(([level, count]) => count > 0)
                    .map(([level, count]) => ({ level, userCount: count }))
            }
        };
        
        console.log(`📄 Pagination: Page ${page} of ${totalPages}, showing ${limit} users per level`);
        
        return {
            success: true,
            teamReferrals: paginatedTeamReferrals, // Paginated data
            total: totalCount, // Total users across all levels
            totalCommissionEarned,
            levelCounts, // Total available users per level
            pagination, // Pagination details
            targetUser: {
                userId: targetUser.user_id,
                userName: targetUser.user_name,
                createdAt: targetUser.created_at,
                walletBalance: targetUser.wallet_balance,
                vipLevel: targetUser.vip_level,
                totalDeposit: targetUser.actual_deposit_amount
            },
            message: `Admin API: Per-level pagination - Page ${page} of ${totalPages}`
        };

    } catch (error) {
        console.error('💥 [ADMIN] Error getting team referrals for user:', error);
        return {
            success: false,
            message: 'Error getting team referrals: ' + error.message
        };
    }
};

/**
 * Get commission history data with datewise grouping (NEW FEATURE)
 * @param {number} userId - User ID
 * @param {Object} dateFilter - Optional date filter
 * @returns {Object} - Commission history with datewise data
 */
const getCommissionHistoryData = async (userId, dateFilter = null) => {
    try {
        // If ReferralCommission doesn't exist, return empty data
        if (!ReferralCommission) {
            return {
                totalUniqueUsers: 0,
                totalCommission: 0,
                totalBetAmount: 0,
                byDate: {},
                teamStructure: {
                    level1: 0, level2: 0, level3: 0, level4: 0, level5: 0, level6: 0
                }
            };
        }

        // For summary calculations - get ONLY rebate type commissions
        const summaryWhereClause = { 
            user_id: userId,
            type: 'rebate'  // Only rebate type for history
        };
        if (dateFilter) {
            if (dateFilter.startDate && dateFilter.endDate) {
                summaryWhereClause.created_at = {
                    [Op.between]: [new Date(dateFilter.startDate), new Date(dateFilter.endDate)]
                };
            } else if (dateFilter.startDate) {
                summaryWhereClause.created_at = {
                    [Op.gte]: new Date(dateFilter.startDate)
                };
            } else if (dateFilter.endDate) {
                summaryWhereClause.created_at = {
                    [Op.lte]: new Date(dateFilter.endDate)
                };
            } else if (dateFilter.created_at) {
                summaryWhereClause.created_at = dateFilter.created_at;
            }
        }

        // Get ALL commissions for summary calculations (all types, no pagination)
        const allCommissions = await ReferralCommission.findAll({
            where: summaryWhereClause,
            attributes: [
                'amount',
                'total_bet',
                'level',
                'rebate_type',
                'created_at',
                'referred_user_id'
            ],
            order: [['created_at', 'DESC']]
        });

        const totalCommission = allCommissions.reduce(
            (sum, commission) => sum + parseFloat(commission.amount), 0
        );

        const totalBetAmount = allCommissions.reduce(
            (sum, commission) => sum + parseFloat(commission.total_bet || 0), 0
        );

        // Calculate unique users count
        const uniqueUsers = new Set();
        for (const commission of allCommissions) {
            uniqueUsers.add(commission.referred_user_id);
        }

        // Group by date
        const byDate = {};

        for (const commission of allCommissions) {
            // Date grouping
            const dateKey = commission.created_at.toISOString().split('T')[0];
            if (!byDate[dateKey]) {
                byDate[dateKey] = { 
                    count: 0, amount: 0, totalBet: 0,
                    uniqueUsers: new Set(),
                    levelBreakdown: {}
                };
            }
            byDate[dateKey].count++;
            byDate[dateKey].amount += parseFloat(commission.amount);
            byDate[dateKey].totalBet += parseFloat(commission.total_bet || 0);
            byDate[dateKey].uniqueUsers.add(commission.referred_user_id);

            // Level breakdown per date
            const levelKey = `level${commission.level}`;
            if (!byDate[dateKey].levelBreakdown[levelKey]) {
                byDate[dateKey].levelBreakdown[levelKey] = { count: 0, amount: 0, totalBet: 0 };
            }
            byDate[dateKey].levelBreakdown[levelKey].count++;
            byDate[dateKey].levelBreakdown[levelKey].amount += parseFloat(commission.amount);
            byDate[dateKey].levelBreakdown[levelKey].totalBet += parseFloat(commission.total_bet || 0);
        }

        // Convert Sets to counts and sort dates
        for (const dateKey in byDate) {
            byDate[dateKey].uniqueUsers = byDate[dateKey].uniqueUsers.size;
        }

        // Sort byDate by date (newest first)
        const sortedByDate = {};
        Object.keys(byDate)
            .sort((a, b) => new Date(b) - new Date(a))
            .forEach(key => {
                sortedByDate[key] = byDate[key];
            });

        // Get team structure data
        let teamStructure = null;
        try {
            if (ReferralTree) {
                const userTree = await ReferralTree.findOne({
                    where: { user_id: userId }
                });
                
                if (userTree) {
                    teamStructure = {
                        level1: userTree.level_1 ? userTree.level_1.split(',').filter(id => id.trim()).length : 0,
                        level2: userTree.level_2 ? userTree.level_2.split(',').filter(id => id.trim()).length : 0,
                        level3: userTree.level_3 ? userTree.level_3.split(',').filter(id => id.trim()).length : 0,
                        level4: userTree.level_4 ? userTree.level_4.split(',').filter(id => id.trim()).length : 0,
                        level5: userTree.level_5 ? userTree.level_5.split(',').filter(id => id.trim()).length : 0,
                        level6: userTree.level_6 ? userTree.level_6.split(',').filter(id => id.trim()).length : 0
                    };
                }
            }
        } catch (error) {
            console.log('⚠️ Could not fetch team structure:', error.message);
        }

        return {
            totalUniqueUsers: uniqueUsers.size,
            totalCommission: totalCommission,
            totalBetAmount: totalBetAmount,
            byDate: sortedByDate
        };
    } catch (error) {
        console.error('Error getting commission history data:', error);
        return {
            totalUniqueUsers: 0,
            totalCommission: 0,
            totalBetAmount: 0,
            byDate: {}
        };
    }
};

module.exports = {
    // New/modified attendance functions
    autoProcessRechargeForAttendance,
    recordAttendance,
    getAttendanceHistory,
    getSelfRebateHistory,
    getSelfRebateStats,

    // Old attendance functions
    createReferralTree,
    processRebateCommission,
    getDirectReferrals,
    getTeamReferrals,
    getDirectReferralDeposits,
    getTeamReferralDeposits,
    getCommissionEarnings,
    getReferralTreeDetails,
    recordBetExperience,
    processDirectInvitationBonus,
    processFirstRechargeBonus,
    updateReferralOnRecharge,
    updateInvitationTier,
    claimInvitationBonus,
    getInvitationBonusStatus,
    processReferrals,
    getTotalDeposits,
    updateWalletBalance,
    autoRecordReferral,
    updateUplineReferralTrees,
    processMultiLevelRebateCommission,
    getRebateCommissionHistory,
    getRebateCommissionStats,
    getCommissionFromUser,
    getInvitationRewardHistory,
    getValidReferralHistory,
    getTeamReferralsForAdmin
};
