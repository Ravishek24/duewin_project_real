#!/usr/bin/env node

/**
 * Deadlock Monitoring Script
 * Monitors MySQL database for deadlocks and lock wait timeouts
 */

const { getSequelizeInstance } = require('../config/db');

class DeadlockMonitor {
    constructor() {
        this.sequelize = null;
        this.monitoring = false;
        this.stats = {
            deadlocks: 0,
            lockTimeouts: 0,
            longRunningQueries: 0,
            lastCheck: null
        };
    }

    async initialize() {
        try {
            this.sequelize = await getSequelizeInstance();
            console.log('✅ Database connection established');
        } catch (error) {
            console.error('❌ Failed to connect to database:', error.message);
            process.exit(1);
        }
    }

    async checkProcessList() {
        try {
            const [results] = await this.sequelize.query('SHOW PROCESSLIST');
            
            let longRunningQueries = 0;
            let lockWaits = 0;
            
            results.forEach(process => {
                if (process.Command === 'Query' && process.Time > 30) {
                    longRunningQueries++;
                    console.log(`⚠️ Long running query (${process.Time}s): ${process.Info?.substring(0, 100)}...`);
                }
                
                if (process.State && process.State.includes('Locked')) {
                    lockWaits++;
                    console.log(`🔒 Lock wait detected: ${process.Info?.substring(0, 100)}...`);
                }
            });
            
            this.stats.longRunningQueries = longRunningQueries;
            
            if (longRunningQueries > 0 || lockWaits > 0) {
                console.log(`📊 Process Status: ${longRunningQueries} long queries, ${lockWaits} lock waits`);
            }
            
            return { longRunningQueries, lockWaits };
            
        } catch (error) {
            console.error('❌ Error checking process list:', error.message);
            return { longRunningQueries: 0, lockWaits: 0 };
        }
    }

    async checkInnoDBStatus() {
        try {
            const [results] = await this.sequelize.query('SHOW ENGINE INNODB STATUS');
            const status = results[0];
            
            if (status && status.Status) {
                const statusText = status.Status;
                
                // Check for deadlocks
                if (statusText.includes('LATEST DETECTED DEADLOCK')) {
                    this.stats.deadlocks++;
                    console.log('🚨 DEADLOCK DETECTED!');
                    console.log(statusText.substring(
                        statusText.indexOf('LATEST DETECTED DEADLOCK'),
                        statusText.indexOf('TRANSACTIONS') || statusText.length
                    ));
                }
                
                // Check for lock wait timeouts
                if (statusText.includes('LOCK WAIT TIMEOUT')) {
                    this.stats.lockTimeouts++;
                    console.log('⏰ Lock wait timeout detected');
                }
                
                // Check for long transactions
                const longTxMatch = statusText.match(/ACTIVE (\d+) sec/);
                if (longTxMatch && parseInt(longTxMatch[1]) > 60) {
                    console.log(`🐌 Long transaction detected: ${longTxMatch[1]} seconds`);
                }
            }
            
        } catch (error) {
            console.error('❌ Error checking InnoDB status:', error.message);
        }
    }

    async checkLockWaits() {
        try {
            const [results] = await this.sequelize.query(`
                SELECT 
                    r.trx_id waiting_trx_id,
                    r.trx_mysql_thread_id waiting_thread,
                    r.trx_query waiting_query,
                    b.trx_id blocking_trx_id,
                    b.trx_mysql_thread_id blocking_thread,
                    b.trx_query blocking_query,
                    TIMESTAMPDIFF(SECOND, r.trx_started, NOW()) as waiting_time
                FROM information_schema.innodb_lock_waits w
                INNER JOIN information_schema.innodb_trx b ON b.trx_id = w.blocking_trx_id
                INNER JOIN information_schema.innodb_trx r ON r.trx_id = w.requesting_trx_id
                WHERE TIMESTAMPDIFF(SECOND, r.trx_started, NOW()) > 10
            `);
            
            if (results.length > 0) {
                console.log(`🔒 Found ${results.length} lock wait(s):`);
                results.forEach((lock, index) => {
                    console.log(`  ${index + 1}. Thread ${lock.waiting_thread} waiting ${lock.waiting_time}s`);
                    console.log(`     Waiting query: ${lock.waiting_query?.substring(0, 100)}...`);
                    console.log(`     Blocked by: ${lock.blocking_query?.substring(0, 100)}...`);
                });
            }
            
        } catch (error) {
            console.error('❌ Error checking lock waits:', error.message);
        }
    }

    async killLongRunningQueries() {
        try {
            const [results] = await this.sequelize.query(`
                SELECT id, user, host, db, command, time, state, info 
                FROM information_schema.processlist 
                WHERE command = 'Query' AND time > 300
            `);
            
            if (results.length > 0) {
                console.log(`🗑️ Found ${results.length} queries running > 5 minutes`);
                
                for (const process of results) {
                    try {
                        await this.sequelize.query(`KILL ${process.id}`);
                        console.log(`✅ Killed process ${process.id} (running ${process.time}s)`);
                    } catch (killError) {
                        console.error(`❌ Failed to kill process ${process.id}:`, killError.message);
                    }
                }
            }
            
        } catch (error) {
            console.error('❌ Error killing long running queries:', error.message);
        }
    }

    async startMonitoring(intervalMs = 30000) {
        if (this.monitoring) {
            console.log('⚠️ Monitoring already started');
            return;
        }
        
        this.monitoring = true;
        console.log(`🚀 Starting deadlock monitoring (interval: ${intervalMs}ms)`);
        
        const monitor = async () => {
            if (!this.monitoring) return;
            
            console.log('\n' + '='.repeat(60));
            console.log(`🔍 Deadlock Check - ${new Date().toISOString()}`);
            console.log('='.repeat(60));
            
            await this.checkProcessList();
            await this.checkInnoDBStatus();
            await this.checkLockWaits();
            
            // Auto-kill queries running > 5 minutes (optional)
            if (process.argv.includes('--auto-kill')) {
                await this.killLongRunningQueries();
            }
            
            this.stats.lastCheck = new Date();
            
            // Schedule next check
            setTimeout(monitor, intervalMs);
        };
        
        // Start first check
        monitor();
    }

    stopMonitoring() {
        this.monitoring = false;
        console.log('🛑 Deadlock monitoring stopped');
    }

    getStats() {
        return {
            ...this.stats,
            uptime: this.stats.lastCheck ? Date.now() - this.stats.lastCheck.getTime() : 0
        };
    }
}

// CLI Usage
if (require.main === module) {
    const monitor = new DeadlockMonitor();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down...');
        monitor.stopMonitoring();
        process.exit(0);
    });
    
    process.on('SIGTERM', () => {
        console.log('\n🛑 Shutting down...');
        monitor.stopMonitoring();
        process.exit(0);
    });
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const interval = args.find(arg => arg.startsWith('--interval='))?.split('=')[1] || 30000;
    const autoKill = args.includes('--auto-kill');
    
    console.log('🔍 Deadlock Monitor Starting...');
    console.log(`📊 Check interval: ${interval}ms`);
    console.log(`🗑️ Auto-kill: ${autoKill ? 'enabled' : 'disabled'}`);
    
    monitor.initialize().then(() => {
        monitor.startMonitoring(parseInt(interval));
    }).catch(error => {
        console.error('❌ Failed to start monitor:', error);
        process.exit(1);
    });
}

module.exports = DeadlockMonitor;
