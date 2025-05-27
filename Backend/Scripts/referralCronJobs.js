// REPLACE the runJobs function in Backend/scripts/referralCronJobs.js with:

// Run the jobs (SIMPLIFIED VERSION - most moved to master cron)
const runJobs = async () => {
  try {
      // Connect to the database
      await sequelize.authenticate();
      console.log('✅ Database connected for referral cron jobs');
      
      // Note: Most functions moved to masterCronJobs.js
      // This file now only handles legacy/specific rebate processing if needed
      console.log('ℹ️ Main referral processing moved to master cron system');
      console.log('ℹ️ Daily processing now happens at 12:30 AM IST via master cron');
      
      // Close database connection
      await sequelize.close();
      
      console.log('Referral cron jobs check completed');
      process.exit(0);
  } catch (error) {
      console.error('Error in referral cron check:', error);
      process.exit(1);
  }
};

// UPDATE module.exports to remove deleted functions:
module.exports = {
  runReferralCronJobs: runJobs
};