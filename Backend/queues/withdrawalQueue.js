const { Queue } = require('bullmq');
const getQueueConnections = require('../config/queueConfig');
const queueConnections = getQueueConnections();

const withdrawalQueue = new Queue('withdrawals', { connection: queueConnections.withdrawals });

module.exports = withdrawalQueue; 