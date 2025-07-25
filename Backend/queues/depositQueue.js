const { Queue } = require('bullmq');
const getQueueConnections = require('../config/queueConfig');
const queueConnections = getQueueConnections();

const depositQueue = new Queue('deposits', { connection: queueConnections.deposits });

module.exports = depositQueue; 