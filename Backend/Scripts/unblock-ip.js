#!/usr/bin/env node

/**
 * IP Unblocking Script
 * Manually unblock IP addresses
 */

const { unblockIP } = require('../middleware/attackProtection');

const ipAddress = process.argv[2];

if (!ipAddress) {
    console.log('Usage: node scripts/unblock-ip.js <ip_address>');
    console.log('Example: node scripts/unblock-ip.js 185.177.72.14');
    process.exit(1);
}

async function unblockIPAddress() {
    try {
        console.log(`✅ Unblocking IP: ${ipAddress}`);
        
        const success = await unblockIP(ipAddress);
        
        if (success) {
            console.log('✅ IP unblocked successfully');
        } else {
            console.log('❌ Failed to unblock IP');
            process.exit(1);
        }
    } catch (error) {
        console.error('Error unblocking IP:', error);
        process.exit(1);
    }
}

unblockIPAddress(); 