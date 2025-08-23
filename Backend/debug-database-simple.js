#!/usr/bin/env node

/**
 * Simple database debug script - compatible with all MySQL versions
 * Run with: node debug-database-simple.js
 */

const { getSequelizeInstance } = require('./config/db');

async function debugDatabaseSimple() {
    console.log('🔍 Simple Database Debug (MySQL Compatible)...\n');

    try {
        // Get sequelize instance
        const sequelize = await getSequelizeInstance();
        if (!sequelize) {
            throw new Error('Database connection failed');
        }

        console.log('✅ Database connection established');

        // Check MySQL version
        console.log('\n📊 MySQL Version Check...');
        try {
            const [version] = await sequelize.query(`SELECT VERSION() as version`);
            console.log(`  Version: ${version[0].version}`);
        } catch (error) {
            console.log('  ❌ Could not get version:', error.message);
        }

        // Check current process list (simple approach)
        console.log('\n📊 Current Active Processes...');
        try {
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
                AND TIME > 5
                ORDER BY TIME DESC
                LIMIT 15
            `);

            if (processes.length > 0) {
                console.log(`📋 Found ${processes.length} active processes:`);
                processes.forEach(proc => {
                    const timeDisplay = proc.TIME > 3600 ? `${Math.floor(proc.TIME/3600)}h ${Math.floor((proc.TIME%3600)/60)}m` : `${proc.TIME}s`;
                    console.log(`  ${proc.COMMAND === 'Query' ? '🔍' : '⚙️'} Process ${proc.ID}: ${timeDisplay}, State: ${proc.STATE || 'Unknown'}`);
                    console.log(`     User: ${proc.USER}, DB: ${proc.DB || 'None'}`);
                    if (proc.query_preview) {
                        console.log(`     Query: ${proc.query_preview}`);
                    }
                    console.log('');
                });
            } else {
                console.log('✅ No long-running processes found');
            }
        } catch (error) {
            console.log('❌ Could not check processes:', error.message);
        }

        // Check for transactions
        console.log('\n📊 Active Transactions...');
        try {
            const [transactions] = await sequelize.query(`
                SELECT 
                    trx_id,
                    trx_state,
                    trx_started,
                    TIME_TO_SEC(TIMEDIFF(NOW(), trx_started)) AS duration_seconds
                FROM information_schema.INNODB_TRX
                WHERE TIME_TO_SEC(TIMEDIFF(NOW(), trx_started)) > 1
                ORDER BY trx_started
                LIMIT 10
            `);

            if (transactions.length > 0) {
                console.log(`🔒 Found ${transactions.length} active transactions:`);
                transactions.forEach(trx => {
                    const duration = trx.duration_seconds > 60 ? `${Math.floor(trx.duration_seconds/60)}m ${trx.duration_seconds%60}s` : `${trx.duration_seconds}s`;
                    console.log(`  Transaction ${trx.trx_id}: ${duration}, State: ${trx.trx_state}`);
                });
            } else {
                console.log('✅ No active transactions found');
            }
        } catch (error) {
            console.log('❌ Could not check transactions:', error.message);
        }

        // Check connection pool status
        console.log('\n📊 Connection Pool Status...');
        const pool = sequelize.connectionManager.pool;
        if (pool) {
            try {
                const poolInfo = {
                    max: pool.max || pool._factory?.max || 'auto',
                    size: pool.size || pool._count || 'unknown',
                    available: pool.available || pool._availableObjects?.length || 'unknown',
                    using: pool.using || pool._inUseObjects?.length || 'unknown',
                    waiting: pool.waiting || pool._waitingClients?.length || 0
                };
                
                console.log('  Max connections:', poolInfo.max);
                console.log('  Current size:', poolInfo.size);
                console.log('  Available:', poolInfo.available);
                console.log('  In use:', poolInfo.using);
                console.log('  Waiting:', poolInfo.waiting);
                
                if (poolInfo.waiting > 5) {
                    console.log('  🚨 High wait queue detected!');
                }
            } catch (error) {
                console.log('  ⚠️ Could not get detailed pool info:', error.message);
            }
        } else {
            console.log('  ⚠️ No connection pool found');
        }

        // Check MySQL variables
        console.log('\n📊 MySQL Configuration...');
        try {
            const [variables] = await sequelize.query(`
                SHOW VARIABLES WHERE Variable_name IN (
                    'innodb_lock_wait_timeout',
                    'lock_wait_timeout',
                    'max_connections',
                    'wait_timeout',
                    'interactive_timeout'
                )
            `);

            console.log('  Key settings:');
            variables.forEach(variable => {
                console.log(`    ${variable.Variable_name}: ${variable.Value}`);
            });
        } catch (error) {
            console.log('  ❌ Could not get variables:', error.message);
        }

        // Check for potential issues
        console.log('\n🔍 Potential Issues Analysis...');
        let issuesFound = 0;

        try {
            // Check for long-running queries
            const [longQueries] = await sequelize.query(`
                SELECT COUNT(*) as count
                FROM information_schema.PROCESSLIST
                WHERE COMMAND = 'Query'
                AND TIME > 30
                AND USER NOT IN ('event_scheduler', 'system user')
            `);

            if (longQueries[0].count > 0) {
                console.log(`  🚨 ${longQueries[0].count} queries running >30 seconds`);
                issuesFound++;
            }

            // Check for high connection usage
            const [highConnections] = await sequelize.query(`
                SELECT COUNT(*) as count
                FROM information_schema.PROCESSLIST
                WHERE COMMAND != 'Sleep'
            `);

            if (highConnections[0].count > 50) {
                console.log(`  🚨 High connection count: ${highConnections[0].count}`);
                issuesFound++;
            }

            // Check for locked tables
            const [lockedTables] = await sequelize.query(`
                SELECT COUNT(*) as count
                FROM information_schema.INNODB_LOCKS
            `);

            if (lockedTables[0].count > 0) {
                console.log(`  🔒 ${lockedTables[0].count} locks detected`);
                issuesFound++;
            }

        } catch (error) {
            console.log('  ⚠️ Could not perform full analysis:', error.message);
        }

        if (issuesFound === 0) {
            console.log('  ✅ No obvious issues detected');
        }

        console.log('\n🎉 Simple database debug completed!');

    } catch (error) {
        console.error('❌ Debug failed:', error.message);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

// Run the debug
debugDatabaseSimple();
