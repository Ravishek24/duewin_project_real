const { Queue } = require('bullmq');
const unifiedRedis = require('../config/unifiedRedisManager');

// Lazy queue creation - only create when needed
let adminQueue = null;

function getAdminQueue() {
  if (!adminQueue) {
    const connection = unifiedRedis.getConnectionSync('main');
    adminQueue = new Queue('admin', { connection });
  }
  return adminQueue;
}

module.exports = { getAdminQueue }; 