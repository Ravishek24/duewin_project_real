/**
 * Script to update admin IP whitelist
 * 
 * This script helps add or remove IP addresses from the admin IP whitelist
 * 
 * Usage:
 * - To add IP: node scripts/update-admin-whitelist.js add <ip_address>
 * - To remove IP: node scripts/update-admin-whitelist.js remove <ip_address>
 * - To list current IPs: node scripts/update-admin-whitelist.js list
 * 
 * Note: By default, IP checking is disabled, allowing access from any IP.
 * To enable IP restrictions, set the environment variable:
 * ENABLE_ADMIN_IP_CHECK=true
 *
 * Examples:
 * - node scripts/update-admin-whitelist.js add 192.168.1.100
 * - node scripts/update-admin-whitelist.js remove 192.168.1.100
 * - node scripts/update-admin-whitelist.js list
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Parse command line arguments
const [action, ipAddress] = process.argv.slice(2);

// Validate action
if (!action || !['add', 'remove', 'list'].includes(action)) {
  console.error('Invalid action. Use: add, remove, or list');
  process.exit(1);
}

// For add/remove actions, IP address is required
if (['add', 'remove'].includes(action) && !ipAddress) {
  console.error(`IP address required for ${action} action`);
  process.exit(1);
}

// Path to middleware file
const middlewarePath = path.join(__dirname, '../middleware/adminIpWhitelist.js');

// Check if middleware file exists
if (!fs.existsSync(middlewarePath)) {
  console.error('Admin IP whitelist middleware file not found.');
  process.exit(1);
}

// Read the middleware file
const fileContent = fs.readFileSync(middlewarePath, 'utf8');

// Parse current whitelist
const parseWhitelist = (content) => {
  const match = content.match(/const whitelistedIPs = ([^;]+);/);
  if (!match) return [];
  
  try {
    const whitelistStr = match[1];
    if (whitelistStr.includes('process.env.ADMIN_IP_WHITELIST')) {
      // Get IPs from environment variable
      return process.env.ADMIN_IP_WHITELIST ? 
        process.env.ADMIN_IP_WHITELIST.split(',') : 
        ['127.0.0.1']; 
    } else {
      // Parse array from file content
      const arrayStr = whitelistStr.replace(/[\[\]']/g, '').split(',');
      return arrayStr.map(ip => ip.trim().replace(/'/g, ''));
    }
  } catch (err) {
    console.error('Error parsing whitelist:', err);
    return [];
  }
};

const whitelist = parseWhitelist(fileContent);

// Execute the action
switch (action) {
  case 'list':
    console.log('Current admin IP whitelist:');
    if (whitelist.length) {
      whitelist.forEach(ip => console.log(`  - ${ip}`));
    } else {
      console.log('  No IPs found');
    }
    break;
    
  case 'add':
    if (whitelist.includes(ipAddress)) {
      console.log(`IP ${ipAddress} already exists in admin whitelist`);
    } else {
      // If we're using environment variable, recommend updating .env
      if (fileContent.includes('process.env.ADMIN_IP_WHITELIST')) {
        console.log(`\nThe admin whitelist is configured to use environment variables.`);
        console.log(`Please add the IP address to your .env file:`);
        
        const currentIPs = process.env.ADMIN_IP_WHITELIST || '127.0.0.1';
        console.log(`ADMIN_IP_WHITELIST=${currentIPs},${ipAddress}`);
      } else {
        // Hard-coded list - update the file directly
        const newWhitelist = [...whitelist, ipAddress];
        const updatedContent = fileContent.replace(
          /const whitelistedIPs = ([^;]+);/,
          `const whitelistedIPs = ['${newWhitelist.join("', '")}'];`
        );
        fs.writeFileSync(middlewarePath, updatedContent);
        console.log(`Added IP ${ipAddress} to admin whitelist`);
      }
    }
    break;
    
  case 'remove':
    if (!whitelist.includes(ipAddress)) {
      console.log(`IP ${ipAddress} not found in admin whitelist`);
    } else {
      // If we're using environment variable, recommend updating .env
      if (fileContent.includes('process.env.ADMIN_IP_WHITELIST')) {
        console.log(`\nThe admin whitelist is configured to use environment variables.`);
        console.log(`Please update your .env file to remove this IP:`);
        
        const currentIPs = process.env.ADMIN_IP_WHITELIST || '127.0.0.1';
        const newIPs = currentIPs
          .split(',')
          .filter(ip => ip !== ipAddress)
          .join(',');
        console.log(`ADMIN_IP_WHITELIST=${newIPs}`);
      } else {
        // Hard-coded list - update the file directly
        const newWhitelist = whitelist.filter(ip => ip !== ipAddress);
        const updatedContent = fileContent.replace(
          /const whitelistedIPs = ([^;]+);/,
          `const whitelistedIPs = ['${newWhitelist.join("', '")}'];`
        );
        fs.writeFileSync(middlewarePath, updatedContent);
        console.log(`Removed IP ${ipAddress} from admin whitelist`);
      }
    }
    break;
}

console.log('\nDon\'t forget to restart your application for changes to take effect!'); 