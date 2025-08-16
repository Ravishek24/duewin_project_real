const { Queue } = require('bullmq');
const unifiedRedis = require('../config/unifiedRedisManager');

// Lazy queue creation - only create when needed
let paymentQueue = null;

function getPaymentQueue() {
  if (!paymentQueue) {
    const connection = unifiedRedis.getConnectionSync('main');
    paymentQueue = new Queue('payments', { connection });
  }
  return paymentQueue;
}

module.exports = { getPaymentQueue }; 