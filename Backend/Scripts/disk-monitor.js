#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Disk space monitoring script
const DISK_THRESHOLD = 85; // Alert when disk usage is above 85%

function getDiskUsage() {
    try {
        const output = execSync('df -h / | tail -1', { encoding: 'utf8' });
        const parts = output.trim().split(/\s+/);
        const usagePercent = parseInt(parts[4].replace('%', ''));
        return {
            total: parts[1],
            used: parts[2],
            available: parts[3],
            usagePercent: usagePercent
        };
    } catch (error) {
        console.error('Error getting disk usage:', error.message);
        return null;
    }
}

function cleanOldLogs() {
    try {
        console.log('🧹 Cleaning old logs...');
        
        // Clear PM2 logs older than 7 days
        execSync('pm2 flush', { stdio: 'inherit' });
        
        // Clear system logs
        execSync('sudo journalctl --vacuum-time=7d', { stdio: 'inherit' });
        
        // Clear package cache
        execSync('sudo apt clean', { stdio: 'inherit' });
        execSync('sudo apt autoremove -y', { stdio: 'inherit' });
        
        console.log('✅ Log cleanup completed');
    } catch (error) {
        console.error('❌ Error cleaning logs:', error.message);
    }
}

function findLargeFiles() {
    try {
        console.log('🔍 Finding large files...');
        const output = execSync('find /home/ubuntu -type f -size +100M -exec ls -lh {} \\; 2>/dev/null | head -10', { encoding: 'utf8' });
        if (output.trim()) {
            console.log('Large files found:');
            console.log(output);
        } else {
            console.log('No large files found in user directory');
        }
    } catch (error) {
        console.error('❌ Error finding large files:', error.message);
    }
}

function main() {
    console.log('💾 Disk Space Monitor');
    console.log('====================');
    
    const diskInfo = getDiskUsage();
    if (!diskInfo) {
        console.error('❌ Could not get disk usage information');
        process.exit(1);
    }
    
    console.log(`📊 Disk Usage: ${diskInfo.usagePercent}%`);
    console.log(`💿 Total: ${diskInfo.total}`);
    console.log(`📈 Used: ${diskInfo.used}`);
    console.log(`📉 Available: ${diskInfo.available}`);
    
    if (diskInfo.usagePercent > DISK_THRESHOLD) {
        console.log(`⚠️  WARNING: Disk usage is above ${DISK_THRESHOLD}%!`);
        console.log('🚨 Taking action to free up space...');
        
        cleanOldLogs();
        findLargeFiles();
        
        // Check disk usage again after cleanup
        const newDiskInfo = getDiskUsage();
        if (newDiskInfo) {
            console.log(`📊 Disk usage after cleanup: ${newDiskInfo.usagePercent}%`);
        }
    } else {
        console.log('✅ Disk usage is within acceptable limits');
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { getDiskUsage, cleanOldLogs, findLargeFiles }; 