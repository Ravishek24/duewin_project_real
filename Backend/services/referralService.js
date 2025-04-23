// services/referralService.js
import { sequelize } from '../config/db.js';
import User from '../models/User.js';
import ReferralTree from '../models/ReferralTree.js';
import ReferralCommission from '../models/ReferralCommission.js';
import VipLevel from '../models/VipLevel.js';
import RebateLevel from '../models/RebateLevel.js';
import UserRebateLevel from '../models/UserRebateLevel.js';
import AttendanceRecord from '../models/AttendanceRecord.js';
import WalletRecharge from '../models/WalletRecharge.js';
import { Op } from 'sequelize';
import { updateWalletBalance } from './walletServices.js';

/**
 * Create or update a user's referral tree when a new user is registered
 * @param {number} userId - Newly registered user ID
 * @param {string} referralCode - Referral code used during registration
 * @returns {Object} - Operation result
 */
export const createReferralTree = async (userId, referralCode) => {
    const t = await sequelize.transaction();
    
    try {
        // Find the referrer by their referring_code
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
        
        // Get referrer's tree or create new if not exists
        let referrerTree = await ReferralTree.findOne({
            where: { user_id: referrer.user_id },
            transaction: t
        });
        
        if (!referrerTree) {
            referrerTree = await ReferralTree.create({
                user_id: referrer.user_id,
                level_1: userId.toString(),
                created_at: new Date(),
                updated_at: new Date()
            }, { transaction: t });
        } else {
            // Add the new user to level 1 of referrer
            const level1Users = referrerTree.level_1 ? 
                referrerTree.level_1.split(',').map(id => parseInt(id)) : [];
            
            if (!level1Users.includes(userId)) {
                level1Users.push(userId);
                await referrerTree.update({
                    level_1: level1Users.join(','),
                    updated_at: new Date()
                }, { transaction: t });
            }
        }
        
        // Increment direct referral count for referrer
        await User.increment('direct_referral_count', {
            by: 1,
            where: { user_id: referrer.user_id },
            transaction: t
        });
        
        // Create new user's tree
        await ReferralTree.create({
            user_id: userId,
            created_at: new Date(),
            updated_at: new Date()
        }, { transaction: t });
        
        // Now, update higher level trees recursively
        // Get referrer's referrer (level 2 for new user)
        const level2ReferrerId = referrer.referral_code ? 
            (await User.findOne({ 
                where: { referring_code: referrer.referral_code },
                transaction: t
            }))?.user_id : null;
        
        if (level2ReferrerId) {
            // Get or create level 2 referrer's tree
            let level2Tree = await ReferralTree.findOne({
                where: { user_id: level2ReferrerId },
                transaction: t
            });
            
            if (level2Tree) {
                // Add the new user to level 2 of this tree
                const level2Users = level2Tree.level_2 ?
                    level2Tree.level_2.split(',').map(id => parseInt(id)) : [];
                
                if (!level2Users.includes(userId)) {
                    level2Users.push(userId);
                    await level2Tree.update({
                        level_2: level2Users.join(','),
                        updated_at: new Date()
                    }, { transaction: t });
                }
                
                // Continue for level 3 and beyond...
                // Note: Actual implementation would continue this pattern for levels 3-6
                // This is simplified for brevity
            }
        }
        
        await t.commit();
        
        return {
            success: true,
            message: 'Referral tree created successfully'
        };
    } catch (error) {
        await t.rollback();
        console.error('Error creating referral tree:', error);
        return {
            success: false,
            message: 'Error creating referral tree'
        };
    }
};

/**
 * Process rebate commission distribution (daily cron job)
 * @param {string} gameType - 'lottery' or 'casino'
 * @returns {Object} - Processing result
 */
