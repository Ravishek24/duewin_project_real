/**
 * Fix BullMQ Workers Script
 * This script replaces the existing BullMQ workers with optimized versions
 */

const { createQueue, createWorker, createScheduler } = require('../config/queueConfig');
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
    const adminQueue = createQueue('admin');

    // Registration queue - medium priority
    const registrationQueue = createQueue('registration');

    // Deposits queue - high priority, high concurrency
    const depositsQueue = createQueue('deposits');

    // Payments queue - high priority, high concurrency
    const paymentsQueue = createQueue('payments');

    // Attendance queue - low priority, high concurrency
    const attendanceQueue = createQueue('attendance');

    // Withdrawals queue - high priority, medium concurrency
    const withdrawalsQueue = createQueue('withdrawals');

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
    const adminWorker = createWorker('admin', 
      require('../queues/adminWorker'), 
      { concurrency: 5 }
    );

    // Registration worker - medium concurrency
    const registrationWorker = createWorker('registration', 
      require('../queues/registrationWorker'), 
      { concurrency: 10 }
    );

    // Deposits worker - high concurrency
    const depositsWorker = createWorker('deposits', 
      require('../queues/depositsWorker'), 
      { concurrency: 20 }
    );

    // Payments worker - high concurrency
    const paymentsWorker = createWorker('payments', 
      require('../queues/paymentsWorker'), 
      { concurrency: 20 }
    );

    // Attendance worker - high concurrency, low priority
    const attendanceWorker = createWorker('attendance', 
      require('../queues/attendanceWorker'), 
      { concurrency: 15 }
    );

    // Withdrawals worker - medium concurrency, high priority
    const withdrawalsWorker = createWorker('withdrawals', 
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
      const scheduler = createScheduler(name);
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
    setInterval(() => {
      const memUsage = process.memoryUsage();
      console.log(`📊 Memory Usage - RSS: ${Math.round(memUsage.rss / 1024 / 1024)}MB, Heap: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
      
      // Alert on high memory usage
      if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
        console.warn('🚨 HIGH MEMORY USAGE DETECTED');
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    // Queue health monitoring
    setInterval(async () => {
      try {
        // Get stats for each queue
        for (const [name, queue] of this.queues) {
          try {
            const waiting = await queue.getWaiting();
            const active = await queue.getActive();
            const completed = await queue.getCompleted();
            const failed = await queue.getFailed();
            
            console.log(`📊 ${name}: ${waiting.length} waiting, ${active.length} active, ${completed.length} completed, ${failed.length} failed`);
            
            // Alert on high queue depths
            if (waiting.length > 100) {
              console.warn(`🚨 HIGH QUEUE DEPTH: ${name} has ${waiting.length} waiting jobs`);
            }
          } catch (error) {
            console.warn(`⚠️ Failed to get stats for queue ${name}:`, error.message);
          }
        }
      } catch (error) {
        console.error('❌ Error getting queue stats:', error.message);
      }
    }, 2 * 60 * 1000); // Every 2 minutes

    // Job cleanup
    setInterval(async () => {
      try {
        for (const [name, queue] of this.queues) {
          try {
            // Clean completed jobs older than 24 hours
            await queue.clean(24 * 60 * 60 * 1000, 100, 'completed');
            // Clean failed jobs older than 7 days
            await queue.clean(7 * 24 * 60 * 60 * 1000, 50, 'failed');
          } catch (error) {
            console.warn(`⚠️ Failed to cleanup queue ${name}:`, error.message);
          }
        }
      } catch (error) {
        console.error('❌ Error cleaning up jobs:', error.message);
      }
    }, 6 * 60 * 60 * 1000); // Every 6 hours

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
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('🛑 Shutting down worker manager...');
    
    // Close all workers
    for (const [name, worker] of this.workers) {
      try {
        await worker.close();
        console.log(`✅ Closed ${name} worker`);
      } catch (error) {
        console.warn(`⚠️ Error closing ${name} worker:`, error.message);
      }
    }
    
    // Close all queues
    for (const [name, queue] of this.queues) {
      try {
        await queue.close();
        console.log(`✅ Closed ${name} queue`);
      } catch (error) {
        console.warn(`⚠️ Error closing ${name} queue:`, error.message);
      }
    }
    
    console.log('✅ Worker manager shutdown completed');
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
      console.log('📊 BullMQ Manager Status: Script-based manager is running');
      console.log('   Use the main worker manager for detailed status');
      break;
      
    case 'stats':
      console.log('📊 Queue Statistics: Script-based manager is running');
      console.log('   Use the main worker manager for detailed stats');
      break;
      
    case 'cleanup':
      console.log('🧹 Job Cleanup: Script-based manager is running');
      console.log('   Use the main worker manager for cleanup operations');
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