const fs = require('fs');
const path = require('path');

// Get the current IP address (you can replace this with your actual IP)
const currentIP = '172.31.41.86'; // Your EC2 instance IP

// Path to the whitelist file
const whitelistPath = path.join(__dirname, 'middleware', 'paymentCallbackWhitelist.js');

// Read the current whitelist file
let whitelistContent = fs.readFileSync(whitelistPath, 'utf8');

console.log(`🔧 Adding IP ${currentIP} to payment callback whitelist...`);

// Check if IP is already in the whitelist
if (whitelistContent.includes(currentIP)) {
    console.log(`✅ IP ${currentIP} is already in the whitelist`);
} else {
    // Add the IP to the combinedWhitelist array
    const updatedContent = whitelistContent.replace(
        /const combinedWhitelist = \[([\s\S]*?)\];/,
        `const combinedWhitelist = [$1    // Added for testing\n    '${currentIP}',\n];`
    );
    
    // Write the updated content back to the file
    fs.writeFileSync(whitelistPath, updatedContent);
    
    console.log(`✅ Successfully added IP ${currentIP} to the whitelist`);
    console.log('🔄 Please restart your server for changes to take effect');
}

// Also show how to temporarily bypass the IP check
console.log('\n📝 Alternative: You can also temporarily bypass IP checking by setting environment variables:');
console.log('export NODE_ENV=development');
console.log('export SKIP_PAYMENT_IP_CHECK=true');
console.log('Then restart your server'); 