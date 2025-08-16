// config/queueConfig.js - Unified Redis connection manager with BullMQ v5 compatibility
const unifiedRedis = require('./unifiedRedisManager');
const { Queue, Worker } = require('bullmq');

// BullMQ v5 compatible configuration
const defaultQueueConfig = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    timeout: 30000, // 30 seconds timeout
  },
  settings: {
    stalledInterval: 30000,
    maxStalledCount: 1,
    lockDuration: 30000,
    retryProcessDelay: 5000,
    // BullMQ v5: use keepJobs instead of removeOnComplete/removeOnFail
    keepJobs: {
      completed: 100,
      failed: 50
    }
  }
};

const defaultWorkerConfig = {
  stalledInterval: 30000,
  maxStalledCount: 1,
  lockDuration: 30000,
  retryProcessDelay: 5000,
  // BullMQ v5: use keepJobs instead of removeOnComplete/removeOnFail
  keepJobs: {
    completed: 100,
    failed: 50
  }
};

async function getQueueConnections() {
  // Use the unified Redis manager for all queue connections
  // This is now lazy-loaded - connections are only retrieved when this function is called
  return {
    attendance: await unifiedRedis.getConnection('main'),
    registration: await unifiedRedis.getConnection('main'),
    notifications: await unifiedRedis.getConnection('main'),
    deadLetter: await unifiedRedis.getConnection('main'),
    deposits: await unifiedRedis.getConnection('main'),
    withdrawals: await unifiedRedis.getConnection('main'),
    payments: await unifiedRedis.getConnection('main'),
    admin: await unifiedRedis.getConnection('main'),
  };
}

// Create queue with BullMQ v5 compatible configuration
async function createQueue(queueName, options = {}) {
  try {
    const connection = await unifiedRedis.getConnection('main');
    
    const queue = new Queue(queueName, {
      connection,
      ...options
    });
    
    return queue;
  } catch (error) {
    throw error;
  }
}

// Create worker with BullMQ v5 compatible configuration
async function createWorker(queueName, processor, options = {}) {
  try {
    const connection = await unifiedRedis.getConnection('main');
    
    const worker = new Worker(queueName, processor, {
      connection,
      ...options
    });
    
    return worker;
  } catch (error) {
    throw error;
  }
}

module.exports = {
  getQueueConnections, // async function
  createQueue,         // async function
  createWorker,        // async function
  defaultQueueConfig,
  defaultWorkerConfig
}; 