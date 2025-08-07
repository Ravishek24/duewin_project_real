const { Queue } = require('bullmq');
const getQueueConnections = require('../config/queueConfig');

// Lazy queue creation - only create when needed
let paymentQueue = null;

function getPaymentQueue() {
  if (!paymentQueue) {
    const queueConnections = getQueueConnections();
    paymentQueue = new Queue('payments', { connection: queueConnections.payments });
  }
  return paymentQueue;
}

module.exports = { getPaymentQueue }; 