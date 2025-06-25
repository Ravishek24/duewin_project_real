const { Queue } = require('bullmq');
const queueConnections = require('../config/queueConfig');

const attendanceQueue = new Queue('attendance', { 
  connection: queueConnections.attendance 
});

module.exports = attendanceQueue; 