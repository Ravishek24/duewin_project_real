const { Queue } = require('bullmq');
const getQueueConnections = require('../config/queueConfig');
const queueConnections = getQueueConnections();

const adminQueue = new Queue('admin', { connection: queueConnections.admin });

module.exports = adminQueue; 