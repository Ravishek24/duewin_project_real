// services/enhancedRebateService.js
const { Op } = require('sequelize');
const moment = require('moment-timezone');

class EnhancedRebateService {
    constructor() {
        this.BATCH_SIZE = 100;
        this.MAX_LEVELS = 6;
    }

    /**
     * Process daily rebate commissions for all users in batches
     * @param {Date} targetDate - Date to process (default: yesterday)
     * @returns {Promise<Object>} Processing results
     */
    async processDailyRebateCommissions(targetDate = null) {
        const startTime = Date.now();
        // Use IST timezone for date calculation
        const processDate = targetDate || moment().tz('Asia/Kolkata').subtract(1, 'day').format('YYYY-MM-DD');
        
        console.log(`💰 Starting enhanced daily rebate processing for ${processDate}`);
        
        try {
            const models = await this.getModels();
            
            // Get all users with RebateTeam entries
            const totalUsers = await models.RebateTeam.count();
            console.log(`📊 Total users with rebate teams: ${totalUsers}`);
            
            let processedUsers = 0;
            let totalCommission = 0;
            let errors = [];
            
            // Process in batches
            for (let offset = 0; offset < totalUsers; offset += this.BATCH_SIZE) {
                console.log(`🔄 Processing batch ${Math.floor(offset / this.BATCH_SIZE) + 1}/${Math.ceil(totalUsers / this.BATCH_SIZE)}`);
                
                const batchResult = await this.processBatch(offset, this.BATCH_SIZE, processDate, models);
                
                processedUsers += batchResult.processedUsers;
                totalCommission += batchResult.totalCommission;
                errors.push(...batchResult.errors);
                
                // Small delay between batches to prevent overload
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const processingTime = Date.now() - startTime;
            
            console.log(`✅ Enhanced rebate processing completed:`);
            console.log(`   📊 Processed users: ${processedUsers}`);
            console.log(`   💰 Total commission: ₹${totalCommission.toFixed(2)}`);
            console.log(`   ⏱️  Processing time: ${processingTime}ms`);
            console.log(`   ❌ Errors: ${errors.length}`);
            
            return {
                success: true,
                processedUsers,
                totalCommission,
                errors,
                processingTime,
                processDate
            };
            
        } catch (error) {
            console.error('❌ Error in enhanced rebate processing:', error);
            return {
                success: false,
                error: error.message,
                processDate
            };
        }
    }

    /**
     * Process a batch of users for rebate commissions
     * @param {number} offset - Batch offset
     * @param {number} limit - Batch size
     * @param {string} processDate - Date to process
     * @param {Object} models - Sequelize models
     * @returns {Promise<Object>} Batch results
     */
    async processBatch(offset, limit, processDate, models) {
        const batchStartTime = Date.now();
        let processedUsers = 0;
        let totalCommission = 0;
        let errors = [];

        try {
            // Get batch of users with their rebate team data
            const userBatch = await models.RebateTeam.findAll({
                include: [{
                    model: models.User,
                    as: 'user',
                    attributes: ['user_id', 'user_name', 'wallet_balance']
                }],
                limit,
                offset,
                order: [['user_id', 'ASC']]
            });

            console.log(`📦 Processing batch of ${userBatch.length} users`);

            for (const rebateTeam of userBatch) {
                try {
                    const userResult = await this.processUserRebate(rebateTeam, processDate, models);
                    
                    if (userResult.success) {
                        processedUsers++;
                        totalCommission += userResult.commission;
                        
                        if (userResult.commission > 0) {
                            console.log(`✅ User ${rebateTeam.user.user_name}: ₹${userResult.commission.toFixed(2)} commission`);
                        }
                    } else {
                        errors.push({
                            userId: rebateTeam.user_id,
                            error: userResult.error
                        });
                    }
                } catch (error) {
                    errors.push({
                        userId: rebateTeam.user_id,
                        error: error.message
                    });
                }
            }

            const batchTime = Date.now() - batchStartTime;
            console.log(`📦 Batch completed: ${processedUsers} users, ₹${totalCommission.toFixed(2)} commission, ${batchTime}ms`);

            return {
                processedUsers,
                totalCommission,
                errors
            };

        } catch (error) {
            console.error('❌ Batch processing error:', error);
            return {
                processedUsers: 0,
                totalCommission: 0,
                errors: [{
                    batch: `${offset}-${offset + limit}`,
                    error: error.message
                }]
            };
        }
    }

    /**
     * Process rebate commission for a single user
     * @param {Object} rebateTeam - User's rebate team data
     * @param {string} processDate - Date to process
     * @param {Object} models - Sequelize models
     * @returns {Promise<Object>} Processing result
     */
    async processUserRebate(rebateTeam, processDate, models) {
        const transaction = await models.User.sequelize.transaction();
        
        try {
            const userId = rebateTeam.user_id;
            const currentLevel = rebateTeam.current_rebet_level;
            
            // Get user's referral tree
            const referralTree = await models.ReferralTree.findOne({
                where: { user_id: userId }
            });

            if (!referralTree) {
                await transaction.rollback();
                return { success: true, commission: 0, message: 'No referral tree found' };
            }

            // Get rebate level details
            const rebateLevel = await models.RebateLevel.findOne({
                where: { level: currentLevel }
            });

            if (!rebateLevel) {
                await transaction.rollback();
                return { success: false, error: `No rebate level found for level ${currentLevel}` };
            }

            let totalCommission = 0;
            const levelCommissions = {};
            const allDailyBets = {}; // Collect all bets from all levels

            // Process each level (1-6)
            for (let level = 1; level <= this.MAX_LEVELS; level++) {
                const levelField = `level_${level}`;
                const levelData = referralTree[levelField];

                if (!levelData || levelData.trim() === '') {
                    continue;
                }

                // Get user IDs at this level
                const levelUserIds = levelData.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));

                if (levelUserIds.length === 0) {
                    continue;
                }

                // Get daily bets for users at this level
                const dailyBets = await this.getDailyBetsForUsers(levelUserIds, processDate, models);
                
                // Merge bets into allDailyBets
                for (const [userId, betAmount] of Object.entries(dailyBets)) {
                    if (!allDailyBets[userId]) {
                        allDailyBets[userId] = 0;
                    }
                    allDailyBets[userId] += betAmount;
                }
                
                // Calculate commission for this level
                const levelCommission = this.calculateLevelCommission(dailyBets, rebateLevel, level);
                
                if (levelCommission > 0) {
                    levelCommissions[level] = levelCommission;
                    totalCommission += levelCommission;
                }
            }

            // Update user's wallet if commission earned
            if (totalCommission > 0) {
                await models.User.increment('wallet_balance', {
                    by: totalCommission,
                    where: { user_id: userId },
                    transaction
                });

                // Create individual commission records for each team member who placed bets
                for (const [referredUserId, betAmount] of Object.entries(allDailyBets)) {
                    if (betAmount > 0) {
                        // Find which level this user belongs to
                        let userLevel = 1; // Default to level 1
                        
                        for (let level = 1; level <= this.MAX_LEVELS; level++) {
                            const levelField = `level_${level}`;
                            const levelData = referralTree[levelField];
                            
                            if (levelData && levelData.includes(referredUserId.toString())) {
                                userLevel = level;
                                break;
                            }
                        }
                        
                        // Calculate this user's contribution to total commission
                        const totalTeamBets = Object.values(allDailyBets).reduce((sum, amount) => sum + amount, 0);
                        const userCommissionShare = (betAmount / totalTeamBets) * totalCommission;
                        
                        await models.ReferralCommission.create({
                            user_id: userId,
                            referred_user_id: parseInt(referredUserId),
                            level: userLevel, // Use actual referral level instead of hardcoded 1
                            amount: userCommissionShare,
                            type: 'rebate',
                            rebate_type: 'lottery',
                            distribution_batch_id: `rebate-${processDate}-${Date.now()}`, // Add batch ID
                            total_bet: betAmount, // Add the bet amount for this user on this date
                            status: 'paid',
                            created_at: new Date()
                        }, { transaction });
                    }
                }
            }

            // Update rebate team data
            await this.updateRebateTeamData(rebateTeam, models, transaction, allDailyBets);

            await transaction.commit();

            return {
                success: true,
                commission: totalCommission,
                levelCommissions
            };

        } catch (error) {
            await transaction.rollback();
            console.error(`❌ Error processing user ${rebateTeam.user_id}:`, error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get daily bets for a list of users
     * @param {Array} userIds - Array of user IDs
     * @param {string} processDate - Date to process (IST date)
     * @param {Object} models - Sequelize models
     * @returns {Promise<Object>} Bet data by user
     */
    async getDailyBetsForUsers(userIds, processDate, models) {
        const betData = {};

        // Convert IST date to UTC date range
        // IST is UTC+5:30, so IST 00:00 = UTC 18:30 (previous day)
        // IST 23:59 = UTC 18:29 (same day)
        const istStartOfDay = moment.tz(processDate + ' 00:00:00', 'Asia/Kolkata');
        const istEndOfDay = moment.tz(processDate + ' 23:59:59', 'Asia/Kolkata');
        
        const utcStartDate = istStartOfDay.utc().format('YYYY-MM-DD HH:mm:ss');
        const utcEndDate = istEndOfDay.utc().format('YYYY-MM-DD HH:mm:ss');

        console.log(`🕐 Processing bets for IST date: ${processDate}`);
        console.log(`   UTC range: ${utcStartDate} to ${utcEndDate}`);

        // Get bets from all game tables for the specified date
        const gameTables = [
            'bet_record_wingos',
            'bet_record_5ds', 
            'bet_record_k3s',
            'bet_record_trx_wix'
        ];

        for (const tableName of gameTables) {
            try {
                const bets = await models.User.sequelize.query(`
                    SELECT user_id, SUM(bet_amount) as total_bet_amount
                    FROM ${tableName}
                    WHERE user_id IN (:userIds)
                    AND created_at >= :utcStartDate
                    AND created_at <= :utcEndDate
                    AND status IN ('won', 'lost')
                    GROUP BY user_id
                `, {
                    replacements: { 
                        userIds, 
                        utcStartDate, 
                        utcEndDate 
                    },
                    type: models.User.sequelize.QueryTypes.SELECT
                });

                for (const bet of bets) {
                    if (!betData[bet.user_id]) {
                        betData[bet.user_id] = 0;
                    }
                    betData[bet.user_id] += parseFloat(bet.total_bet_amount || 0);
                }
            } catch (error) {
                console.warn(`⚠️ Error querying ${tableName}:`, error.message);
            }
        }

        return betData;
    }

    /**
     * Calculate commission for a specific level
     * @param {Object} dailyBets - Bet data by user
     * @param {Object} rebateLevel - Rebate level details
     * @param {number} level - Level number (1-6)
     * @returns {number} Commission amount
     */
    calculateLevelCommission(dailyBets, rebateLevel, level) {
        // Get commission rate for this level (all current games are lottery games)
        const lotteryRateField = `lottery_l${level}_rebate`;
        const lotteryRate = parseFloat(rebateLevel[lotteryRateField] || 0);
        
        if (lotteryRate <= 0) {
            return 0;
        }

        // Calculate total bets from all users at this level
        const totalBets = Object.values(dailyBets).reduce((sum, betAmount) => sum + betAmount, 0);
        
        // Apply lottery commission rate (rates are stored as decimal values, e.g., 0.007000 = 0.7%)
        const commission = totalBets * lotteryRate;
        
        return commission;
    }

    /**
     * Update rebate team data (team size, deposits, level upgrade)
     * @param {Object} rebateTeam - Current rebate team data
     * @param {Object} models - Sequelize models
     * @param {Object} transaction - Database transaction
     * @param {Object} allDailyBets - Daily bets from all team members
     * @returns {Promise<void>}
     */
    async updateRebateTeamData(rebateTeam, models, transaction, allDailyBets) {
        const userId = rebateTeam.user_id;

        // Get referral tree
        const referralTree = await models.ReferralTree.findOne({
            where: { user_id: userId }
        });

        if (!referralTree) {
            return;
        }

        // Calculate team counts by level
        const levelCounts = {};
        let totalTeamMembers = 0;

        for (let level = 1; level <= this.MAX_LEVELS; level++) {
            const levelField = `level_${level}`;
            const levelData = referralTree[levelField];
            
            if (levelData && levelData.trim()) {
                const userIds = levelData.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                levelCounts[level] = userIds.length;
                totalTeamMembers += userIds.length;
            } else {
                levelCounts[level] = 0;
            }
        }

        // Get total deposits from team members
        const teamUserIds = [];
        for (let level = 1; level <= this.MAX_LEVELS; level++) {
            const levelField = `level_${level}`;
            const levelData = referralTree[levelField];
            
            if (levelData && levelData.trim()) {
                const userIds = levelData.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                teamUserIds.push(...userIds);
            }
        }

        let totalDeposits = 0;
        if (teamUserIds.length > 0) {
            const deposits = await models.WalletRecharge.findAll({
                where: {
                    user_id: { [Op.in]: teamUserIds },
                    status: 'completed'
                },
                attributes: [
                    'user_id',
                    [models.User.sequelize.fn('SUM', models.User.sequelize.col('amount')), 'total_deposit']
                ],
                group: ['user_id'],
                transaction
            });

            totalDeposits = deposits.reduce((sum, deposit) => sum + parseFloat(deposit.dataValues.total_deposit || 0), 0);
        }

        // Calculate total daily betting from team members
        let totalDailyBetting = 0;
        if (Object.keys(allDailyBets).length > 0) {
            totalDailyBetting = Object.values(allDailyBets).reduce((sum, amount) => sum + amount, 0);
        }

        // Check for level upgrade
        const currentLevel = rebateTeam.current_rebet_level;
        const nextLevel = currentLevel + 1;
        
        const nextLevelRequirements = await models.RebateLevel.findOne({
            where: { level: nextLevel }
        });

        let newLevel = currentLevel;
        if (nextLevelRequirements) {
            const meetsTeamRequirement = totalTeamMembers >= nextLevelRequirements.min_team_members;
            const meetsDepositRequirement = totalDeposits >= parseFloat(nextLevelRequirements.min_team_deposit);
            const meetsBettingRequirement = totalDailyBetting >= parseFloat(nextLevelRequirements.min_team_betting);
            
            if (meetsTeamRequirement && meetsDepositRequirement && meetsBettingRequirement) {
                newLevel = nextLevel;
                console.log(`🎉 User ${userId} upgraded to level ${newLevel}`);
                console.log(`   Requirements met: Team ${totalTeamMembers}/${nextLevelRequirements.min_team_members}, Deposit ₹${totalDeposits}/${nextLevelRequirements.min_team_deposit}, Betting ₹${totalDailyBetting}/${nextLevelRequirements.min_team_betting}`);
            } else {
                console.log(`📊 User ${userId} level check: Team ${totalTeamMembers}/${nextLevelRequirements.min_team_members}, Deposit ₹${totalDeposits}/${nextLevelRequirements.min_team_deposit}, Betting ₹${totalDailyBetting}/${nextLevelRequirements.min_team_betting}`);
            }
        }

        // Update rebate team data
        await models.RebateTeam.update({
            current_rebet_level: newLevel,
            current_team_number: totalTeamMembers,
            current_deposit: totalDeposits,
            current_team_betting: totalDailyBetting,
            level_1_count: levelCounts[1] || 0,
            level_2_count: levelCounts[2] || 0,
            level_3_count: levelCounts[3] || 0,
            level_4_count: levelCounts[4] || 0,
            level_5_count: levelCounts[5] || 0,
            level_6_count: levelCounts[6] || 0,
            last_updated: new Date()
        }, {
            where: { user_id: userId },
            transaction
        });
    }

    /**
     * Get Sequelize models
     * @returns {Promise<Object>} Models object
     */
    async getModels() {
        const { getModels } = require('../models');
        return await getModels();
    }
}

module.exports = new EnhancedRebateService(); 