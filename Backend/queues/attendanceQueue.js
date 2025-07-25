const { Queue } = require('bullmq');
const getQueueConnections = require('../config/queueConfig');
const queueConnections = getQueueConnections();

const attendanceQueue = new Queue('attendance', { connection: queueConnections.attendance });

module.exports = attendanceQueue; 