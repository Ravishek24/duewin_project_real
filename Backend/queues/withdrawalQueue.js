const { Queue } = require('bullmq');
const getQueueConnections = require('../config/queueConfig');

// Lazy queue creation - only create when needed
let withdrawalQueue = null;

function getWithdrawalQueue() {
  if (!withdrawalQueue) {
    const queueConnections = getQueueConnections();
    withdrawalQueue = new Queue('withdrawals', { connection: queueConnections.withdrawals });
  }
  return withdrawalQueue;
}

module.exports = { getWithdrawalQueue }; 