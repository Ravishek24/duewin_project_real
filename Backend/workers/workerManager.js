const attendanceWorker = require('../queues/attendanceWorker');
const registrationWorker = require('../queues/registrationWorker');

console.log('🚀 Starting BullMQ Worker Manager...');
console.log('=' .repeat(50));

// Track active workers
const workers = {
    attendance: attendanceWorker,
    registration: registrationWorker
};

// Graceful shutdown handler
const gracefulShutdown = (signal) => {
    console.log(`\n🛑 Received ${signal}. Shutting down workers gracefully...`);
    
    // Close all workers
    Object.entries(workers).forEach(([name, worker]) => {
        if (worker && typeof worker.close === 'function') {
            console.log(`📴 Closing ${name} worker...`);
            worker.close();
        }
    });
    
    console.log('✅ All workers closed. Exiting...');
    process.exit(0);
};

// Handle different shutdown signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
});

console.log('✅ Worker Manager Started Successfully!');
console.log('📋 Active Workers:');
console.log('   - Attendance Worker');
console.log('   - Registration Worker');
console.log('');
console.log('💡 Press Ctrl+C to stop all workers gracefully');
console.log('=' .repeat(50));

// Keep the process alive
process.stdin.resume(); 