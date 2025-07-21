let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }



const logger = require('../utils/logger');
const os = require('os');
const nodemailer = require('nodemailer');
const axios = require('axios');

class MonitoringService {
    constructor() {
        this.metrics = {
            connections: 0,
            activeRooms: 0,
            messageRate: 0,
            errorRate: 0,
            systemLoad: 0,
            memoryUsage: 0,
            responseTime: 0,
            backups: {
                total: 0,
                successful: 0,
                failed: 0,
                totalSize: 0,
                averageDuration: 0
            },
            restores: {
                total: 0,
                successful: 0,
                failed: 0,
                averageDuration: 0
            },
            verifications: {
                total: 0,
                successful: 0,
                failed: 0,
                averageDuration: 0
            }
        };

        this.alertThresholds = {
            errorRate: 0.1, // 10% error rate
            responseTime: 1000, // 1 second
            memoryUsage: 0.9, // 90% memory usage
            cpuLoad: 0.8 // 80% CPU load
        };

        this.setupEmailTransport();
        this.setupSlackWebhook();
    }

    setupEmailTransport() {
        this.emailTransport = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }

    setupSlackWebhook() {
        this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    }

    async trackConnection(socket) {
        try {
            const key = 'metrics:connections';
            await redis.hincrby(key, 'total', 1);
            await redis.hincrby(key, 'active', 1);
            await redis.expire(key, 3600);
            
            this.checkConnectionMetrics();
        } catch (error) {
            logger.error('Error tracking connection:', error);
        }
    }

    async trackDisconnection(socket) {
        try {
            const key = 'metrics:connections';
            await redis.hincrby(key, 'active', -1);
            await redis.expire(key, 3600);
        } catch (error) {
            logger.error('Error tracking disconnection:', error);
        }
    }

    async trackMessage(socket, messageType) {
        try {
            const key = `metrics:messages:${messageType}`;
            await redis.incr(key);
            await redis.expire(key, 3600);
        } catch (error) {
            logger.error('Error tracking message:', error);
        }
    }

    async trackError(error, context) {
        try {
            const key = 'metrics:errors';
            await redis.hincrby(key, 'total', 1);
            await redis.hincrby(key, context, 1);
            await redis.expire(key, 3600);

            // Check if error rate exceeds threshold
            const errorRate = await this.calculateErrorRate();
            if (errorRate > this.alertThresholds.errorRate) {
                await this.sendAlert('High Error Rate', {
                    rate: errorRate,
                    context,
                    error: error.message
                });
            }
        } catch (error) {
            logger.error('Error tracking error:', error);
        }
    }

    async trackResponseTime(duration) {
        try {
            const key = 'metrics:responseTime';
            await redis.lpush(key, duration);
            await redis.ltrim(key, 0, 999);
            await redis.expire(key, 3600);

            // Check if response time exceeds threshold
            if (duration > this.alertThresholds.responseTime) {
                await this.sendAlert('High Response Time', {
                    duration,
                    threshold: this.alertThresholds.responseTime
                });
            }
        } catch (error) {
            logger.error('Error tracking response time:', error);
        }
    }

    async updateSystemMetrics() {
        try {
            const metrics = {
                timestamp: Date.now(),
                systemLoad: os.loadavg()[0],
                memoryUsage: process.memoryUsage(),
                uptime: os.uptime()
            };

            await redis.hset('metrics:system', metrics);
            await redis.expire('metrics:system', 3600);

            // Check system health
            await this.checkSystemHealth(metrics);
        } catch (error) {
            logger.error('Error updating system metrics:', error);
        }
    }

    async checkSystemHealth(metrics) {
        const issues = [];

        // Check CPU load
        if (metrics.systemLoad > os.cpus().length * this.alertThresholds.cpuLoad) {
            issues.push('High CPU load');
        }

        // Check memory usage
        const memoryUsage = metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal;
        if (memoryUsage > this.alertThresholds.memoryUsage) {
            issues.push('High memory usage');
        }

        if (issues.length > 0) {
            await this.sendAlert('System Health Issues', {
                issues,
                metrics
            });
        }
    }

    async calculateErrorRate() {
        try {
            const [errors, connections] = await Promise.all([
                redis.hgetall('metrics:errors'),
                redis.hgetall('metrics:connections')
            ]);

            const totalErrors = parseInt(errors.total || 0);
            const totalConnections = parseInt(connections.total || 1);

            return totalErrors / totalConnections;
        } catch (error) {
            logger.error('Error calculating error rate:', error);
            return 0;
        }
    }

