#!/usr/bin/env node

/**
 * IP Blocking Script
 * Manually block IP addresses for security
 */

const { blockIP } = require('../middleware/attackProtection');

const ipAddress = process.argv[2];
const duration = process.argv[3] || 3600; // Default 1 hour
const reason = process.argv[4] || 'manual_block';

if (!ipAddress) {
    console.log('Usage: node scripts/block-ip.js <ip_address> [duration_seconds] [reason]');
    console.log('Example: node scripts/block-ip.js 185.177.72.14 86400 "known_attacker"');
    process.exit(1);
}

async function blockIPAddress() {
    try {
        console.log(`🚫 Blocking IP: ${ipAddress}`);
        console.log(`⏱️  Duration: ${duration} seconds`);
        console.log(`📝 Reason: ${reason}`);
        
        const success = await blockIP(ipAddress, parseInt(duration), reason);
        
        if (success) {
            console.log('✅ IP blocked successfully');
        } else {
            console.log('❌ Failed to block IP');
            process.exit(1);
        }
    } catch (error) {
        console.error('Error blocking IP:', error);
        process.exit(1);
    }
}

blockIPAddress(); 