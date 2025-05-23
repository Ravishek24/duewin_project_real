/**
 * Script to update payment gateway IP whitelist
 * 
 * This script helps add or remove IP addresses from the payment gateway whitelist
 * 
 * Usage:
 * - To add IP: node scripts/update-payment-whitelist.js add <ip_address> [gateway]
 * - To remove IP: node scripts/update-payment-whitelist.js remove <ip_address> [gateway]
 * - To list current IPs: node scripts/update-payment-whitelist.js list [gateway]
 * 
 * Examples:
 * - node scripts/update-payment-whitelist.js add 47.242.125.119 OKPAY
 * - node scripts/update-payment-whitelist.js remove 103.242.98.41 WEPAY
 * - node scripts/update-payment-whitelist.js list
 */

const fs = require('fs');
const path = require('path');

// Parse command line arguments
const [action, ipAddress, gateway] = process.argv.slice(2);

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
const middlewarePath = path.join(__dirname, '../middleware/paymentCallbackWhitelist.js');

// Check if middleware file exists
if (!fs.existsSync(middlewarePath)) {
  console.error('Middleware file not found. Create it first using:');
  console.error('node scripts/create-payment-whitelist.js');
  process.exit(1);
}

// Read the middleware file
const fileContent = fs.readFileSync(middlewarePath, 'utf8');

// Parse current whitelists
const parseWhitelists = (content) => {
  const gatewayMatches = content.match(/OKPAY: \[([\s\S]*?)\],/);
  const wepayMatches = content.match(/WEPAY: \[([\s\S]*?)\],/);
  
  const parseIPs = (match) => {
    if (!match) return [];
    return match[1]
      .split(',')
      .map(line => {
        const trimmed = line.trim();
        const match = trimmed.match(/'([^']+)'/);
        return match ? match[1] : null;
      })
      .filter(ip => ip !== null);
  };
  
  return {
    OKPAY: parseIPs(gatewayMatches),
    WEPAY: parseIPs(wepayMatches)
  };
};

// Whitelists from file
const whitelists = parseWhitelists(fileContent);

// Determine which gateways to operate on
const gateways = gateway ? [gateway.toUpperCase()] : ['OKPAY', 'WEPAY'];

// Execute the action
switch (action) {
  case 'list':
    console.log('Current IP whitelists:');
    gateways.forEach(gw => {
      console.log(`\n${gw}:`);
      if (whitelists[gw]?.length) {
        whitelists[gw].forEach(ip => console.log(`  - ${ip}`));
      } else {
        console.log('  No IPs found');
      }
    });
    break;
    
  case 'add':
    gateways.forEach(gw => {
      if (!whitelists[gw]) {
        console.warn(`Gateway ${gw} not found in whitelist configuration`);
        return;
      }
      
      if (whitelists[gw].includes(ipAddress)) {
        console.log(`IP ${ipAddress} already exists in ${gw} whitelist`);
      } else {
        // Prepare updated content by adding the new IP
        let updatedContent = fileContent;
        const gatewaySection = new RegExp(`${gw}: \\[([\\s\\S]*?)\\],`, 'm');
        const replacement = `${gw}: [\n$1    '${ipAddress}',    // Added on ${new Date().toISOString()}\n  ],`;
        
        updatedContent = updatedContent.replace(gatewaySection, replacement);
        
        // Save the updated file
        fs.writeFileSync(middlewarePath, updatedContent);
        console.log(`Added IP ${ipAddress} to ${gw} whitelist`);
      }
    });
    break;
    
  case 'remove':
    gateways.forEach(gw => {
      if (!whitelists[gw]) {
        console.warn(`Gateway ${gw} not found in whitelist configuration`);
        return;
      }
      
      if (!whitelists[gw].includes(ipAddress)) {
        console.log(`IP ${ipAddress} not found in ${gw} whitelist`);
      } else {
        // Find the line with the IP to remove
        const lines = fileContent.split('\n');
        const updatedLines = lines.filter(line => !line.includes(`'${ipAddress}'`));
        
        // Save the updated file
        fs.writeFileSync(middlewarePath, updatedLines.join('\n'));
        console.log(`Removed IP ${ipAddress} from ${gw} whitelist`);
      }
    });
    break;
}

console.log('\nDon\'t forget to restart your application for changes to take effect!'); 