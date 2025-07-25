const { Queue } = require('bullmq');
const getQueueConnections = require('../config/queueConfig');
const queueConnections = getQueueConnections();

const paymentQueue = new Queue('payments', { connection: queueConnections.payments });

module.exports = paymentQueue; 