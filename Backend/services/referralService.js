// services/referralService.js - COMPLETE FIXED VERSION
const { sequelize } = require('../config/db');
const { Op } = require('sequelize');
const moment = require('moment-timezone');

// Import only the models that actually exist
const User = require('../models/User');
const WalletRecharge = require('../models/WalletRecharge');

// Import models that exist in your codebase, but handle gracefully if they don't exist
let ReferralTree, ReferralCommission, VipLevel, RebateLevel, UserRebateLevel, AttendanceRecord, ValidReferral, VipReward;

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

// Import self rebate service
const selfRebateService = require('./selfRebateService');

// Helper function to update wallet balance
const updateWalletBalance = async (userId, amount, operation = 'add', transaction = null) => {
    try {
        const user = await User.findByPk(userId, { transaction });
        if (!user) {
            throw new Error('User not found');
        }

        const currentBalance = parseFloat(user.wallet_balance) || 0;
        let newBalance;

        if (operation === 'add') {
            newBalance = currentBalance + parseFloat(amount);
        } else if (operation === 'subtract') {
            newBalance = Math.max(0, currentBalance - parseFloat(amount));
        } else {
            throw new Error('Invalid operation');
        }

        await user.update({ wallet_balance: newBalance }, { transaction });
        return { success: true, newBalance };
    } catch (error) {
        console.error('Error updating wallet balance:', error);
        throw error;
    }
};

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
    const t = await sequelize.transaction();

    try {
        // Generate a unique batch ID for this distribution run
        const batchId = `${gameType}-${Date.now()}`;

        // Get yesterday's date range
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const endOfYesterday = new Date(yesterday);
        endOfYesterday.setHours(23, 59, 59, 999);

        let betRecords;

        // Get bet records based on game type
        if (gameType === 'lottery') {
            // Aggregate internal game bets (Wingo, 5D, K3)
            betRecords = await sequelize.query(`
                SELECT user_id, SUM(bet_amount) as total_bet_amount
                FROM (
                    SELECT user_id, bet_amount FROM bet_record_wingo 
                    WHERE created_at BETWEEN :start AND :end
                    UNION ALL
                    SELECT user_id, bet_amount FROM bet_record_5d
                    WHERE created_at BETWEEN :start AND :end
                    UNION ALL
                    SELECT user_id, bet_amount FROM bet_record_k3
                    WHERE created_at BETWEEN :start AND :end
                ) as combined_bets
                GROUP BY user_id
            `, {
                replacements: { start: yesterday, end: endOfYesterday },
                type: sequelize.QueryTypes.SELECT,
                transaction: t
            });
        } else if (gameType === 'casino') {
            // Get external casino game bets
            betRecords = await sequelize.query(`
                SELECT user_id, SUM(amount) as total_bet_amount
                FROM game_transactions
                WHERE type = 'bet' AND created_at BETWEEN :start AND :end
                GROUP BY user_id
            `, {
                replacements: { start: yesterday, end: endOfYesterday },
                type: sequelize.QueryTypes.SELECT,
                transaction: t
            });
        }

        // Process each user's bets and distribute commission to referrers
        for (const record of betRecords) {
            const userId = record.user_id;
            const betAmount = parseFloat(record.total_bet_amount);

            // Find the user
            const user = await User.findByPk(userId, { transaction: t });
            if (!user) continue;

            // Find user's referrer
            if (!user.referral_code) continue;

            const referrer = await User.findOne({
                where: { referring_code: user.referral_code },
                include: UserRebateLevel ? [
                    {
                        model: UserRebateLevel,
                        required: false
                    }
                ] : [],
                transaction: t
            });

            if (!referrer) continue;

            // Calculate and award commission (simplified if models don't exist)
            if (ReferralCommission && RebateLevel) {
                // Full rebate logic
                const rebateLevel = referrer.UserRebateLevel?.rebate_level || 'L0';
                const rebateLevelDetails = await RebateLevel.findOne({
                    where: { level: rebateLevel },
                    transaction: t
                });

                if (rebateLevelDetails) {
                    const level1Rate = gameType === 'lottery' ?
                        rebateLevelDetails.lottery_l1_rebate :
                        rebateLevelDetails.casino_l1_rebate;

                    const level1Commission = betAmount * parseFloat(level1Rate);

                    if (level1Commission > 0) {
                        await ReferralCommission.create({
                            user_id: referrer.user_id,
                            referred_user_id: userId,
                            level: 1,
                            amount: level1Commission,
                            type: 'bet',
                            rebate_type: gameType,
                            distribution_batch_id: batchId,
                            created_at: new Date()
                        }, { transaction: t });

                        await updateWalletBalance(
                            referrer.user_id,
                            level1Commission,
                            'add',
                            t
                        );
                    }
                }
            } else {
                // Simplified commission (5% of bet amount)
                const commission = betAmount * 0.05;
                if (commission > 0) {
                    await updateWalletBalance(
                        referrer.user_id,
                        commission,
                        'add',
                        t
                    );
                }
            }
        }

        await t.commit();
        return {
            success: true,
            message: 'Rebate commission processed successfully'
        };
    } catch (error) {
        await t.rollback();
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
                'user_id', 'user_name', 'email', 'phone_no',
                'created_at', 'wallet_balance', 'vip_level', 'actual_deposit_amount'
            ],
            order: [['created_at', 'DESC']]
        });

        console.log('📊 Found direct referrals:', directReferrals.length);

        return {
            success: true,
            directReferrals,
            total: directReferrals.length
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
const getTeamReferrals = async (userId, dateFilter = null) => {
    try {
        console.log('🏆 Getting team referrals for user:', userId);
        console.log('🔧 ReferralTree model available:', !!ReferralTree);

        // ALWAYS use fallback method since ReferralTree isn't working
        console.log('⚠️ Using fallback method (returning direct referrals only)');
        
        const directResult = await getDirectReferrals(userId, dateFilter);
        
        return {
            success: true,
            teamReferrals: {
                level1: directResult.success ? directResult.directReferrals : [],
                level2: [],
                level3: [],
                level4: [],
                level5: [],
                level6: []
            },
            total: directResult.success ? directResult.total : 0
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
                commissions: []
            };
        }

        const whereClause = { user_id: userId };

        if (dateFilter) {
            whereClause.created_at = dateFilter;
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
            commissions
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
 * @returns {Object} - Operation result
 */
const autoRecordReferral = async (newUserId, referralCode) => {
    const t = await sequelize.transaction();

    try {
        console.log(`🔗 Auto-recording referral for new user ${newUserId} with code: ${referralCode}`);

        // Find the referrer
        const referrer = await User.findOne({
            where: { referring_code: referralCode },
            transaction: t
        });

        if (!referrer) {
            await t.rollback();
            return {
                success: false,
                message: 'Invalid referral code'
            };
        }

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
                await ReferralTree.create({
                    user_id: newUserId,
                    referrer_id: referrer.user_id,
                    created_at: new Date(),
                    updated_at: new Date()
                }, { transaction: t });
            } catch (treeError) {
                console.warn('Could not create referral tree entry:', treeError.message);
            }
        }

        await t.commit();

        console.log(`✅ Referral auto-recorded: User ${newUserId} referred by ${referrer.user_id}`);

        return {
            success: true,
            message: 'Referral recorded successfully',
            referrerId: referrer.user_id,
            referrerName: referrer.user_name,
            newDirectReferralCount: (referrer.direct_referral_count || 0) + 1
        };

    } catch (error) {
        await t.rollback();
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
    const t = await sequelize.transaction();

    try {
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
            await ReferralCommission.create({
                user_id: userId,
                referred_user_id: userId,
                level: 0,
                amount: highestEligibleTier.amount,
                type: 'direct_bonus',
                distribution_batch_id: `direct-bonus-${Date.now()}`,
                created_at: new Date()
            }, { transaction: t });
        } else {
            // Simplified: just award the bonus
            await updateWalletBalance(userId, highestEligibleTier.amount, 'add', t);
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
    const t = await sequelize.transaction();

    try {
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

        // Award bonus
        await updateWalletBalance(userId, applicableTier.bonus, 'add', t);

        await t.commit();

        return {
            success: true,
            message: 'First recharge bonus awarded',
            rechargeAmount,
            bonusAmount: applicableTier.bonus
        };
    } catch (error) {
        await t.rollback();
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
    const t = await sequelize.transaction();

    try {
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
                created_at: new Date()
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
        await t.rollback();
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
    const t = await sequelize.transaction();

    try {
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

        // If ValidReferral model exists, use it
        if (ValidReferral) {
            let validReferral = await ValidReferral.findOne({
                where: {
                    referrer_id: referrer.user_id,
                    referred_id: userId
                },
                transaction: t
            });

            if (!validReferral) {
                validReferral = await ValidReferral.create({
                    referrer_id: referrer.user_id,
                    referred_id: userId,
                    total_recharge: rechargeAmount,
                    is_valid: rechargeAmount >= 300,
                    created_at: new Date(),
                    updated_at: new Date()
                }, { transaction: t });
            } else {
                const newTotalRecharge = parseFloat(validReferral.total_recharge) + parseFloat(rechargeAmount);
                await validReferral.update({
                    total_recharge: newTotalRecharge,
                    is_valid: newTotalRecharge >= 300,
                    updated_at: new Date()
                }, { transaction: t });
            }

            // Update referrer's valid count if applicable
            if (!validReferral.is_valid &&
                (parseFloat(validReferral.total_recharge) + parseFloat(rechargeAmount)) >= 300) {

                await User.increment('valid_referral_count', {
                    by: 1,
                    where: { user_id: referrer.user_id },
                    transaction: t
                });
            }
        }

        await t.commit();

        return {
            success: true,
            message: 'Referral status updated successfully'
        };
    } catch (error) {
        await t.rollback();
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
    const t = transaction || await sequelize.transaction();

    try {
        console.log('🔄 Updating invitation tier for user:', userId);
        
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
    const t = await sequelize.transaction();

    try {
        console.log('🎁 Claiming invitation bonus for user:', userId);
        
        // Only query columns that exist
        const user = await User.findByPk(userId, {
            attributes: [
                'user_id',
                'direct_referral_count'
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

        const directReferralCount = user.direct_referral_count || 0;
        console.log('📊 User has', directReferralCount, 'direct referrals');

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

        // Find the highest eligible tier
        let eligibleTier = null;
        for (const tier of bonusTiers) {
            if (directReferralCount >= tier.invitees) {
                eligibleTier = tier;
            }
        }

        if (!eligibleTier) {
            await t.rollback();
            return {
                success: false,
                message: 'No eligible invitation bonus tier reached yet'
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
            await ReferralCommission.create({
                user_id: userId,
                referred_user_id: userId,
                level: 0,
                amount: eligibleTier.amount,
                type: 'direct_bonus',
                distribution_batch_id: `direct-bonus-${Date.now()}`,
                created_at: new Date()
            }, { transaction: t });
        }

        // Credit wallet with bonus amount
        await updateWalletBalance(
            userId,
            parseFloat(eligibleTier.amount),
            'add',
            t
        );

        console.log('💰 Added', eligibleTier.amount, 'to user wallet');

        await t.commit();

        return {
            success: true,
            message: 'Invitation bonus claimed successfully',
            tier: eligibleTier.invitees,
            amount: parseFloat(eligibleTier.amount)
        };
    } catch (error) {
        await t.rollback();
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
        
        // Only query columns that exist in your users table
        const user = await User.findByPk(userId, {
            attributes: [
                'user_id',
                'user_name',
                'direct_referral_count'
                // Removed: 'valid_referral_count', 'eligible_invitation_tier', 'eligible_invitation_amount'
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

        // Get claimed bonus tiers (only if ReferralCommission model exists)
        let claimedBonuses = [];
        if (ReferralCommission) {
            try {
                claimedBonuses = await ReferralCommission.findAll({
                    where: {
                        user_id: userId,
                        type: 'direct_bonus'
                    },
                    attributes: ['amount', 'created_at']
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

        // Find next tier to reach based on direct_referral_count
        const directReferralCount = user.direct_referral_count || 0;
        let nextTier = null;
        for (const tier of bonusTiers) {
            if (directReferralCount < tier.invitees) {
                nextTier = tier;
                break;
            }
        }

        // Check if user is eligible for any tier
        let eligibleTier = null;
        for (const tier of bonusTiers) {
            if (directReferralCount >= tier.invitees) {
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
            validReferrals: directReferralCount, // Using direct_referral_count as fallback
            claimedTiers,
            nextTier,
            hasUnclaimedBonus: !!eligibleTier,
            unclaimedTier: eligibleTier ? {
                tier: eligibleTier.invitees,
                amount: eligibleTier.amount
            } : null
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

        // Use raw SQL query to avoid Sequelize's automatic join behavior
        const referralTrees = await sequelize.query(`
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
            type: sequelize.QueryTypes.SELECT
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
};