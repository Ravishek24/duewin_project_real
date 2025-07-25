// Backend/scripts/runAttendanceBonusCron.js
const { processAttendanceBonuses, initializeDatabaseForCron } = require('./masterCronJobs');
const unifiedRedis = require('../config/unifiedRedisManager');
const moment = require('moment-timezone');

(async () => {
  try {
    await initializeDatabaseForCron();
    await unifiedRedis.initialize(); // Ensure Redis is initialized
    // Remove hardcoded date, use today's date
    await processAttendanceBonuses();
    console.log('✅ Manual attendance bonus cron run completed');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error running attendance bonus cron manually:', err);
    process.exit(1);
  }
})(); 