const { Queue } = require('bullmq');
const unifiedRedis = require('../config/unifiedRedisManager');

// Lazy queue creation - only create when needed
let attendanceQueue = null;

function getAttendanceQueue() {
  if (!attendanceQueue) {
    // Prefer sync connection to avoid awaiting in module scope
    const connection = unifiedRedis.getConnectionSync('main');
    if (!connection) {
      // Fallback to async initialize path (callers should ensure initialize happens early)
      attendanceQueue = new Queue('attendance', { connection: undefined });
    } else {
      attendanceQueue = new Queue('attendance', { connection });
    }
  }
  return attendanceQueue;
}

module.exports = { getAttendanceQueue }; 