export const processRebateCommission = async (gameType) => {
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
            // This is simplified - you would need to join relevant bet record tables
            betRecords = await sequelize.query(`
                SELECT user_id, SUM(bet_amount) as total_bet_amount
                FROM (
                    SELECT user_id, bet_amount FROM bet_record_wingo 
                    WHERE time BETWEEN :start AND :end
                    UNION ALL
                    SELECT user_id, bet_amount FROM bet_record_5d
                    WHERE time BETWEEN :start AND :end
                    UNION ALL
                    SELECT user_id, bet_amount FROM bet_record_k3
                    WHERE time BETWEEN :start AND :end
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
                include: [
                    {
                        model: UserRebateLevel,
                        required: false
                    }
                ],
                transaction: t
            });
            
            if (!referrer) continue;
            
            // Get referrer's rebate level
            const rebateLevel = referrer.UserRebateLevel?.rebate_level || 'L0';
            const rebateLevelDetails = await RebateLevel.findOne({
                where: { level: rebateLevel },
                transaction: t
            });
            
            if (!rebateLevelDetails) continue;
            
            // Calculate level 1 commission
            const level1Rate = gameType === 'lottery' ? 
                rebateLevelDetails.lottery_l1_rebate : 
                rebateLevelDetails.casino_l1_rebate;
            
            const level1Commission = betAmount * parseFloat(level1Rate);
            
            if (level1Commission > 0) {
                // Create commission record
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
                
                // Add commission to referrer's wallet
                await updateWalletBalance(
                    referrer.user_id, 
                    level1Commission, 
                    'add', 
                    t
                );
            }
            
            // Continue process for levels 2-6 (using recursive referral lookup)
            // This would be similar to the level 1 process but with the appropriate rate for each level
            // ...
        }
        
        await t.commit();
        
        return {
            success: true,
            message: `Processed ${betRecords.length} rebate commissions for ${gameType}`,
            batchId
        };
    } catch (error) {
        await t.rollback();
        console.error(`Error processing ${gameType} rebate commission:`, error);
        return {
            success: false,
            message: `Error processing ${gameType} rebate commission`
        };
    }
};

/**
 * Get a user's direct referrals (level 1)
 * @param {number} userId - User ID
 * @param {Object} dateFilter - Optional date filter
 * @returns {Array} - Array of direct referrals
 */
export const getDirectReferrals = async (userId, dateFilter = null) => {
    try {
        // Get the user's referral tree
        const referralTree = await ReferralTree.findOne({
            where: { user_id: userId }
        });
        
        if (!referralTree || !referralTree.level_1) {
            return {
                success: true,
                directReferrals: [],
                total: 0
            };
        }
        
        // Get the list of direct referral user IDs
        const directReferralIds = referralTree.level_1.split(',').map(id => parseInt(id));
        
        // Build where clause with optional date filter
        const whereClause = { user_id: { [Op.in]: directReferralIds } };
        
        if (dateFilter) {
            whereClause.created_at = dateFilter;
        }
        
        // Get user details for direct referrals
        const directReferrals = await User.findAll({
            where: whereClause,
            attributes: [
                'user_id', 'user_name', 'email', 'phone_no', 
                'created_at', 'wallet_balance', 'vip_level'
            ],
            order: [['created_at', 'DESC']]
        });
        
        return {
            success: true,
            directReferrals,
            total: directReferrals.length
        };
    } catch (error) {
        console.error('Error getting direct referrals:', error);
        return {
            success: false,
            message: 'Error getting direct referrals'
        };
    }
};

/**
 * Get a user's team referrals (levels 1-6)
 * @param {number} userId - User ID
 * @param {Object} dateFilter - Optional date filter
 * @returns {Object} - Team referral data by level
 */
export const getTeamReferrals = async (userId, dateFilter = null) => {
    try {
        // Get the user's referral tree
        const referralTree = await ReferralTree.findOne({
            where: { user_id: userId }
        });
        
        if (!referralTree) {
            return {
                success: true,
                teamReferrals: {
                    level1: [],
                    level2: [],
                    level3: [],
                    level4: [],
                    level5: [],
                    level6: []
                },
                total: 0
            };
        }
        
        // Initialize result object
        const teamReferrals = {
            level1: [],
            level2: [],
            level3: [],
            level4: [],
            level5: [],
            level6: []
        };
        
        let totalCount = 0;
        
        // Process each level
        for (let level = 1; level <= 6; level++) {
            const fieldName = `level_${level}`;
            
            if (referralTree[fieldName]) {
                const userIds = referralTree[fieldName].split(',').map(id => parseInt(id));
                
                // Build where clause
                const whereClause = { user_id: { [Op.in]: userIds } };
                
                if (dateFilter) {
                    whereClause.created_at = dateFilter;
                }
                
                // Get users for this level
                const users = await User.findAll({
                    where: whereClause,
                    attributes: [
                        'user_id', 'user_name', 'email', 'phone_no', 
                        'created_at', 'wallet_balance', 'vip_level'
                    ],
                    order: [['created_at', 'DESC']]
                });
                
                teamReferrals[`level${level}`] = users;
                totalCount += users.length;
            }
        }
        
        return {
            success: true,
            teamReferrals,
            total: totalCount
        };
    } catch (error) {
        console.error('Error getting team referrals:', error);
        return {
            success: false,
            message: 'Error getting team referrals'
        };
    }
};

// services/referralService.js (continued)

/**
* Get direct referral deposit statistics
* @param {number} userId - User ID
* @param {Object} dateFilter - Optional date filter
* @returns {Object} - Deposit statistics
*/
export const getDirectReferralDeposits = async (userId, dateFilter = null) => {
    try {
        // Get direct referrals first
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
        
        // Build where clause
        const whereClause = { user_id: { [Op.in]: directReferralIds } };
        
        if (dateFilter) {
            whereClause.time_of_request = dateFilter;
        }
        
        // Get all deposits
        const deposits = await WalletRecharge.findAll({
            where: whereClause,
            attributes: [
                'user_id', 
                'added_amount', 
                'payment_status', 
                'time_of_request', 
                'time_of_success'
            ],
            order: [['time_of_request', 'DESC']]
        });
        
        // Get successful deposits
        const successfulDeposits = deposits.filter(d => d.payment_status);
        
        // Calculate total amount
        const totalAmount = successfulDeposits.reduce(
            (sum, deposit) => sum + parseFloat(deposit.added_amount), 
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
            (sum, deposit) => sum + parseFloat(deposit.added_amount), 
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
                (sum, d) => sum + parseFloat(d.added_amount), 
                0
            );
            
            return {
                userId: parseInt(userId),
                depositCount: userDeposits.length,
                totalAmount: totalUserDeposits,
                lastDepositDate: userDeposits[0].time_of_success
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
 export const getTeamReferralDeposits = async (userId, dateFilter = null) => {
    try {
        // Get team referrals first
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
        
        // Build where clause
        const whereClause = { user_id: { [Op.in]: teamUserIds } };
        
        if (dateFilter) {
            whereClause.time_of_request = dateFilter;
        }
        
        // Get all deposits
        const deposits = await WalletRecharge.findAll({
            where: whereClause,
            attributes: [
                'user_id', 
                'added_amount', 
                'payment_status', 
                'time_of_request', 
                'time_of_success'
            ],
            order: [['time_of_request', 'DESC']]
        });
        
        // Get successful deposits
        const successfulDeposits = deposits.filter(d => d.payment_status);
        
        // Calculate total amount
        const totalAmount = successfulDeposits.reduce(
            (sum, deposit) => sum + parseFloat(deposit.added_amount), 
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
            (sum, deposit) => sum + parseFloat(deposit.added_amount), 
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
                (sum, d) => sum + parseFloat(d.added_amount), 
                0
            );
            
            return {
                userId: parseInt(userId),
                depositCount: userDeposits.length,
                totalAmount: totalUserDeposits,
                lastDepositDate: userDeposits[0].time_of_success
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
 export const getCommissionEarnings = async (userId, dateFilter = null) => {
    try {
        // Build where clause
        const whereClause = { user_id: userId };
        
        if (dateFilter) {
            whereClause.created_at = dateFilter;
        }
        
        // Get all commissions
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
        
        // Calculate totals
        const totalAmount = commissions.reduce(
            (sum, commission) => sum + parseFloat(commission.amount), 
            0
        );
        
        // Group by type and level
        const byType = {};
        const byLevel = {};
        
        for (const commission of commissions) {
            // Group by type
            const typeKey = commission.rebate_type || commission.type;
            if (!byType[typeKey]) {
                byType[typeKey] = {
                    count: 0,
                    amount: 0
                };
            }
            
            byType[typeKey].count++;
            byType[typeKey].amount += parseFloat(commission.amount);
            
            // Group by level
            const levelKey = `level${commission.level}`;
            if (!byLevel[levelKey]) {
                byLevel[levelKey] = {
                    count: 0,
                    amount: 0
                };
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
 * @param {number} maxLevel - Maximum level to return (default: 6)
 * @returns {Object} - Referral tree details
 */
 export const getReferralTreeDetails = async (userId, maxLevel = 6) => {
    try {
        // Get the referral tree
        const referralTree = await ReferralTree.findOne({
            where: { user_id: userId }
        });
        
        if (!referralTree) {
            return {
                success: true,
                referralTree: [],
                totalCount: 0
            };
        }
        
        // Initialize result array
        const treeDetails = [];
        let totalCount = 0;
        
        // Process each level
        for (let level = 1; level <= maxLevel; level++) {
            const fieldName = `level_${level}`;
            
            if (referralTree[fieldName]) {
                const userIds = referralTree[fieldName].split(',').map(id => parseInt(id));
                
                // Get users for this level
                const users = await User.findAll({
                    where: { user_id: { [Op.in]: userIds } },
                    attributes: [
                        'user_id', 'user_name', 'email', 'created_at'
                    ]
                });
                
                // Get deposit totals for each user
                for (const user of users) {
                    const deposits = await WalletRecharge.findAll({
                        where: { 
                            user_id: user.user_id,
                            payment_status: true
                        },
                        attributes: [
                            'added_amount'
                        ]
                    });
                    
                    const totalDeposit = deposits.reduce(
                        (sum, deposit) => sum + parseFloat(deposit.added_amount), 
                        0
                    );
                    
                    // Get latest commission
                    const latestCommission = await ReferralCommission.findOne({
                        where: {
                            user_id: userId,
                            referred_user_id: user.user_id
                        },
                        order: [['created_at', 'DESC']]
                    });
                    
                    treeDetails.push({
                        user_id: user.user_id,
                        user_name: user.user_name,
                        level,
                        total_deposit: totalDeposit,
                        latest_commission_time: latestCommission?.created_at || null
                    });
                    
                    totalCount++;
                }
            }
        }
        
        return {
            success: true,
            referralTree: treeDetails,
            totalCount
        };
    } catch (error) {
        console.error('Error getting referral tree details:', error);
        return {
            success: false,
            message: 'Error getting referral tree details'
        };
    }
 };
 
 /**
 * Record VIP experience points from betting
 * @param {number} userId - User ID
 * @param {number} betAmount - Bet amount
 * @returns {Object} - Operation result
 */
 export const recordBetExperience = async (userId, betAmount) => {
    const t = await sequelize.transaction();
    
    try {
        // Get user with current VIP data
        const user = await User.findByPk(userId, {
            attributes: ['user_id', 'vip_exp', 'vip_level'],
            transaction: t
        });
        
        if (!user) {
            await t.rollback();
            return {
                success: false,
                message: 'User not found'
            };
        }
        
        // Calculate exp to add (1 exp per rupee bet)
        const expToAdd = Math.floor(betAmount);
        
        // Update user's VIP exp
        const newExp = user.vip_exp + expToAdd;
        await user.update({ vip_exp: newExp }, { transaction: t });
        
        // Check for VIP level up
        const vipLevels = await VipLevel.findAll({
            order: [['exp_required', 'ASC']],
            transaction: t
        });
        
        let newVipLevel = 0;
        for (const vipLevel of vipLevels) {
            if (newExp >= vipLevel.exp_required) {
                newVipLevel = vipLevel.level;
            } else {
                break;
            }
        }
        
        // If VIP level increased, update and award bonus
        let levelUpDetails = null;
        if (newVipLevel > user.vip_level) {
            // Get level details
            const levelDetails = vipLevels.find(l => l.level === newVipLevel);
            
            // Update user's VIP level
            await user.update({ vip_level: newVipLevel }, { transaction: t });
            
            // Award bonus if level up
            await updateWalletBalance(userId, levelDetails.bonus_amount, 'add', t);
            
            levelUpDetails = {
                oldLevel: user.vip_level,
                newLevel: newVipLevel,
                bonusAmount: levelDetails.bonus_amount
            };
        }
        
        await t.commit();
        
        return {
            success: true,
            expAdded: expToAdd,
            newExp,
            levelUp: levelUpDetails !== null,
            levelUpDetails
        };
    } catch (error) {
        await t.rollback();
        console.error('Error recording bet experience:', error);
        return {
            success: false,
            message: 'Error recording bet experience'
        };
    }
 };
 
 /**
 * Process direct invitation bonus based on referral count
 * @param {number} userId - User ID
 * @returns {Object} - Operation result
 */
 export const processDirectInvitationBonus = async (userId) => {
    const t = await sequelize.transaction();
    
    try {
        // Get user
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
        
        // Get user's direct referral count
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
        
        // Check if this bonus has already been claimed
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
            
            // Find the next tier
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
            referred_user_id: userId, // Self-reference for direct bonus
            level: 0,
            amount: highestEligibleTier.amount,
            type: 'direct_bonus',
            distribution_batch_id: `direct-bonus-${Date.now()}`,
            created_at: new Date()
        }, { transaction: t });
        
        // Find the next tier
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
 * Record user attendance and process attendance bonus
 * @param {number} userId - User ID
 * @returns {Object} - Operation result
 */
 export const recordAttendance = async (userId) => {
    const t = await sequelize.transaction();
    
    try {
        // Get user
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
        
        // Check if already attended today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayAttendance = await AttendanceRecord.findOne({
            where: {
                user_id: userId,
                attendance_date: today
            },
            transaction: t
        });
        
        if (todayAttendance) {
            await t.rollback();
            return {
                success: true,
                message: 'Already attended today',
                streak: todayAttendance.streak_count,
                bonusClaimed: todayAttendance.bonus_claimed
            };
        }
        
        // Get yesterday's attendance to check streak
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const yesterdayAttendance = await AttendanceRecord.findOne({
            where: {
                user_id: userId,
                attendance_date: yesterday
            },
            transaction: t
        });
        
        // Calculate streak
        let streak = 1;
        if (yesterdayAttendance) {
            streak = yesterdayAttendance.streak_count + 1;
        }
        
        // Define bonus amounts
        const bonusAmounts = [7, 20, 100, 200, 450, 2400, 6400];
        const bonusIndex = Math.min(streak - 1, bonusAmounts.length - 1);
        const bonusAmount = bonusAmounts[bonusIndex];
        
        // Create attendance record
        const attendanceRecord = await AttendanceRecord.create({
            user_id: userId,
            attendance_date: today,
            streak_count: streak,
            bonus_claimed: true,
            bonus_amount: bonusAmount,
            created_at: new Date()
        }, { transaction: t });
        
        // Award bonus
        await updateWalletBalance(userId, bonusAmount, 'add', t);
        
        await t.commit();
        
        return {
            success: true,
            message: 'Attendance recorded and bonus awarded',
            streak,
            bonusAmount,
            attendanceRecord
        };
    } catch (error) {
        await t.rollback();
        console.error('Error recording attendance:', error);
        return {
            success: false,
            message: 'Error recording attendance'
        };
    }
 };
 
 /**
 * Process first recharge bonus
 * @param {number} userId - User ID
 * @param {number} rechargeAmount - Recharge amount
 * @returns {Object} - Operation result
 */
 export const processFirstRechargeBonus = async (userId, rechargeAmount) => {
    const t = await sequelize.transaction();
    
    try {
        // Check if this is the first recharge
        const previousRecharges = await WalletRecharge.findAll({
            where: {
                user_id: userId,
                payment_status: true
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
 
 export default {
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
    recordAttendance,
    processFirstRechargeBonus
 };
