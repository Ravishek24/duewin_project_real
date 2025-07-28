// 🚀 Performance Monitoring Script
// Monitors database connections, Redis performance, and bet processing metrics

const { getSequelizeInstance } = require('../config/db');
const unifiedRedis = require('../config/unifiedRedisManager');
const moment = require('moment-timezone');

class PerformanceMonitor {
    constructor() {
        this.metrics = {
            betProcessing: {
                totalBets: 0,
                successfulBets: 0,
                failedBets: 0,
                averageProcessingTime: 0,
                processingTimes: []
            },
            database: {
                activeConnections: 0,
                idleConnections: 0,
                totalConnections: 0,
                connectionWaitTime: 0
            },
            redis: {
                activeConnections: 0,
                operationsPerSecond: 0,
                memoryUsage: 0,
                latency: 0
            },
            system: {
                memoryUsage: 0,
                cpuUsage: 0,
                uptime: 0
            }
        };
        
        this.startTime = Date.now();
        this.isMonitoring = false;
    }

    async start() {
        if (this.isMonitoring) {
            console.log('⚠️ Performance monitoring already running');
            return;
        }

        console.log('🚀 Starting performance monitoring...');
        this.isMonitoring = true;

        // Start monitoring loops
        this.monitorDatabase();
        this.monitorRedis();
        this.monitorSystem();
        this.logMetrics();

        console.log('✅ Performance monitoring started');
    }

    async monitorDatabase() {
        setInterval(async () => {
            try {
                const sequelize = await getSequelizeInstance();
                const pool = sequelize.connectionManager.pool;

                this.metrics.database = {
                    activeConnections: pool.using || 0,
                    idleConnections: pool.available || 0,
                    totalConnections: pool.size || 0,
                    connectionWaitTime: pool.pending || 0
                };

                // Alert if connection pool is getting full
                if (this.metrics.database.activeConnections > 80) {
                    console.warn(`⚠️ High database connections: ${this.metrics.database.activeConnections}/100`);
                }
            } catch (error) {
                console.error('❌ Database monitoring error:', error.message);
            }
        }, 5000); // Every 5 seconds
    }

    async monitorRedis() {
        setInterval(async () => {
            try {
                const redis = unifiedRedis.getHelper();
                
                // Get Redis info
                const info = await redis.info();
                const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
                const connectedClientsMatch = info.match(/connected_clients:(\d+)/);
                const opsPerSecMatch = info.match(/instantaneous_ops_per_sec:(\d+)/);

                this.metrics.redis = {
                    activeConnections: parseInt(connectedClientsMatch?.[1] || '0'),
                    operationsPerSecond: parseInt(opsPerSecMatch?.[1] || '0'),
                    memoryUsage: memoryMatch?.[1] || '0B',
                    latency: await this.measureRedisLatency(redis)
                };

                // Alert if Redis connections are high
                if (this.metrics.redis.activeConnections > 50) {
                    console.warn(`⚠️ High Redis connections: ${this.metrics.redis.activeConnections}`);
                }
            } catch (error) {
                console.error('❌ Redis monitoring error:', error.message);
            }
        }, 5000); // Every 5 seconds
    }

    async monitorSystem() {
        setInterval(() => {
            const memUsage = process.memoryUsage();
            this.metrics.system = {
                memoryUsage: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
                cpuUsage: process.cpuUsage(),
                uptime: Date.now() - this.startTime
            };
        }, 10000); // Every 10 seconds
    }

    async measureRedisLatency(redis) {
        const start = Date.now();
        try {
            await redis.ping();
            return Date.now() - start;
        } catch (error) {
            return -1;
        }
    }

    logMetrics() {
        setInterval(() => {
            const uptime = moment.duration(Date.now() - this.startTime);
            
            console.log('\n📊 PERFORMANCE METRICS');
            console.log('='.repeat(50));
            console.log(`⏱️  Uptime: ${uptime.hours()}h ${uptime.minutes()}m ${uptime.seconds()}s`);
            console.log(`🧠 Memory: ${this.metrics.system.memoryUsage}`);
            
            console.log('\n🗄️  DATABASE');
            console.log(`   Connections: ${this.metrics.database.activeConnections}/${this.metrics.database.totalConnections} active`);
            console.log(`   Idle: ${this.metrics.database.idleConnections}`);
            console.log(`   Waiting: ${this.metrics.database.connectionWaitTime}`);
            
            console.log('\n🔴 REDIS');
            console.log(`   Connections: ${this.metrics.redis.activeConnections}`);
            console.log(`   Ops/sec: ${this.metrics.redis.operationsPerSecond}`);
            console.log(`   Memory: ${this.metrics.redis.memoryUsage}`);
            console.log(`   Latency: ${this.metrics.redis.latency}ms`);
            
            console.log('\n🎲 BET PROCESSING');
            console.log(`   Total: ${this.metrics.betProcessing.totalBets}`);
            console.log(`   Success: ${this.metrics.betProcessing.successfulBets}`);
            console.log(`   Failed: ${this.metrics.betProcessing.failedBets}`);
            console.log(`   Avg Time: ${this.metrics.betProcessing.averageProcessingTime.toFixed(2)}ms`);
            
            // Calculate success rate
            if (this.metrics.betProcessing.totalBets > 0) {
                const successRate = (this.metrics.betProcessing.successfulBets / this.metrics.betProcessing.totalBets * 100).toFixed(2);
                console.log(`   Success Rate: ${successRate}%`);
            }
            
            console.log('='.repeat(50));
        }, 30000); // Every 30 seconds
    }

    recordBetProcessing(startTime, success = true) {
        const processingTime = Date.now() - startTime;
        
        this.metrics.betProcessing.totalBets++;
        if (success) {
            this.metrics.betProcessing.successfulBets++;
        } else {
            this.metrics.betProcessing.failedBets++;
        }
        
        this.metrics.betProcessing.processingTimes.push(processingTime);
        
        // Keep only last 100 processing times for average calculation
        if (this.metrics.betProcessing.processingTimes.length > 100) {
            this.metrics.betProcessing.processingTimes.shift();
        }
        
        // Calculate average processing time
        const total = this.metrics.betProcessing.processingTimes.reduce((sum, time) => sum + time, 0);
        this.metrics.betProcessing.averageProcessingTime = total / this.metrics.betProcessing.processingTimes.length;
    }

    getMetrics() {
        return this.metrics;
    }

    async stop() {
        this.isMonitoring = false;
        console.log('🛑 Performance monitoring stopped');
    }
}

// Export singleton instance
const performanceMonitor = new PerformanceMonitor();

module.exports = performanceMonitor; 