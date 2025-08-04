/**
 * Fix BullMQ Workers Script
 * This script replaces the existing BullMQ workers with optimized versions
 */

const fixedBullMQManager = require('../fixes/bullmq-connection-fix');
const path = require('path');

/**
 * Enhanced Worker Manager with Connection Pooling
 */
class FixedWorkerManager {
  constructor() {
    this.workers = new Map();
    this.queues = new Map();
    this.schedulers = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize all workers with optimized configuration
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('⚠️ Worker manager already initialized');
      return;
    }

    console.log('🔄 Initializing Fixed Worker Manager...');

    try {
      // Create queues with optimized settings
      await this.createQueues();
      
      // Create workers with optimized settings
      await this.createWorkers();
      
      // Create schedulers
      await this.createSchedulers();
      
      // Setup monitoring
      this.setupMonitoring();
      
      this.isInitialized = true;
      console.log('✅ Fixed Worker Manager initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize worker manager:', error);
      throw error;
    }
  }

  /**
   * Create optimized queues
   */
  async createQueues() {
    console.log('📋 Creating optimized queues...');

    // Admin queue - high priority, low concurrency
    const adminQueue = fixedBullMQManager.createQueue('admin', {
      defaultJobOptions: {
        priority: 1,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
      }
    });

    // Registration queue - medium priority
    const registrationQueue = fixedBullMQManager.createQueue('registration', {
      defaultJobOptions: {
        priority: 2,
        attempts: 3,
        backoff: { type: 'exponential', delay: 1000 }
      }
    });

    // Deposits queue - high priority, high concurrency
    const depositsQueue = fixedBullMQManager.createQueue('deposits', {
      defaultJobOptions: {
        priority: 1,
        attempts: 5,
        backoff: { type: 'exponential', delay: 3000 }
      }
    });

    // Payments queue - high priority, high concurrency
    const paymentsQueue = fixedBullMQManager.createQueue('payments', {
      defaultJobOptions: {
        priority: 1,
        attempts: 5,
        backoff: { type: 'exponential', delay: 3000 }
      }
    });

    // Attendance queue - low priority, high concurrency
    const attendanceQueue = fixedBullMQManager.createQueue('attendance', {
      defaultJobOptions: {
        priority: 5,
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 }
      }
    });

    // Withdrawals queue - high priority, medium concurrency
    const withdrawalsQueue = fixedBullMQManager.createQueue('withdrawals', {
      defaultJobOptions: {
        priority: 1,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 }
      }
    });

    // Store queues
    this.queues.set('admin', adminQueue);
    this.queues.set('registration', registrationQueue);
    this.queues.set('deposits', depositsQueue);
    this.queues.set('payments', paymentsQueue);
    this.queues.set('attendance', attendanceQueue);
    this.queues.set('withdrawals', withdrawalsQueue);

    console.log('✅ Created 6 optimized queues');
  }

  /**
   * Create optimized workers
   */
  async createWorkers() {
    console.log('👷 Creating optimized workers...');

    // Admin worker - low concurrency, high priority
    const adminWorker = fixedBullMQManager.createWorker('admin', 
      require('../queues/adminWorker'), 
      { concurrency: 5 }
    );

    // Registration worker - medium concurrency
    const registrationWorker = fixedBullMQManager.createWorker('registration', 
      require('../queues/registrationWorker'), 
      { concurrency: 10 }
    );

    // Deposits worker - high concurrency
    const depositsWorker = fixedBullMQManager.createWorker('deposits', 
      require('../queues/depositsWorker'), 
      { concurrency: 20 }
    );

    // Payments worker - high concurrency
    const paymentsWorker = fixedBullMQManager.createWorker('payments', 
      require('../queues/paymentsWorker'), 
      { concurrency: 20 }
    );

    // Attendance worker - high concurrency, low priority
    const attendanceWorker = fixedBullMQManager.createWorker('attendance', 
      require('../queues/attendanceWorker'), 
      { concurrency: 15 }
    );

    // Withdrawals worker - medium concurrency, high priority
    const withdrawalsWorker = fixedBullMQManager.createWorker('withdrawals', 
      require('../queues/withdrawalsWorker'), 
      { concurrency: 10 }
    );

    // Store workers
    this.workers.set('admin', adminWorker);
    this.workers.set('registration', registrationWorker);
    this.workers.set('deposits', depositsWorker);
    this.workers.set('payments', paymentsWorker);
    this.workers.set('attendance', attendanceWorker);
    this.workers.set('withdrawals', withdrawalsWorker);

    console.log('✅ Created 6 optimized workers');
  }

  /**
   * Create schedulers for each queue
   */
  async createSchedulers() {
    console.log('⏰ Creating schedulers...');

    for (const [name, queue] of this.queues) {
      const scheduler = fixedBullMQManager.createScheduler(name);
      this.schedulers.set(name, scheduler);
    }

    console.log('✅ Created schedulers for all queues');
  }

  /**
   * Setup monitoring and cleanup
   */
  setupMonitoring() {
    console.log('📊 Setting up monitoring...');

    // Memory monitoring
    fixedBullMQManager.addManagedInterval(() => {
      const memUsage = process.memoryUsage();
      console.log(`📊 Memory Usage - RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
      
      // Alert on high memory usage
      if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
        console.warn('🚨 HIGH MEMORY USAGE DETECTED');
      }
    }, 5 * 60 * 1000, 'memory-monitor'); // Every 5 minutes

    // Queue health monitoring
    fixedBullMQManager.addManagedInterval(async () => {
      try {
        const stats = await fixedBullMQManager.getAllStats();
        console.log('📊 Queue Stats:', stats);
        
        // Alert on high queue depths
        for (const stat of stats) {
          if (stat.waiting > 100) {
            console.warn(`🚨 HIGH QUEUE DEPTH: ${stat.name} has ${stat.waiting} waiting jobs`);
          }
        }
      } catch (error) {
        console.error('❌ Error getting queue stats:', error.message);
      }
    }, 2 * 60 * 1000, 'queue-monitor'); // Every 2 minutes

    // Job cleanup
    fixedBullMQManager.addManagedInterval(async () => {
      try {
        for (const [name] of this.queues) {
          await fixedBullMQManager.cleanupJobs(name, 24 * 60 * 60 * 1000); // 24 hours
        }
      } catch (error) {
        console.error('❌ Error cleaning up jobs:', error.message);
      }
    }, 6 * 60 * 60 * 1000, 'job-cleanup'); // Every 6 hours

    console.log('✅ Monitoring setup completed');
  }

  /**
   * Get worker status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      queues: this.queues.size,
      workers: this.workers.size,
      schedulers: this.schedulers.size,
      managerStatus: fixedBullMQManager.getStatus()
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🛑 Shutting down worker manager...');
    
    // The fixedBullMQManager will handle the actual shutdown
    // This is just for logging
    console.log('✅ Worker manager shutdown initiated');
  }
}

/**
 * Main function
 */
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'start':
      const workerManager = new FixedWorkerManager();
      await workerManager.initialize();
      
      // Keep the process alive
      process.on('SIGINT', async () => {
        console.log('🛑 Received SIGINT, shutting down...');
        await workerManager.shutdown();
        process.exit(0);
      });
      
      console.log('🚀 Fixed BullMQ workers started successfully');
      break;
      
    case 'status':
      const status = fixedBullMQManager.getStatus();
      console.log('📊 BullMQ Manager Status:', status);
      break;
      
    case 'stats':
      try {
        const stats = await fixedBullMQManager.getAllStats();
        console.log('📊 Queue Statistics:', stats);
      } catch (error) {
        console.error('❌ Error getting stats:', error.message);
      }
      break;
      
    case 'cleanup':
      try {
        const queues = ['admin', 'registration', 'deposits', 'payments', 'attendance', 'withdrawals'];
        for (const queueName of queues) {
          await fixedBullMQManager.cleanupJobs(queueName);
        }
        console.log('✅ Job cleanup completed');
      } catch (error) {
        console.error('❌ Error during cleanup:', error.message);
      }
      break;
      
    default:
      console.log('Usage:');
      console.log('  node scripts/fix-bullmq-workers.js start    - Start optimized workers');
      console.log('  node scripts/fix-bullmq-workers.js status   - Show manager status');
      console.log('  node scripts/fix-bullmq-workers.js stats    - Show queue statistics');
      console.log('  node scripts/fix-bullmq-workers.js cleanup  - Clean up old jobs');
      break;
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}

module.exports = FixedWorkerManager; 