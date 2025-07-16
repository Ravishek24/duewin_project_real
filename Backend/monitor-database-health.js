const { getSequelizeInstance } = require('./config/db');
const redis = require('./config/redisConfig').redis;

async function monitorDatabaseHealth() {
    try {
        console.log('🔍 [DATABASE_MONITOR] Starting database health monitoring...');
        
        const sequelize = await getSequelizeInstance();
        
        // Get connection pool status
        const pool = sequelize.connectionManager.pool;
        console.log('📊 [DATABASE_MONITOR] Connection Pool Status:');
        console.log(`   - Total connections: ${pool.size}`);
        console.log(`   - Available connections: ${pool.available}`);
        console.log(`   - Pending connections: ${pool.pending}`);
        console.log(`   - Using connections: ${pool.using}`);
        
        // Test database connectivity
        try {
            await sequelize.authenticate();
            console.log('✅ [DATABASE_MONITOR] Database connection healthy');
        } catch (error) {
            console.error('❌ [DATABASE_MONITOR] Database connection failed:', error.message);
        }
        
        // Check for long-running queries
        try {
            const longQueries = await sequelize.query(`
                SELECT 
                    id,
                    user,
                    host,
                    db,
                    command,
                    time,
                    state,
                    info
                FROM information_schema.processlist 
                WHERE command != 'Sleep' 
                AND time > 30
                ORDER BY time DESC
            `, { type: sequelize.QueryTypes.SELECT });
            
            if (longQueries.length > 0) {
                console.log('⚠️ [DATABASE_MONITOR] Long-running queries detected:');
                longQueries.forEach(query => {
                    console.log(`   - Query ID: ${query.id}, Time: ${query.time}s, State: ${query.state}`);
                });
            } else {
                console.log('✅ [DATABASE_MONITOR] No long-running queries detected');
            }
        } catch (error) {
            console.warn('⚠️ [DATABASE_MONITOR] Could not check long-running queries:', error.message);
        }
        
        // Check Redis connectivity
        try {
            await redis.ping();
            console.log('✅ [DATABASE_MONITOR] Redis connection healthy');
        } catch (error) {
            console.error('❌ [DATABASE_MONITOR] Redis connection failed:', error.message);
        }
        
        // Check scheduler locks
        try {
            const locks = await redis.keys('scheduler_result_lock_*');
            console.log(`🔒 [DATABASE_MONITOR] Active scheduler locks: ${locks.length}`);
            
            if (locks.length > 10) {
                console.warn('⚠️ [DATABASE_MONITOR] High number of active locks detected');
            }
        } catch (error) {
            console.warn('⚠️ [DATABASE_MONITOR] Could not check scheduler locks:', error.message);
        }
        
        console.log('✅ [DATABASE_MONITOR] Health check completed');
        
    } catch (error) {
        console.error('❌ [DATABASE_MONITOR] Health monitoring failed:', error);
    }
}

// Run monitoring
monitorDatabaseHealth().then(() => {
    console.log('✅ Database health monitoring completed');
    process.exit(0);
}).catch(error => {
    console.error('❌ Database health monitoring failed:', error);
    process.exit(1);
}); 