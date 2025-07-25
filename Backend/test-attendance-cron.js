const unifiedRedis = require('./config/unifiedRedisManager');
(async () => {
  await unifiedRedis.initialize();

  const { autoRecordDailyAttendance, processAttendanceBonuses, getDatabaseInstances } = require('./scripts/masterCronJobs');
  const moment = require('moment-timezone');

  const today = moment.tz('Asia/Kolkata').format('YYYY-MM-DD');
  const { sequelize, models } = await getDatabaseInstances();
  const User = models.User;
  const AttendanceRecord = models.AttendanceRecord;

  // Set your test user here
  const testUser = await User.findOne({ where: { user_id: 97 } });
  if (!testUser) {
    console.error('❌ Test user with user_id 96 not found!');
    process.exit(1);
  }

  // 2. Run autoRecordDailyAttendance
  await autoRecordDailyAttendance();
  // 3. Check if attendance record for today exists
  let attendance = await AttendanceRecord.findOne({ where: { user_id: testUser.user_id, attendance_date: today } });
  if (attendance) {
    console.log('✅ Attendance record created for today.');
  } else {
    console.error('❌ Attendance record NOT created!');
    process.exit(1);
  }

  // 4. Simulate recharge for test user (make eligible for bonus)
  await attendance.update({
    has_recharged: true,
    claim_eligible: true,
    bonus_amount: 50,
    bonus_claimed: false
  });
  console.log('✅ Simulated recharge for test user.');

  // 5. Run processAttendanceBonuses
  await processAttendanceBonuses();

  // 6. Check if bonus was claimed and wallet updated
  await attendance.reload();
  await testUser.reload();
  if (attendance.bonus_claimed && testUser.wallet_balance >= 50) {
    console.log('✅ Attendance bonus claimed and wallet updated!');
  } else {
    console.error('❌ Attendance bonus NOT processed correctly!');
    process.exit(1);
  }

  // 7. Clean up test data (optional: comment out if you want to keep for review)
  await attendance.destroy();
  // await testUser.destroy(); // Commented out to avoid deleting real user
  console.log('🧹 Cleaned up test attendance record.');

  console.log('🎉 Attendance cron batch test PASSED!');
  process.exit(0);
})(); 