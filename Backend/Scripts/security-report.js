#!/usr/bin/env node

/**
 * Security Report Generator
 * Generates comprehensive security reports
 */

const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class SecurityReport {
    constructor() {
        this.report = {
            timestamp: new Date().toISOString(),
            server: {},
            security: {},
            threats: {},
            recommendations: []
        };
    }

    async generate() {
        console.log('🔒 Generating Security Report...');
        
        await this.checkServerSecurity();
        await this.checkNginxSecurity();
        await this.checkApplicationSecurity();
        await this.analyzeThreats();
        this.generateRecommendations();
        
        this.saveReport();
        this.displayReport();
    }

    async checkServerSecurity() {
        console.log('📋 Checking server security...');
        
        try {
            // Check UFW status
            const { stdout: ufwStatus } = await execAsync('sudo ufw status');
            this.report.server.ufw = ufwStatus.includes('Status: active');
            
            // Check open ports
            const { stdout: openPorts } = await execAsync('sudo netstat -tlnp');
            this.report.server.openPorts = openPorts.split('\n').filter(line => line.trim());
            
            // Check system updates
            const { stdout: updates } = await execAsync('apt list --upgradable 2>/dev/null | wc -l');
            this.report.server.pendingUpdates = parseInt(updates) - 1; // Subtract header line
            
        } catch (error) {
            console.log('⚠️  Could not check server security (requires sudo)');
        }
    }

    async checkNginxSecurity() {
        console.log('🌐 Checking nginx security...');
        
        try {
            // Check nginx configuration
            const { stdout: nginxTest } = await execAsync('nginx -t');
            this.report.security.nginxValid = nginxTest.includes('successful');
            
            // Check SSL certificate
            const { stdout: sslCheck } = await execAsync('openssl s_client -connect api.strikecolor1.com:443 -servername api.strikecolor1.com < /dev/null 2>/dev/null | openssl x509 -noout -dates');
            this.report.security.sslInfo = sslCheck;
            
            // Check security headers
            const { stdout: headers } = await execAsync('curl -I https://api.strikecolor1.com/health 2>/dev/null');
            this.report.security.headers = this.parseHeaders(headers);
            
        } catch (error) {
            console.log('⚠️  Could not check nginx security');
        }
    }

    async checkApplicationSecurity() {
        console.log('🔧 Checking application security...');
        
        // Check if security middleware is loaded
        const indexContent = fs.readFileSync('./index.js', 'utf8');
        this.report.security.securityMiddleware = indexContent.includes('securityMiddleware');
        this.report.security.attackProtection = indexContent.includes('attackProtection');
        
        // Check environment variables
        this.report.security.envVars = {
            NODE_ENV: process.env.NODE_ENV,
            REDIS_URL: process.env.REDIS_URL ? 'Set' : 'Not set',
            JWT_SECRET: process.env.JWT_SECRET ? 'Set' : 'Not set'
        };
    }

    async analyzeThreats() {
        console.log('🚨 Analyzing threats...');
        
        try {
            // Check recent nginx logs for attacks
            const { stdout: recentLogs } = await execAsync('tail -n 1000 /var/log/nginx/access.log | grep -E "\\.git|\\.env|wp-content|phpmyadmin" | wc -l');
            this.report.threats.recentAttacks = parseInt(recentLogs);
            
            // Check for blocked IPs
            const { stdout: blockedIPs } = await execAsync('sudo ufw status | grep DENY | wc -l');
            this.report.threats.blockedIPs = parseInt(blockedIPs);
            
            // Check for suspicious patterns
            const { stdout: suspicious } = await execAsync('tail -n 1000 /var/log/nginx/access.log | grep -E "bot|crawler|scanner|sqlmap|nikto" | wc -l');
            this.report.threats.suspiciousRequests = parseInt(suspicious);
            
        } catch (error) {
            console.log('⚠️  Could not analyze threats (requires sudo)');
        }
    }

    generateRecommendations() {
        console.log('💡 Generating recommendations...');
        
        if (!this.report.server.ufw) {
            this.report.recommendations.push('Enable UFW firewall');
        }
        
        if (this.report.server.pendingUpdates > 0) {
            this.report.recommendations.push(`Update system packages (${this.report.server.pendingUpdates} pending)`);
        }
        
        if (!this.report.security.nginxValid) {
            this.report.recommendations.push('Fix nginx configuration');
        }
        
        if (!this.report.security.securityMiddleware) {
            this.report.recommendations.push('Enable security middleware');
        }
        
        if (this.report.threats.recentAttacks > 0) {
            this.report.recommendations.push(`Monitor for attacks (${this.report.threats.recentAttacks} recent attempts)`);
        }
        
        if (this.report.security.envVars.JWT_SECRET === 'Not set') {
            this.report.recommendations.push('Set JWT_SECRET environment variable');
        }
    }

    parseHeaders(headers) {
        const securityHeaders = [
            'Content-Security-Policy',
            'X-Frame-Options',
            'X-Content-Type-Options',
            'Strict-Transport-Security',
            'Referrer-Policy',
            'Permissions-Policy'
        ];
        
        const result = {};
        securityHeaders.forEach(header => {
            const match = headers.match(new RegExp(`${header}:\\s*(.+)`, 'i'));
            result[header] = match ? match[1].trim() : 'Not set';
        });
        
        return result;
    }

    saveReport() {
        const filename = `security-report-${new Date().toISOString().split('T')[0]}.json`;
        fs.writeFileSync(filename, JSON.stringify(this.report, null, 2));
        console.log(`📄 Report saved to: ${filename}`);
    }

    displayReport() {
        console.log('\n🔒 SECURITY REPORT');
        console.log('==================');
        console.log(`📅 Generated: ${this.report.timestamp}`);
        
        console.log('\n🛡️  Security Status:');
        console.log(`   UFW Firewall: ${this.report.server.ufw ? '✅ Active' : '❌ Inactive'}`);
        console.log(`   Nginx Config: ${this.report.security.nginxValid ? '✅ Valid' : '❌ Invalid'}`);
        console.log(`   Security Middleware: ${this.report.security.securityMiddleware ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`   Attack Protection: ${this.report.security.attackProtection ? '✅ Enabled' : '❌ Disabled'}`);
        
        console.log('\n🚨 Threat Analysis:');
        console.log(`   Recent Attacks: ${this.report.threats.recentAttacks || 0}`);
        console.log(`   Blocked IPs: ${this.report.threats.blockedIPs || 0}`);
        console.log(`   Suspicious Requests: ${this.report.threats.suspiciousRequests || 0}`);
        
        if (this.report.recommendations.length > 0) {
            console.log('\n💡 Recommendations:');
            this.report.recommendations.forEach((rec, index) => {
                console.log(`   ${index + 1}. ${rec}`);
            });
        }
        
        console.log('\n==================\n');
    }
}

// Generate report if run directly
if (require.main === module) {
    const report = new SecurityReport();
    report.generate().catch(console.error);
}

module.exports = SecurityReport; 