#!/usr/bin/env node

/**
 * Debug script to diagnose database lock issues
 * Run with: node debug-database-locks.js
 */

const { getSequelizeInstance } = require('./config/db');

async function debugDatabaseLocks() {
    console.log('🔍 Debugging Database Lock Issues...\n');

    try {
        // Get sequelize instance
        const sequelize = await getSequelizeInstance();
        if (!sequelize) {
            throw new Error('Database connection failed');
        }

        console.log('✅ Database connection established');

        // Check for long-running transactions
        console.log('\n📊 Checking for long-running transactions...');
        const [transactions] = await sequelize.query(`
            SELECT 
                trx_id,
                trx_state,
                trx_started,
                trx_wait_started,
                trx_mysql_thread_id,
                TIME_TO_SEC(TIMEDIFF(NOW(), trx_started)) AS duration_seconds,
                LEFT(trx_query, 100) as query_preview
            FROM information_schema.INNODB_TRX
            WHERE TIME_TO_SEC(TIMEDIFF(NOW(), trx_started)) > 5
            ORDER BY trx_started
        `);

        if (transactions.length > 0) {
            console.log(`🚨 Found ${transactions.length} long-running transactions:`);
            transactions.forEach(trx => {
                console.log(`  🔒 Transaction ${trx.trx_id}: ${trx.duration_seconds}s, State: ${trx.trx_state}`);
                console.log(`     Query: ${trx.query_preview}`);
                console.log(`     Started: ${trx.trx_started}`);
                console.log('');
            });
        } else {
            console.log('✅ No long-running transactions found');
        }

        // Check current process list (excluding event_scheduler)
        console.log('\n📊 Checking current process list...');
        const [processes] = await sequelize.query(`
            SELECT 
                ID,
                USER,
                HOST,
                DB,
                COMMAND,
                TIME,
                STATE,
                LEFT(INFO, 100) as query_preview
            FROM information_schema.PROCESSLIST
            WHERE COMMAND != 'Sleep'
            AND USER != 'event_scheduler'
            AND TIME > 10
            ORDER BY TIME DESC
            LIMIT 20
        `);

        if (processes.length > 0) {
            console.log(`🚨 Found ${processes.length} long-running queries:`);
            processes.forEach(proc => {
                console.log(`  🐌 Process ${proc.ID}: ${proc.TIME}s, State: ${proc.STATE}`);
                console.log(`     User: ${proc.USER}, DB: ${proc.DB}`);
                console.log(`     Query: ${proc.query_preview}`);
                console.log('');
            });
        } else {
            console.log('✅ No long-running queries found (excluding event_scheduler)');
        }

        // Check for locks using alternative method (MySQL 8.0+ compatible)
        console.log('\n📊 Checking for current locks...');
        try {
            // Try the newer MySQL 8.0+ approach first
            const [locks] = await sequelize.query(`
                SELECT 
                    r.trx_id waiting_trx_id,
                    r.trx_mysql_thread_id waiting_thread,
                    r.trx_query waiting_query,
                    b.trx_id blocking_trx_id,
                    b.trx_mysql_thread_id blocking_thread,
                    b.trx_query blocking_query
                FROM performance_schema.data_locks w
                INNER JOIN performance_schema.data_lock_waits dlw ON w.ENGINE_LOCK_ID = dlw.REQUESTING_ENGINE_LOCK_ID
                INNER JOIN information_schema.INNODB_TRX r ON r.trx_mysql_thread_id = dlw.REQUESTING_THREAD_ID
                INNER JOIN information_schema.INNODB_TRX b ON b.trx_mysql_thread_id = dlw.BLOCKING_THREAD_ID
                LIMIT 10
            `);

            if (locks.length > 0) {
                console.log(`🚨 Found ${locks.length} lock waits:`);
                locks.forEach(lock => {
                    console.log(`  🔒 Transaction ${lock.waiting_trx_id} waiting for ${lock.blocking_trx_id}`);
                    console.log(`     Waiting thread: ${lock.waiting_thread}, Blocking thread: ${lock.blocking_thread}`);
                    console.log(`     Waiting query: ${lock.waiting_query}`);
                    console.log(`     Blocking query: ${lock.blocking_query}`);
                    console.log('');
                });
            } else {
                console.log('✅ No lock waits found');
            }
        } catch (lockError) {
            console.log('⚠️ Could not check lock waits (MySQL version limitation):', lockError.message);
            console.log('   This is normal for older MySQL versions');
        }

        // Check for blocked processes using a simpler method
        console.log('\n📊 Checking for blocked processes...');
        try {
            const [blocked] = await sequelize.query(`
                SELECT 
                    p.ID,
                    p.USER,
                    p.HOST,
                    p.DB,
                    p.COMMAND,
                    p.TIME,
                    p.STATE,
                    LEFT(p.INFO, 100) as query_preview
                FROM information_schema.PROCESSLIST p
                WHERE p.STATE LIKE '%lock%'
                OR p.STATE LIKE '%wait%'
                OR p.STATE LIKE '%block%'
                ORDER BY p.TIME DESC
                LIMIT 10
            `);

            if (blocked.length > 0) {
                console.log(`🚨 Found ${blocked.length} potentially blocked processes:`);
                blocked.forEach(proc => {
                    console.log(`  🔒 Process ${proc.ID}: ${proc.TIME}s, State: ${proc.STATE}`);
                    console.log(`     User: ${proc.USER}, DB: ${proc.DB}`);
                    console.log(`     Query: ${proc.query_preview}`);
                    console.log('');
                });
            } else {
                console.log('✅ No blocked processes found');
            }
        } catch (blockedError) {
            console.log('⚠️ Could not check blocked processes:', blockedError.message);
        }

        // Check connection pool status
        console.log('\n📊 Checking connection pool status...');
        const pool = sequelize.connectionManager.pool;
        if (pool) {
            const poolInfo = {
                max: pool.max || pool._factory?.max || 'auto',
                size: pool.size || pool._count || 'unknown',
                available: pool.available || pool._availableObjects?.length || 'unknown',
                using: pool.using || pool._inUseObjects?.length || 'unknown',
                waiting: pool.waiting || pool._waitingClients?.length || 0
            };
            
            console.log('Connection Pool Status:');
            console.log(`  Max connections: ${poolInfo.max}`);
            console.log(`  Current size: ${poolInfo.size}`);
            console.log(`  Available: ${poolInfo.available}`);
            console.log(`  In use: ${poolInfo.using}`);
            console.log(`  Waiting: ${poolInfo.waiting}`);
            
            if (poolInfo.waiting > 5) {
                console.log('  🚨 High wait queue detected!');
            }
        }

        // Check MySQL variables
        console.log('\n📊 Checking MySQL lock timeout settings...');
        const [variables] = await sequelize.query(`
            SHOW VARIABLES LIKE '%lock%timeout%'
        `);

        console.log('Lock timeout settings:');
        variables.forEach(variable => {
            console.log(`  ${variable.Variable_name}: ${variable.Value}`);
        });

        // Check MySQL version
        console.log('\n📊 Checking MySQL version...');
        const [version] = await sequelize.query(`SELECT VERSION() as version`);
        console.log(`  MySQL Version: ${version[0].version}`);

        // Check event scheduler status
        console.log('\n📊 Checking event scheduler status...');
        try {
            const [schedulerStatus] = await sequelize.query(`SHOW VARIABLES LIKE 'event_scheduler'`);
            if (schedulerStatus.length > 0) {
                console.log(`  Event Scheduler: ${schedulerStatus[0].Value}`);
                
                if (schedulerStatus[0].Value === 'ON') {
                    console.log('  ⚠️ Event scheduler is ON - this is normal for MySQL');
                    console.log('  The long-running event_scheduler process is expected behavior');
                }
            }
        } catch (schedulerError) {
            console.log('⚠️ Could not check event scheduler status:', schedulerError.message);
        }

        console.log('\n🎉 Database lock debugging completed!');

    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

// Run the debug
debugDatabaseLocks();
