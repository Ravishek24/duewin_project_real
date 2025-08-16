// initialize-models-at-startup.js
// This should be called early in your server startup process

const initializeModelsAtStartup = async () => {
    console.log('🚀 Pre-initializing models at server startup...');
    const startTime = process.hrtime.bigint();
    
    try {
        // Initialize database connection first
        const { initializeDatabase } = require('./config/db');
        await initializeDatabase();
        console.log('✅ Database initialized');
        
        // Initialize models
        const { initializeModels } = require('./models');
        await initializeModels();
        console.log('✅ Models initialized');
        
        // Pre-warm other services
        const createSessionService = require('./services/sessionService');
        const { getModelsSync } = require('./models');
        const models = getModelsSync();
        
        const sessionService = createSessionService(models);
        console.log('✅ Session service initialized');
        
        // Pre-warm attendance queue
        try {
            const { getAttendanceQueue } = require('./queues/attendanceQueue');
            const attendanceQueue = getAttendanceQueue();
            console.log('✅ Attendance queue initialized');
        } catch (error) {
            console.warn('⚠️ Attendance queue initialization warning:', error.message);
        }
        
        const totalTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        console.log(`🎉 Server startup initialization completed in ${totalTime.toFixed(2)}ms`);
        
        return true;
    } catch (error) {
        const totalTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        console.error(`❌ Server startup initialization failed after ${totalTime.toFixed(2)}ms:`, error);
        throw error;
    }
};

module.exports = { initializeModelsAtStartup };