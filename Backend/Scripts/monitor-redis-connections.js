const unifiedRedis = require('../config/unifiedRedisManager');
function getRedisHelper() { return unifiedRedis.getHelper(); }




/**
 * Redis Connection Monitor
 * Monitors Redis connections in real-time and alerts on issues
 */

class RedisConnectionMonitor {
    constructor() {
        this.stats = {
            startTime: Date.now(),
            checks: 0,
            warnings: 0,
            errors: 0,
            peakConnections: 0,
            averageConnections: 0,
            connectionHistory: []
        };
        
        this.thresholds = {
            warning: 30,    // Warn at 30 connections
            critical: 50,   // Critical at 50 connections
            maxHistory: 100 // Keep last 100 readings
        };
        
        this.isRunning = false;
        this.monitorInterval = null;
    }

    /**
     * Start monitoring
     */
    start(intervalMs = 30000) {
        if (this.isRunning) {
            console.log('⚠️ Monitor is already running');
            return;
        }

        console.log('🚀 Starting Redis Connection Monitor...');
        console.log(`📊 Check interval: ${intervalMs / 1000} seconds`);
        console.log(`⚠️ Warning threshold: ${this.thresholds.warning} connections`);
        console.log(`🚨 Critical threshold: ${this.thresholds.critical} connections`);
        
        this.isRunning = true;
        
        // Initial check
        this.checkConnections();
        
        // Start periodic monitoring
        this.monitorInterval = setInterval(() => {
            this.checkConnections();
        }, intervalMs);
        
        // Setup graceful shutdown
        this.setupGracefulShutdown();
    }

