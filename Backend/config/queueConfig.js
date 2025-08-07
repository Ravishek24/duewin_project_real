// config/queueConfig.js - Unified Redis connection manager (Lazy Loading)
const unifiedRedis = require('./unifiedRedisManager');

function getQueueConnections() {
  // Use the unified Redis manager for all queue connections
  // This is now lazy-loaded - connections are only retrieved when this function is called
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