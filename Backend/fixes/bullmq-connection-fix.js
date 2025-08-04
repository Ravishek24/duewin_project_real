/**
 * BullMQ Connection & Memory Leak Fix
 * This fixes the critical connection leaks and memory issues in BullMQ workers
 */

const { Queue, Worker, QueueScheduler } = require('bullmq');
const Redis = require('ioredis');

/**
 * Enhanced BullMQ Configuration with Connection Pooling
 */
class FixedBullMQManager {
  constructor() {
    this.queues = new Map();
    this.workers = new Map();
    this.schedulers = new Map();
    this.intervals = new Set();
    this.isShuttingDown = false;
    
    // Shared Redis connection for all queues
    this.redisConnection = this.createRedisConnection();
    
    // Default queue configuration
    this.defaultConfig = {
      connection: this.redisConnection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
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
      }
    };
    
    this.setupGracefulShutdown();
  }

  /**
   * Create optimized Redis connection for BullMQ
   */
  createRedisConnection() {
    const config = {
      host: process.env.REDIS_HOST?.trim(),
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || '',
      db: process.env.REDIS_DB || 0,
      
      // TLS configuration for ElastiCache
      tls: {
        rejectUnauthorized: false,
        requestCert: true,
        agent: false
      },
      
      // Connection optimization
      family: 4,
      keepAlive: 30000,
      connectTimeout: 15000,
      commandTimeout: 30000,
      
      // CRITICAL FIX: Prevent connection leaks
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
      
      // Retry strategy
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      
      // Connection pooling
      lazyConnect: false,
      maxRetriesPerRequest: 3,
      
      // Event handlers
      reconnectOnError: (err) => {
        const targetError = 'READONLY';
        if (err.message.includes(targetError)) {
          return true;
        }
        return false;
      }
    };

    const connection = new Redis(config);
    
    // Enhanced event handlers
    connection.on('connect', () => {
      console.log('✅ BullMQ Redis connected');
    });

    connection.on('ready', () => {
      console.log('✅ BullMQ Redis ready');
    });

    connection.on('error', (error) => {
      console.error('❌ BullMQ Redis error:', error.message);
    });

    connection.on('close', () => {
      console.log('🔌 BullMQ Redis closed');
    });

    connection.on('reconnecting', () => {
      console.log('🔄 BullMQ Redis reconnecting');
    });

    return connection;
  }

  /**
   * Create queue with optimized configuration
   */
  createQueue(name, config = {}) {
    if (this.queues.has(name)) {
      console.warn(`⚠️ Queue ${name} already exists`);
      return this.queues.get(name);
    }

    const queueConfig = {
      ...this.defaultConfig,
      ...config,
      connection: this.redisConnection
    };

    const queue = new Queue(name, queueConfig);
    
    // Add queue event handlers
    queue.on('error', (error) => {
      console.error(`❌ Queue ${name} error:`, error.message);
    });

    queue.on('waiting', (job) => {
      console.log(`⏳ Queue ${name}: Job ${job.id} waiting`);
    });

    queue.on('active', (job) => {
      console.log(`🔄 Queue ${name}: Job ${job.id} active`);
    });

    queue.on('completed', (job) => {
      console.log(`✅ Queue ${name}: Job ${job.id} completed`);
    });

    queue.on('failed', (job, err) => {
      console.error(`❌ Queue ${name}: Job ${job.id} failed:`, err.message);
    });

    this.queues.set(name, queue);
    console.log(`✅ Created queue: ${name}`);
    
    return queue;
  }

  /**
   * Create worker with optimized configuration
   */
  createWorker(name, processor, config = {}) {
    if (this.workers.has(name)) {
      console.warn(`⚠️ Worker ${name} already exists`);
      return this.workers.get(name);
    }

    const workerConfig = {
      connection: this.redisConnection,
      concurrency: config.concurrency || 10,
      removeOnComplete: 100,
      removeOnFail: 50,
      stalledInterval: 30000,
      maxStalledCount: 1,
      lockDuration: 30000,
      retryProcessDelay: 5000,
      ...config
    };

    const worker = new Worker(name, processor, workerConfig);
    
    // Add worker event handlers
    worker.on('error', (error) => {
      console.error(`❌ Worker ${name} error:`, error.message);
    });

    worker.on('failed', (job, err) => {
      console.error(`❌ Worker ${name}: Job ${job.id} failed:`, err.message);
    });

    worker.on('completed', (job) => {
      console.log(`✅ Worker ${name}: Job ${job.id} completed`);
    });

    worker.on('stalled', (jobId) => {
      console.warn(`⚠️ Worker ${name}: Job ${jobId} stalled`);
    });

    this.workers.set(name, worker);
    console.log(`✅ Created worker: ${name} (concurrency: ${workerConfig.concurrency})`);
    
    return worker;
  }

  /**
   * Create scheduler with optimized configuration
   */
  createScheduler(name, config = {}) {
    if (this.schedulers.has(name)) {
      console.warn(`⚠️ Scheduler ${name} already exists`);
      return this.schedulers.get(name);
    }

    const schedulerConfig = {
      connection: this.redisConnection,
      stalledInterval: 30000,
      maxStalledCount: 1,
      ...config
    };

    const scheduler = new QueueScheduler(name, schedulerConfig);
    
    scheduler.on('error', (error) => {
      console.error(`❌ Scheduler ${name} error:`, error.message);
    });

    scheduler.on('stalled', (jobId) => {
      console.warn(`⚠️ Scheduler ${name}: Job ${jobId} stalled`);
    });

    this.schedulers.set(name, scheduler);
    console.log(`✅ Created scheduler: ${name}`);
    
    return scheduler;
  }

  /**
   * Add managed interval (prevents memory leaks)
   */
  addManagedInterval(callback, delay, name = 'unnamed') {
    const interval = setInterval(callback, delay);
    this.intervals.add({ interval, name, callback, delay });
    console.log(`⏰ Added managed interval: ${name} (${delay}ms)`);
    return interval;
  }

  /**
   * Clear managed interval
   */
  clearManagedInterval(name) {
    for (const item of this.intervals) {
      if (item.name === name) {
        clearInterval(item.interval);
        this.intervals.delete(item);
        console.log(`🧹 Cleared managed interval: ${name}`);
        return true;
      }
    }
    return false;
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed()
    ]);

    return {
      name: queueName,
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      total: waiting.length + active.length + completed.length + failed.length + delayed.length
    };
  }

  /**
   * Get all queue statistics
   */
  async getAllStats() {
    const stats = [];
    for (const [name] of this.queues) {
      try {
        const queueStats = await this.getQueueStats(name);
        stats.push(queueStats);
      } catch (error) {
        console.error(`❌ Error getting stats for queue ${name}:`, error.message);
      }
    }
    return stats;
  }

  /**
   * Clean up completed and failed jobs
   */
  async cleanupJobs(queueName, maxAge = 24 * 60 * 60 * 1000) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    try {
      const [completedCount, failedCount] = await Promise.all([
        queue.clean(maxAge, 100, 'completed'),
        queue.clean(maxAge, 100, 'failed')
      ]);

      console.log(`🧹 Cleaned up ${completedCount} completed and ${failedCount} failed jobs from ${queueName}`);
      return { completedCount, failedCount };
    } catch (error) {
      console.error(`❌ Error cleaning up jobs for queue ${queueName}:`, error.message);
      throw error;
    }
  }

  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    const cleanup = async (signal) => {
      if (this.isShuttingDown) {
        return;
      }
      
      this.isShuttingDown = true;
      console.log(`🛑 Received ${signal}, shutting down BullMQ gracefully...`);

      // Clear all managed intervals
      for (const item of this.intervals) {
        clearInterval(item.interval);
        console.log(`🧹 Cleared interval: ${item.name}`);
      }
      this.intervals.clear();

      // Close all workers
      const workerPromises = [];
      for (const [name, worker] of this.workers) {
        console.log(`🔌 Closing worker: ${name}`);
        workerPromises.push(worker.close());
      }

      // Close all schedulers
      const schedulerPromises = [];
      for (const [name, scheduler] of this.schedulers) {
        console.log(`🔌 Closing scheduler: ${name}`);
        schedulerPromises.push(scheduler.close());
      }

      // Close all queues
      const queuePromises = [];
      for (const [name, queue] of this.queues) {
        console.log(`🔌 Closing queue: ${name}`);
        queuePromises.push(queue.close());
      }

      try {
        await Promise.allSettled([
          ...workerPromises,
          ...schedulerPromises,
          ...queuePromises
        ]);
        
        // Close Redis connection
        if (this.redisConnection) {
          await this.redisConnection.quit();
          console.log('🔌 BullMQ Redis connection closed');
        }

        console.log('✅ BullMQ shutdown completed');
      } catch (error) {
        console.error('❌ Error during BullMQ shutdown:', error.message);
      }

      process.exit(0);
    };

    process.on('SIGINT', () => cleanup('SIGINT'));
    process.on('SIGTERM', () => cleanup('SIGTERM'));
    process.on('SIGQUIT', () => cleanup('SIGQUIT'));
  }

  /**
   * Get manager status
   */
  getStatus() {
    return {
      queues: this.queues.size,
      workers: this.workers.size,
      schedulers: this.schedulers.size,
      intervals: this.intervals.size,
      isShuttingDown: this.isShuttingDown,
      redisStatus: this.redisConnection.status
    };
  }
}

// Create singleton instance
const fixedBullMQManager = new FixedBullMQManager();

module.exports = fixedBullMQManager; 