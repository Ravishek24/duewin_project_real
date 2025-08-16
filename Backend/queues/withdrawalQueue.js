const { Queue } = require('bullmq');
const unifiedRedis = require('../config/unifiedRedisManager');

// Lazy queue creation - only create when needed
let withdrawalQueue = null;

function getWithdrawalQueue() {
  if (!withdrawalQueue) {
    const connection = unifiedRedis.getConnectionSync('main');
    withdrawalQueue = new Queue('withdrawals', { connection });
  }
  return withdrawalQueue;
}

module.exports = { getWithdrawalQueue }; 