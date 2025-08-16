const { Queue } = require('bullmq');
const unifiedRedis = require('../config/unifiedRedisManager');

// Lazy queue creation - only create when needed
let depositQueue = null;

function getDepositQueue() {
  if (!depositQueue) {
    const connection = unifiedRedis.getConnectionSync('main');
    depositQueue = new Queue('deposits', { connection });
  }
  return depositQueue;
}

module.exports = { getDepositQueue }; 