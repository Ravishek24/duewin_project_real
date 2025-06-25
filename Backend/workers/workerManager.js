const { initializeWorkerModels } = require('./workerInit');
const queueConnections = require('../config/queueConfig');

console.log('🚀 Starting Enhanced BullMQ Worker Manager...');
console.log('==================================================');

// Initialize models first
initializeWorkerModels().then(() => {
  console.log('✅ Worker models initialized');
  
  // Now start all workers
  const attendanceWorker = require('../queues/attendanceWorker');
  const registrationWorker = require('../queues/registrationWorker');
  const depositWorker = require('../queues/depositWorker');
  const withdrawalWorker = require('../queues/withdrawalWorker');
  const paymentWorker = require('../queues/paymentWorker');
  const adminWorker = require('../queues/adminWorker');
  
  const workers = {
    attendance: attendanceWorker,
    registration: registrationWorker,
    deposits: depositWorker,
    withdrawals: withdrawalWorker,
    payments: paymentWorker,
    admin: adminWorker
  };
  
  console.log('📋 Active Workers:');
  console.log('   - Attendance Worker');
  console.log('   - Registration Worker');
  console.log('   - Deposit Worker');
  console.log('   - Withdrawal Worker');
  console.log('   - Payment Worker');
  console.log('   - Admin Worker');
  console.log('');
  
  // Enhanced health monitoring
  const monitorWorkerHealth = () => {
    setInterval(async () => {
      try {
        const { Queue } = require('bullmq');
        
        console.log('📊 Queue Health Status:');
        console.log('=======================');
        
        for (const [name, connection] of Object.entries(queueConnections)) {
          if (name === 'notifications' || name === 'deadLetter') continue; // Skip unused queues
          
          const queue = new Queue(name, { connection });
          
          const [waiting, active, completed, failed] = await Promise.all([
            queue.getWaiting(),
            queue.getActive(),
            queue.getCompleted(0, 0),
            queue.getFailed(0, 0)
          ]);
          
          const status = waiting.length > 50 ? '🚨' : waiting.length > 20 ? '⚠️' : '✅';
          console.log(`${status} ${name}: ${waiting.length} waiting, ${active.length} active, ${completed.length} completed, ${failed.length} failed`);
          
          // Alert on backlog
          if (waiting.length > 50) {
            console.error(`🚨 HIGH BACKLOG: ${name} queue has ${waiting.length} waiting jobs`);
          }
          
          // Alert on high failure rate
          if (failed.length > completed.length * 0.1) {
            console.error(`🚨 HIGH FAILURE RATE: ${name} queue has ${failed.length} failed jobs`);
          }
          
          // Alert on stalled jobs
          if (active.length > 0) {
            console.warn(`⚠️ ${name} queue has ${active.length} active jobs`);
          }
        }
        
        console.log('=======================');
        
      } catch (error) {
        console.error('Health monitoring failed:', error);
      }
    }, 30000); // Check every 30 seconds
  };
  
  // Start health monitoring after 10 seconds
  setTimeout(() => {
    console.log('🔍 Starting enhanced queue health monitoring...');
    monitorWorkerHealth();
  }, 10000);
  
  // Enhanced graceful shutdown
  const gracefulShutdown = async (signal) => {
    console.log(`🛑 Received ${signal}. Shutting down workers gracefully...`);
    
    const shutdownPromises = Object.entries(workers).map(([name, worker]) => {
      return new Promise((resolve) => {
        console.log(`⏸️ Stopping ${name} worker...`);
        
        const timeout = setTimeout(() => {
          console.log(`⏰ Force closing ${name} worker (timeout)`);
          worker.close();
          resolve();
        }, 30000);
        
        worker.close().then(() => {
          clearTimeout(timeout);
          console.log(`✅ ${name} worker closed gracefully`);
          resolve();
        }).catch(() => {
          clearTimeout(timeout);
          console.log(`❌ ${name} worker force closed`);
          resolve();
        });
      });
    });
    
    await Promise.all(shutdownPromises);
    console.log('✅ All workers shut down. Exiting...');
    process.exit(0);
  };
  
  // Signal handlers
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  
  // Periodic memory usage logging
  setInterval(() => {
    const used = process.memoryUsage();
    console.log('🧠 Memory Usage:', {
      rss: Math.round(used.rss / 1024 / 1024 * 100) / 100 + ' MB',
      heapTotal: Math.round(used.heapTotal / 1024 / 1024 * 100) / 100 + ' MB',
      heapUsed: Math.round(used.heapUsed / 1024 / 1024 * 100) / 100 + ' MB'
    });
  }, 30000);
  
  console.log('✅ Enhanced Worker Manager Started Successfully!');
  console.log('💡 Press Ctrl+C to stop all workers gracefully');
  console.log('==================================================');
  
}).catch(error => {
  console.error('❌ Failed to initialize worker models:', error);
  process.exit(1);
}); 