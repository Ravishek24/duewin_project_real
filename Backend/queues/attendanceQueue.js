const { Queue } = require('bullmq');
const getQueueConnections = require('../config/queueConfig');

// Lazy queue creation - only create when needed
let attendanceQueue = null;

function getAttendanceQueue() {
  if (!attendanceQueue) {
    const queueConnections = getQueueConnections();
    attendanceQueue = new Queue('attendance', { connection: queueConnections.attendance });
  }
  return attendanceQueue;
}

module.exports = { getAttendanceQueue }; 