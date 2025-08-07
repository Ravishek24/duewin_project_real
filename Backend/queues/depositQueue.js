const { Queue } = require('bullmq');
const getQueueConnections = require('../config/queueConfig');

// Lazy queue creation - only create when needed
let depositQueue = null;

function getDepositQueue() {
  if (!depositQueue) {
    const queueConnections = getQueueConnections();
    depositQueue = new Queue('deposits', { connection: queueConnections.deposits });
  }
  return depositQueue;
}

module.exports = { getDepositQueue }; 