    async sendAlert(title, data) {
        try {
            // Log alert
            logger.warn(`Alert: ${title}`, data);

            // Send email alert
            if (this.emailTransport) {
                await this.emailTransport.sendMail({
                    from: process.env.ALERT_EMAIL_FROM,
                    to: process.env.ALERT_EMAIL_TO,
                    subject: `[ALERT] ${title}`,
                    text: JSON.stringify(data, null, 2)
                });
            }

            // Send Slack alert
            if (this.slackWebhookUrl) {
                await axios.post(this.slackWebhookUrl, {
                    text: `*[ALERT] ${title}*\n\`\`\`${JSON.stringify(data, null, 2)}\`\`\``
                });
            }
        } catch (error) {
            logger.error('Error sending alert:', error);
        }
    }

    async getMetrics() {
        try {
            const [
                connections,
                messages,
                errors,
                responseTime,
                system
            ] = await Promise.all([
                redis.hgetall('metrics:connections'),
                redis.hgetall('metrics:messages'),
                redis.hgetall('metrics:errors'),
                redis.lrange('metrics:responseTime', 0, -1),
                redis.hgetall('metrics:system')
            ]);

            return {
                connections,
                messages,
                errors,
                responseTime: this.calculateResponseTimeStats(responseTime),
                system
            };
        } catch (error) {
            logger.error('Error getting metrics:', error);
            return null;
        }
    }

    calculateResponseTimeStats(responseTimes) {
        if (!responseTimes.length) return null;

        const times = responseTimes.map(Number);
        return {
            min: Math.min(...times),
            max: Math.max(...times),
            avg: times.reduce((a, b) => a + b, 0) / times.length,
            p95: this.percentile(times, 95),
            p99: this.percentile(times, 99)
        };
    }

    percentile(arr, p) {
        const sorted = arr.sort((a, b) => a - b);
        const pos = (sorted.length - 1) * p / 100;
        const base = Math.floor(pos);
        const rest = pos - base;
        
        if (sorted[base + 1] !== undefined) {
            return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
        } else {
            return sorted[base];
        }
    }

    async trackBackupMetrics(data) {
        try {
            const key = 'metrics:backups';
            await redis.hincrby(key, 'total', 1);
            await redis.hincrby(key, data.success ? 'successful' : 'failed', 1);
            
            if (data.success) {
                await redis.hincrby(key, 'totalSize', data.size);
                await redis.hincrby(key, 'totalDuration', data.duration);
            }
            
            await redis.expire(key, 86400); // 24 hours

            // Update metrics
            this.metrics.backups.total++;
            if (data.success) {
                this.metrics.backups.successful++;
                this.metrics.backups.totalSize += data.size;
                this.metrics.backups.averageDuration = 
                    (this.metrics.backups.averageDuration * (this.metrics.backups.successful - 1) + data.duration) / 
                    this.metrics.backups.successful;
            } else {
                this.metrics.backups.failed++;
            }

            // Check for backup failures
            if (!data.success) {
                await this.sendAlert('Backup Failed', {
                    error: data.error,
                    duration: data.duration
                });
            }
        } catch (error) {
            logger.error('Error tracking backup metrics:', error);
        }
    }

    async trackRestoreMetrics(data) {
        try {
            const key = 'metrics:restores';
            await redis.hincrby(key, 'total', 1);
            await redis.hincrby(key, data.success ? 'successful' : 'failed', 1);
            
            if (data.success) {
                await redis.hincrby(key, 'totalDuration', data.duration);
            }
            
            await redis.expire(key, 86400); // 24 hours

            // Update metrics
            this.metrics.restores.total++;
            if (data.success) {
                this.metrics.restores.successful++;
                this.metrics.restores.averageDuration = 
                    (this.metrics.restores.averageDuration * (this.metrics.restores.successful - 1) + data.duration) / 
                    this.metrics.restores.successful;
            } else {
                this.metrics.restores.failed++;
            }

            // Check for restore failures
            if (!data.success) {
                await this.sendAlert('Restore Failed', {
                    error: data.error,
                    duration: data.duration
                });
            }
        } catch (error) {
            logger.error('Error tracking restore metrics:', error);
        }
    }

    async trackBackupVerification(data) {
        try {
            const key = 'metrics:verifications';
            await redis.hincrby(key, 'total', 1);
            await redis.hincrby(key, data.success ? 'successful' : 'failed', 1);
            
            if (data.success) {
                await redis.hincrby(key, 'totalDuration', data.duration);
            }
            
            await redis.expire(key, 86400); // 24 hours

            // Update metrics
            this.metrics.verifications.total++;
            if (data.success) {
                this.metrics.verifications.successful++;
                this.metrics.verifications.averageDuration = 
                    (this.metrics.verifications.averageDuration * (this.metrics.verifications.successful - 1) + data.duration) / 
                    this.metrics.verifications.successful;
            } else {
                this.metrics.verifications.failed++;
            }

            // Check for verification failures
            if (!data.success) {
                await this.sendAlert('Backup Verification Failed', {
                    error: data.error,
                    duration: data.duration
                });
            }
        } catch (error) {
            logger.error('Error tracking verification metrics:', error);
        }
    }
}

module.exports = new MonitoringService(); 
module.exports.setRedisHelper = setRedisHelper;