    /**
     * Stop monitoring
     */
    stop() {
        if (!this.isRunning) {
            console.log('⚠️ Monitor is not running');
            return;
        }

        console.log('🛑 Stopping Redis Connection Monitor...');
        
        this.isRunning = false;
        
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval);
            this.monitorInterval = null;
        }
        
        this.printFinalStats();
    }

    /**
     * Check current Redis connections
     */
    async checkConnections() {
        try {
            this.stats.checks++;
            
            // Get Redis server info
            const mainConnection = getRedisHelper().getConnection('monitoring');
            const info = await mainConnection.info('clients');
            
            // Parse connection info
            const connectedClients = parseInt(info.match(/connected_clients:(\d+)/)?.[1] || '0');
            const maxClients = parseInt(info.match(/maxclients:(\d+)/)?.[1] || '0');
            const blockedClients = parseInt(info.match(/blocked_clients:(\d+)/)?.[1] || '0');
            
            // Get manager stats
            const managerStats = getRedisHelper().getStats();
            
            // Update stats
            this.stats.connectionHistory.push({
                timestamp: Date.now(),
                serverConnections: connectedClients,
                managerConnections: managerStats.activeConnections,
                blockedClients: blockedClients,
                maxClients: maxClients
            });
            
            // Keep only recent history
            if (this.stats.connectionHistory.length > this.thresholds.maxHistory) {
                this.stats.connectionHistory.shift();
            }
            
            // Update peak
            if (connectedClients > this.stats.peakConnections) {
                this.stats.peakConnections = connectedClients;
            }
            
            // Calculate average
            const recentConnections = this.stats.connectionHistory.slice(-10).map(h => h.serverConnections);
            this.stats.averageConnections = recentConnections.reduce((a, b) => a + b, 0) / recentConnections.length;
            
            // Log current status
            this.logStatus(connectedClients, managerStats, maxClients, blockedClients);
            
            // Check thresholds
            this.checkThresholds(connectedClients, managerStats);
            
        } catch (error) {
            this.stats.errors++;
            console.error('❌ Connection check failed:', error.message);
        }
    }

    /**
     * Log current connection status
     */
    logStatus(serverConnections, managerStats, maxClients, blockedClients) {
        const timestamp = new Date().toISOString();
        const uptime = Math.floor((Date.now() - this.stats.startTime) / 1000);
        
        console.log(`\n📊 [${timestamp}] Redis Connection Status (Uptime: ${uptime}s)`);
        console.log(`   Server Connections: ${serverConnections}/${maxClients} (${((serverConnections/maxClients)*100).toFixed(1)}%)`);
        console.log(`   Manager Connections: ${managerStats.activeConnections} active, ${managerStats.totalConnections} total`);
        console.log(`   Blocked Clients: ${blockedClients}`);
        console.log(`   Peak Connections: ${this.stats.peakConnections}`);
        console.log(`   Average (10 checks): ${this.stats.averageConnections.toFixed(1)}`);
        
        // Show connection types if available
        if (managerStats.connectionTypes && managerStats.connectionTypes.length > 0) {
            console.log(`   Connection Types: ${managerStats.connectionTypes.slice(0, 5).join(', ')}${managerStats.connectionTypes.length > 5 ? '...' : ''}`);
        }
    }

    /**
     * Check connection thresholds and alert
     */
    checkThresholds(serverConnections, managerStats) {
        // Warning threshold
        if (serverConnections >= this.thresholds.warning && serverConnections < this.thresholds.critical) {
            this.stats.warnings++;
            console.log(`⚠️ WARNING: High Redis connections (${serverConnections})`);
            console.log(`   Manager connections: ${managerStats.activeConnections}`);
            console.log(`   Consider checking for connection leaks`);
        }
        
        // Critical threshold
        if (serverConnections >= this.thresholds.critical) {
            this.stats.warnings++;
            console.log(`🚨 CRITICAL: Very high Redis connections (${serverConnections})`);
            console.log(`   Manager connections: ${managerStats.activeConnections}`);
            console.log(`   Immediate action required!`);
            
            // Show detailed connection info
            this.showDetailedConnections();
        }
        
        // Manager vs Server mismatch
        if (Math.abs(serverConnections - managerStats.activeConnections) > 10) {
            console.log(`⚠️ MISMATCH: Server (${serverConnections}) vs Manager (${managerStats.activeConnections})`);
            console.log(`   Other processes may be creating connections`);
        }
    }

    /**
     * Show detailed connection information
     */
    async showDetailedConnections() {
        try {
            const mainConnection = getRedisHelper().getConnection('monitoring');
            const clientList = await mainConnection.client('list');
            
            console.log('\n🔍 Detailed Connection Analysis:');
            console.log('================================');
            
            const clients = clientList.split('\n').filter(line => line.trim());
            console.log(`Total active connections: ${clients.length}`);
            
            // Group by type
            const connectionTypes = {};
            clients.forEach(client => {
                const match = client.match(/name=([^\s]+)/);
                const name = match ? match[1] : 'unnamed';
                connectionTypes[name] = (connectionTypes[name] || 0) + 1;
            });
            
            console.log('\nConnection breakdown:');
            Object.entries(connectionTypes)
                .sort(([,a], [,b]) => b - a)
                .forEach(([name, count]) => {
                    console.log(`  ${name}: ${count}`);
                });
                
        } catch (error) {
            console.error('❌ Failed to get detailed connections:', error.message);
        }
    }

    /**
     * Print final statistics
     */
    printFinalStats() {
        const uptime = Math.floor((Date.now() - this.stats.startTime) / 1000);
        
        console.log('\n📈 Final Monitor Statistics:');
        console.log('============================');
        console.log(`Total uptime: ${uptime} seconds`);
        console.log(`Total checks: ${this.stats.checks}`);
        console.log(`Warnings: ${this.stats.warnings}`);
        console.log(`Errors: ${this.stats.errors}`);
        console.log(`Peak connections: ${this.stats.peakConnections}`);
        console.log(`Average connections: ${this.stats.averageConnections.toFixed(1)}`);
        
        if (this.stats.connectionHistory.length > 0) {
            const recent = this.stats.connectionHistory.slice(-5);
            console.log('\nRecent connection history:');
            recent.forEach(h => {
                const time = new Date(h.timestamp).toLocaleTimeString();
                console.log(`  ${time}: ${h.serverConnections} connections`);
            });
        }
    }

    /**
     * Setup graceful shutdown
     */
    setupGracefulShutdown() {
        const cleanup = (signal) => {
            console.log(`\n🛑 Received ${signal}, stopping monitor...`);
            this.stop();
            process.exit(0);
        };

        process.on('SIGINT', () => cleanup('SIGINT'));
        process.on('SIGTERM', () => cleanup('SIGTERM'));
    }

    /**
     * Get current statistics
     */
    getStats() {
        return {
            ...this.stats,
            isRunning: this.isRunning,
            thresholds: this.thresholds
        };
    }
}

/**
 * Main execution
 */
async function main() {
    const monitor = new RedisConnectionMonitor();
    
    // Parse command line arguments
    const args = process.argv.slice(2);
    const interval = args[0] ? parseInt(args[0]) * 1000 : 30000; // Default 30 seconds
    
    console.log('🔍 Redis Connection Monitor');
    console.log('==========================');
    console.log(`Check interval: ${interval / 1000} seconds`);
    console.log('Press Ctrl+C to stop\n');
    
    // Start monitoring
    monitor.start(interval);
    
    // Keep process alive
    process.stdin.resume();
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = RedisConnectionMonitor; 
