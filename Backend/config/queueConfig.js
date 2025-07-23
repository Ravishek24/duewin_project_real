// config/queueConfig.js - Separate Redis databases to prevent deadlocks
const unifiedRedis = require('./unifiedRedisManager');

function getQueueConnections() {
  return {
    attendance: unifiedRedis.getConnection('main'),
    registration: unifiedRedis.getConnection('main'),
    notifications: unifiedRedis.getConnection('main'),
    deadLetter: unifiedRedis.getConnection('main'),
    deposits: unifiedRedis.getConnection('main'),
    withdrawals: unifiedRedis.getConnection('main'),
    payments: unifiedRedis.getConnection('main'),
    admin: unifiedRedis.getConnection('main'),
  };
}

module.exports = getQueueConnections; 