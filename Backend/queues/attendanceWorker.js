const { Worker } = require('bullmq');
const { getModels } = require('../models');
const moment = require('moment-timezone');

const connection = {
  host: '127.0.0.1',
  port: 6379,
  db: 0
};

const worker = new Worker('attendance', async job => {
  const { userId } = job.data;
  try {
    // Get models dynamically to ensure they're properly initialized
    const models = await getModels();
    const { User, AttendanceRecord } = models;
    
    // Process attendance directly in the worker
    await processAttendanceForUser(userId, User, AttendanceRecord);
    console.log(`[BullMQ] Attendance processed for user ${userId}`);
  } catch (err) {
    console.error(`[BullMQ] Attendance job failed for user ${userId}:`, err.message);
    throw err;
  }
}, { connection });

// Custom attendance processing function
async function processAttendanceForUser(userId, User, AttendanceRecord) {
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

    // Find today's attendance record
    const attendanceRecord = await AttendanceRecord.findOne({
      where: {
        user_id: userId,
        attendance_date: today
      }
    });

    if (!attendanceRecord) {
      console.log(`[BullMQ] No attendance record found for user ${userId} on ${today}`);
      return;
    }

    // Update attendance record if user logged in today
    if (hasLoggedInToday && !attendanceRecord.has_logged_in_today) {
      await attendanceRecord.update({
        has_logged_in_today: true,
        updated_at: new Date()
      });
      console.log(`[BullMQ] Updated attendance record for user ${userId} - logged in today`);
    }

  } catch (error) {
    console.error(`[BullMQ] Error processing attendance for user ${userId}:`, error.message);
    throw error;
  }
}

worker.on('completed', job => {
  console.log(`[BullMQ] Attendance job completed:`, job.id);
});

worker.on('failed', (job, err) => {
  console.error(`[BullMQ] Attendance job failed:`, job.id, err.message);
});

module.exports = worker; 