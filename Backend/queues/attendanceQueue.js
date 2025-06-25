const { Queue } = require('bullmq');

const connection = {
  host: '127.0.0.1',
  port: 6379,
  db: 0
};

const attendanceQueue = new Queue('attendance', { connection });

module.exports = attendanceQueue; 