const { initializeWorkerModels } = require('./workerInit');
const queueConnections = require('../config/queueConfig');

console.log('🚀 Starting Enhanced BullMQ Worker Manager...');
console.log('==================================================');

// Initialize models first
initializeWorkerModels().then(() => {
  console.log('✅ Worker models initialized');
  
  // Now start workers
  const attendanceWorker = require('../queues/attendanceWorker');
  const registrationWorker = require('../queues/registrationWorker');
  
  const workers = {
    attendance: attendanceWorker,
    registration: registrationWorker
  };
  
  console.log('📋 Active Workers:');
  console.log('   - Attendance Worker');
  console.log('   - Registration Worker');
  console.log('');
  
  // Health monitoring
  const monitorWorkerHealth = () => {
    setInterval(async () => {
      try {
        const { Queue } = require('bullmq');
        
        for (const [name, connection] of Object.entries(queueConnections)) {
          if (name === 'notifications' || name === 'deadLetter') continue; // Skip unused queues
          
          const queue = new Queue(name, { connection });
          
          const [waiting, active, completed, failed] = await Promise.all([
            queue.getWaiting(),
            queue.getActive(),
            queue.getCompleted(0, 0),
            queue.getFailed(0, 0)
          ]);
          
          console.log(`📊 ${name} Queue: ${waiting.length} waiting, ${active.length} active, ${completed.length} completed, ${failed.length} failed`);
          
          // Alert on backlog
          if (waiting.length > 50) {
            console.error(`🚨 HIGH BACKLOG: ${name} queue has ${waiting.length} waiting jobs`);
          }
          
          // Alert on high failure rate
          if (failed.length > completed.length * 0.1) {
            console.error(`🚨 HIGH FAILURE RATE: ${name} queue has ${failed.length} failed jobs`);
          }
        }
      } catch (error) {
        console.error('Health monitoring failed:', error);
      }
    }, 30000); // Check every 30 seconds
  };
  
  // Start health monitoring after 10 seconds
  setTimeout(() => {
    console.log('🔍 Starting queue health monitoring...');
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
  
  console.log('✅ Enhanced Worker Manager Started Successfully!');
  console.log('💡 Press Ctrl+C to stop all workers gracefully');
  console.log('==================================================');
  
}).catch(error => {
  console.error('❌ Failed to initialize worker models:', error);
  process.exit(1);
}); 