// Backend/scripts/runDailyRebateCron.js
const { processDailyRebates, initializeDatabaseForCron } = require('./masterCronJobs');
const unifiedRedis = require('../config/unifiedRedisManager');

(async () => {
  try {
    await initializeDatabaseForCron();
    await unifiedRedis.initialize(); // Ensure Redis is initialized
    await processDailyRebates();
    console.log('✅ Manual daily rebate cron run completed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error running daily rebate cron manually:', err);
    process.exit(1);
  }
})(); 