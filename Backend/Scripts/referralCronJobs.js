// scripts/referralCronJobs.js
const { processRebateCommission, recordBetExperience } = require('../services/referralService');
const { sequelize } = require('../config/db');
const { Op } = require('sequelize');

/**
* Process lottery rebate commissions
*/
const processLotteryRebate = async () => {
    console.log('Starting lottery rebate commission processing...');
    
    try {
      const result = await processRebateCommission('lottery');
      console.log(result.message);
    } catch (error) {
      console.error('Error processing lottery rebate:', error);
    }
    
    console.log('Lottery rebate processing complete');
   };
   
   /**
   * Process casino rebate commissions
   */
   const processCasinoRebate = async () => {
    console.log('Starting casino rebate commission processing...');
    
    try {
      const result = await processRebateCommission('casino');
      console.log(result.message);
    } catch (error) {
      console.error('Error processing casino rebate:', error);
    }
    
    console.log('Casino rebate processing complete');
   };
   
   /**
   * Process monthly VIP rewards
   */
   const processMonthlyVipRewards = async () => {
    console.log('Starting monthly VIP rewards processing...');
    
    try {
        // Connect to database
        await sequelize.authenticate();
        
        // Get all VIP levels
        const vipLevels = await sequelize.query(
            `SELECT * FROM vip_levels ORDER BY level ASC`,
            { type: sequelize.QueryTypes.SELECT }
        );
        
        // Get all users with VIP level > 0
        const users = await sequelize.query(
            `SELECT user_id, vip_level FROM users WHERE vip_level > 0`,
            { type: sequelize.QueryTypes.SELECT }
        );
        
        console.log(`Found ${users.length} VIP users for monthly rewards`);
        
        // Process each user
        for (const user of users) {
            const t = await sequelize.transaction();
            
            try {
                // Find the VIP level details
                const vipLevel = vipLevels.find(vl => vl.level === user.vip_level);
                
                if (vipLevel) {
                    // Check if monthly reward already claimed this month
                    const startOfMonth = new Date();
                    startOfMonth.setDate(1);
                    startOfMonth.setHours(0, 0, 0, 0);

                    const existingReward = await sequelize.query(
                        `SELECT * FROM vip_rewards 
                         WHERE user_id = :userId 
                         AND level = :level 
                         AND reward_type = 'monthly' 
                         AND claimed_at >= :startOfMonth`,
                        {
                            replacements: {
                                userId: user.user_id,
                                level: user.vip_level,
                                startOfMonth
                            },
                            type: sequelize.QueryTypes.SELECT,
                            transaction: t
                        }
                    );

                    if (!existingReward.length) {
                        // Create reward record
                        await sequelize.query(
                            `INSERT INTO vip_rewards 
                             (user_id, level, reward_type, amount, claimed_at, created_at, updated_at)
                             VALUES (:userId, :level, 'monthly', :amount, NOW(), NOW(), NOW())`,
                            {
                                replacements: {
                                    userId: user.user_id,
                                    level: user.vip_level,
                                    amount: vipLevel.monthly_reward
                                },
                                type: sequelize.QueryTypes.INSERT,
                                transaction: t
                            }
                        );

                        // Update user's wallet balance
                        await sequelize.query(
                            `UPDATE users 
                             SET wallet_balance = wallet_balance + :amount 
                             WHERE user_id = :userId`,
                            {
                                replacements: {
                                    userId: user.user_id,
                                    amount: vipLevel.monthly_reward
                                },
                                type: sequelize.QueryTypes.UPDATE,
                                transaction: t
                            }
                        );

                        // Log the transaction
                        await sequelize.query(
                            `INSERT INTO transactions 
                             (user_id, amount, type, note, created_at)
                             VALUES (:userId, :amount, 'credit', 'Monthly VIP reward', NOW())`,
                            {
                                replacements: {
                                    userId: user.user_id,
                                    amount: vipLevel.monthly_reward
                                },
                                type: sequelize.QueryTypes.INSERT,
                                transaction: t
                            }
                        );
                    }
                }
                
                await t.commit();
            } catch (error) {
                await t.rollback();
                console.error(`Error processing monthly reward for user ${user.user_id}:`, error);
            }
        }
        
        console.log(`Processed monthly rewards for ${users.length} users`);
    } catch (error) {
        console.error('Error in processMonthlyVipRewards:', error);
    }
    
    console.log('Monthly VIP rewards processing complete');
   };
   
   /**
   * Update user rebate levels
   */
   const updateUserRebateLevels = async () => {
    console.log('Starting user rebate level updates...');
    
    try {
      // Connect to database
      await sequelize.authenticate();
      
      // Get all rebate levels
      const rebateLevels = await sequelize.query(
        `SELECT * FROM rebate_levels ORDER BY min_team_members ASC, min_team_betting ASC`,
        { type: sequelize.QueryTypes.SELECT }
      );
      
      // Get all users
      const users = await sequelize.query(
        `SELECT user_id FROM users`,
        { type: sequelize.QueryTypes.SELECT }
      );
      
      console.log(`Processing rebate levels for ${users.length} users`);
      
      // Process each user
      for (const user of users) {
        // Get user's referral tree
        const referralTree = await sequelize.query(
          `SELECT * FROM referral_trees WHERE user_id = :userId`,
          { 
            replacements: { userId: user.user_id },
            type: sequelize.QueryTypes.SELECT
          }
        );
        
        if (!referralTree.length) continue;
        
        // Count team members
        let teamCount = 0;
        for (let i = 1; i <= 6; i++) {
          const levelField = `level_${i}`;
          if (referralTree[0][levelField]) {
            teamCount += referralTree[0][levelField].split(',').length;
          }
        }
        
        // Get team betting amount
        const teamBetting = await sequelize.query(
          `SELECT COALESCE(SUM(amount), 0) as total_betting
           FROM game_transactions
           WHERE type = 'bet' AND user_id IN (
             SELECT user_id FROM users
             WHERE referring_code IN (
               SELECT referring_code FROM users WHERE user_id = :userId
             )
           )`,
          { 
            replacements: { userId: user.user_id },
            type: sequelize.QueryTypes.SELECT
          }
        );
        
        // Get team deposit amount
        const teamDeposit = await sequelize.query(
          `SELECT COALESCE(SUM(added_amount), 0) as total_deposit
           FROM wallet_recharges
           WHERE payment_status = true AND user_id IN (
             SELECT user_id FROM users
             WHERE referring_code IN (
               SELECT referring_code FROM users WHERE user_id = :userId
             )
           )`,
          { 
            replacements: { userId: user.user_id },
            type: sequelize.QueryTypes.SELECT
          }
        );
        
        const totalTeamBetting = parseFloat(teamBetting[0].total_betting || 0);
        const totalTeamDeposit = parseFloat(teamDeposit[0].total_deposit || 0);
        
        // Find highest eligible rebate level
        let eligibleLevel = 'L0';
        for (const level of rebateLevels) {
          if (
            teamCount >= level.min_team_members &&
            totalTeamBetting >= level.min_team_betting &&
            totalTeamDeposit >= level.min_team_deposit
          ) {
            eligibleLevel = level.level;
          } else {
            break;
          }
        }
        
        // Update or create user rebate level
        await sequelize.query(
          `INSERT INTO user_rebate_levels 
           (user_id, rebate_level, team_members_count, team_total_betting, team_total_deposit, last_updated, created_at)
           VALUES (:userId, :level, :teamCount, :teamBetting, :teamDeposit, NOW(), NOW())
           ON DUPLICATE KEY UPDATE
           rebate_level = :level,
           team_members_count = :teamCount,
           team_total_betting = :teamBetting,
           team_total_deposit = :teamDeposit,
           last_updated = NOW()`,
          {
            replacements: {
              userId: user.user_id,
              level: eligibleLevel,
              teamCount,
              teamBetting: totalTeamBetting,
              teamDeposit: totalTeamDeposit
            },
            type: sequelize.QueryTypes.INSERT
          }
        );
        
        // Also update user's referral_level field
        await sequelize.query(
          `UPDATE users SET referral_level = :level WHERE user_id = :userId`,
          {
            replacements: {
              userId: user.user_id,
              level: eligibleLevel
            },
            type: sequelize.QueryTypes.UPDATE
          }
        );
      }
      
      console.log('User rebate levels updated');
    } catch (error) {
      console.error('Error updating user rebate levels:', error);
    }
    
    console.log('User rebate level updates complete');
   };
   
   // Function to run all daily jobs
   const runDailyJobs = async () => {
    console.log('Running daily referral jobs...');
    
    // Process rebate commissions
    await processLotteryRebate();
    await processCasinoRebate();
    
    // Update user rebate levels
    await updateUserRebateLevels();
    
    console.log('Daily referral jobs complete');
   };
   
   // Function to run monthly jobs (first day of month)
   const runMonthlyJobs = async () => {
    console.log('Running monthly referral jobs...');
    
    // Check if it's the first day of the month
    const today = new Date();
    if (today.getDate() === 1) {
      // Process monthly VIP rewards
      await processMonthlyVipRewards();
    }
    
    console.log('Monthly referral jobs complete');
   };
   
   // Run the jobs
   const runJobs = async () => {
    try {
      // Connect to the database
      await sequelize.authenticate();
      console.log('✅ Database connected for referral cron jobs');
      
      // Run daily jobs
      await runDailyJobs();
      
      // Run monthly jobs
      await runMonthlyJobs();
      
      // Close database connection
      await sequelize.close();
      
      console.log('All referral jobs completed');
      process.exit(0);
    } catch (error) {
      console.error('Error running referral jobs:', error);
      process.exit(1);
    }
   };

module.exports = {
  runReferralCronJobs: runJobs
};

// Run the jobs
runJobs();