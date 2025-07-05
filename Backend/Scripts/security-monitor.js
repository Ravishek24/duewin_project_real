#!/usr/bin/env node

/**
 * Real-time Security Monitor
 * Monitors logs for security threats and provides alerts
 */

const fs = require('fs');
const { spawn } = require('child_process');
const { blockIP, isIPBlocked } = require('../middleware/attackProtection');

// Configuration
const LOG_PATHS = [
    '/var/log/nginx/access.log',
    '/var/log/nginx/error.log',
    './logs/app.log',
    './logs/error.log'
];

const SUSPICIOUS_PATTERNS = [
    /\.git/i,
    /\.env/i,
    /\.config/i,
    /wp-content/i,
    /wp-admin/i,
    /phpmyadmin/i,
    /adminer/i,
    /\.\./i,
    /union.*select/i,
    /script.*alert/i,
    /<script/i,
    /sqlmap/i,
    /nikto/i,
    /nmap/i
];

const KNOWN_ATTACKERS = new Set(['185.177.72.14']);

class SecurityMonitor {
    constructor() {
        this.attackCounts = new Map();
        this.blockedIPs = new Set();
        this.suspiciousIPs = new Map();
    }

    start() {
        console.log('🔒 Starting Security Monitor...');
        
        // Monitor nginx access logs
        this.monitorNginxLogs();
        
        // Monitor application logs
        this.monitorAppLogs();
        
        // Start periodic analysis
        setInterval(() => this.analyzeThreats(), 60000); // Every minute
        
        console.log('✅ Security Monitor is running');
    }

    monitorNginxLogs() {
        const tail = spawn('tail', ['-f', '/var/log/nginx/access.log']);
        
        tail.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => this.processLogLine(line, 'nginx'));
        });

        tail.stderr.on('data', (data) => {
            console.error('Nginx log error:', data.toString());
        });
    }

    monitorAppLogs() {
        // Monitor application logs if they exist
        LOG_PATHS.slice(2).forEach(logPath => {
            if (fs.existsSync(logPath)) {
                const tail = spawn('tail', ['-f', logPath]);
                
                tail.stdout.on('data', (data) => {
                    const lines = data.toString().split('\n');
                    lines.forEach(line => this.processLogLine(line, 'app'));
                });
            }
        });
    }

    processLogLine(line, source) {
        if (!line.trim()) return;

        // Extract IP address
        const ipMatch = line.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (!ipMatch) return;

        const ip = ipMatch[1];
        
        // Check for suspicious patterns
        let isSuspicious = false;
        let attackType = '';

        for (const pattern of SUSPICIOUS_PATTERNS) {
            if (pattern.test(line)) {
                isSuspicious = true;
                attackType = pattern.source;
                break;
            }
        }

        if (isSuspicious) {
            this.handleSuspiciousActivity(ip, line, attackType, source);
        }

        // Check for known attackers
        if (KNOWN_ATTACKERS.has(ip)) {
            this.handleKnownAttacker(ip, line, source);
        }
    }

    handleSuspiciousActivity(ip, line, attackType, source) {
        console.log(`🚨 SUSPICIOUS ACTIVITY DETECTED:`);
        console.log(`   IP: ${ip}`);
        console.log(`   Type: ${attackType}`);
        console.log(`   Source: ${source}`);
        console.log(`   Log: ${line.substring(0, 200)}...`);
        console.log('');

        // Increment attack count
        const currentCount = this.attackCounts.get(ip) || 0;
        this.attackCounts.set(ip, currentCount + 1);

        // Track suspicious IP
        if (!this.suspiciousIPs.has(ip)) {
            this.suspiciousIPs.set(ip, {
                firstSeen: new Date(),
                attackCount: 0,
                attackTypes: new Set()
            });
        }

        const ipData = this.suspiciousIPs.get(ip);
        ipData.attackCount++;
        ipData.attackTypes.add(attackType);

        // Auto-block if too many attacks
        if (ipData.attackCount >= 5) {
            this.autoBlockIP(ip, 'multiple_attacks');
        }
    }

    handleKnownAttacker(ip, line, source) {
        console.log(`🚫 KNOWN ATTACKER DETECTED:`);
        console.log(`   IP: ${ip}`);
        console.log(`   Source: ${source}`);
        console.log(`   Log: ${line.substring(0, 200)}...`);
        console.log('');

        // Ensure IP is blocked
        this.ensureIPBlocked(ip);
    }

    async autoBlockIP(ip, reason) {
        if (this.blockedIPs.has(ip)) return;

        try {
            await blockIP(ip, 3600, reason);
            this.blockedIPs.add(ip);
            console.log(`🚫 AUTO-BLOCKED: IP ${ip} for ${reason}`);
        } catch (error) {
            console.error(`Failed to block IP ${ip}:`, error);
        }
    }

    async ensureIPBlocked(ip) {
        if (this.blockedIPs.has(ip)) return;

        try {
            const isBlocked = await isIPBlocked(ip);
            if (!isBlocked) {
                await blockIP(ip, 86400, 'known_attacker'); // 24 hours
                this.blockedIPs.add(ip);
                console.log(`🚫 BLOCKED KNOWN ATTACKER: IP ${ip}`);
            }
        } catch (error) {
            console.error(`Failed to check/block IP ${ip}:`, error);
        }
    }

    analyzeThreats() {
        console.log('\n📊 SECURITY ANALYSIS REPORT:');
        console.log('============================');
        
        // Top attacking IPs
        const topAttackers = Array.from(this.attackCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        if (topAttackers.length > 0) {
            console.log('\n🔥 Top Attacking IPs:');
            topAttackers.forEach(([ip, count]) => {
                console.log(`   ${ip}: ${count} attacks`);
            });
        }

        // Suspicious IPs
        if (this.suspiciousIPs.size > 0) {
            console.log('\n🚨 Suspicious IPs:');
            this.suspiciousIPs.forEach((data, ip) => {
                console.log(`   ${ip}: ${data.attackCount} attacks, types: ${Array.from(data.attackTypes).join(', ')}`);
            });
        }

        // Blocked IPs
        if (this.blockedIPs.size > 0) {
            console.log('\n🚫 Currently Blocked IPs:');
            this.blockedIPs.forEach(ip => {
                console.log(`   ${ip}`);
            });
        }

        console.log('\n============================\n');
    }

    getStats() {
        return {
            totalAttacks: Array.from(this.attackCounts.values()).reduce((a, b) => a + b, 0),
            uniqueAttackers: this.attackCounts.size,
            suspiciousIPs: this.suspiciousIPs.size,
            blockedIPs: this.blockedIPs.size
        };
    }
}

// Start the monitor if run directly
if (require.main === module) {
    const monitor = new SecurityMonitor();
    monitor.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down Security Monitor...');
        process.exit(0);
    });
}

module.exports = SecurityMonitor; 