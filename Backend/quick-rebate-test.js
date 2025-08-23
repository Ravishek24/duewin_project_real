// quick-rebate-test.js - Quick Manual Rebate Test
// Simple script to run rebate processing for ALL users

async function quickRebateTest() {
    try {
        console.log('⚡ QUICK REBATE TEST - ALL USERS');
        console.log('Running master cron rebate system...\n');
        
        // Import and execute the daily rebate function
        const { processDailyRebates } = require('./scripts/masterCronJobs');
        
        console.log('🔄 Processing rebates for all users...');
        const startTime = Date.now();
        
        await processDailyRebates();
        
        const processingTime = Date.now() - startTime;
        console.log(`✅ Completed in ${processingTime}ms`);
        
        // Quick verification
        const { getModels } = require('./models');
        const models = await getModels();
        
        const { Op } = require('sequelize');
        const recentCommissions = await models.ReferralCommission.count({
            where: {
                created_at: {
                    [Op.gte]: new Date(startTime)
                }
            }
        });
        
        console.log(`💰 New commissions created: ${recentCommissions}`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

quickRebateTest();
