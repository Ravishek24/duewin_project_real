/**
 * Script to update payment gateway configuration
 * Usage: node update-payment-config.js <merchantId> <apiKey> <host>
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Get command line arguments
const args = process.argv.slice(2);
const [merchantId, apiKey, host] = args;

// Validate arguments
if (args.length < 2) {
  console.error('Usage: node update-payment-config.js <merchantId> <apiKey> [host]');
  console.error('Example: node update-payment-config.js 1285 your_real_api_key [sandbox.wpay.one]');
  console.error('\nNote: If host is not provided, it will use sandbox.wpay.one');
  process.exit(1);
}

// Use default host if not provided
const finalHost = host || 'sandbox.wpay.one';

console.log('Updating payment configuration with:');
console.log('Merchant ID:', merchantId);
console.log('API Key:', '******' + apiKey.slice(-6));
console.log('Host:', finalHost);

// 1. Update .env file
try {
  console.log('\n1. Updating .env file...');
  const envPath = path.join(__dirname, '../.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    // Read existing .env content
    envContent = fs.readFileSync(envPath, 'utf8');
    
    // Replace or add OKPAY variables
    const mchIdRegex = /OKPAY_MCH_ID=.*/;
    const keyRegex = /OKPAY_KEY=.*/;
    const hostRegex = /OKPAY_HOST=.*/;
    
    if (mchIdRegex.test(envContent)) {
      envContent = envContent.replace(mchIdRegex, `OKPAY_MCH_ID=${merchantId}`);
    } else {
      envContent += `\nOKPAY_MCH_ID=${merchantId}`;
    }
    
    if (keyRegex.test(envContent)) {
      envContent = envContent.replace(keyRegex, `OKPAY_KEY=${apiKey}`);
    } else {
      envContent += `\nOKPAY_KEY=${apiKey}`;
    }
    
    if (hostRegex.test(envContent)) {
      envContent = envContent.replace(hostRegex, `OKPAY_HOST=${finalHost}`);
    } else {
      envContent += `\nOKPAY_HOST=${finalHost}`;
    }
  } else {
    // Create new .env file
    envContent = `OKPAY_MCH_ID=${merchantId}\nOKPAY_KEY=${apiKey}\nOKPAY_HOST=${finalHost}\n`;
  }
  
  // Save updated .env content
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file updated successfully');
} catch (error) {
  console.error('❌ Error updating .env file:', error.message);
}

// 2. Update paymentConfig.js - We'll use the same values for consistency
try {
  console.log('\n2. Updating paymentConfig.js...');
  const paymentConfigPath = path.join(__dirname, '../config/paymentConfig.js');
  
  if (fs.existsSync(paymentConfigPath)) {
    const paymentConfigContent = `const paymentConfig = {
    mchId: "${merchantId}",  // Merchant ID
    key: "${apiKey}",  // Secret key
    host: "https://${finalHost}",  // API base URL
};

module.exports = paymentConfig;
`;
    
    // Save updated paymentConfig.js
    fs.writeFileSync(paymentConfigPath, paymentConfigContent);
    console.log('✅ paymentConfig.js updated successfully');
  } else {
    console.error('❌ paymentConfig.js not found');
  }
} catch (error) {
  console.error('❌ Error updating paymentConfig.js:', error.message);
}

// 3. Modify okPayService.js without altering structure
try {
  console.log('\n3. Checking okPayService.js...');
  const okPayServicePath = path.join(__dirname, '../services/okPayService.js');
  
  if (fs.existsSync(okPayServicePath)) {
    console.log('✅ okPayService.js found. No direct changes needed - it will use values from .env');
    console.log('   Environment variables will take precedence over defaults.');
  } else {
    console.log('❌ okPayService.js not found');
  }
} catch (error) {
  console.error('❌ Error checking okPayService.js:', error.message);
}

console.log('\n✨ Payment configuration update completed!');
console.log('\nIMPORTANT: For the changes to take effect, you need to:');
console.log('1. Restart your Node.js application using:');
console.log('   pm2 restart your-app-name');
console.log('   OR');
console.log('   systemctl restart your-service');
console.log('\n2. Test the payment flow again after restart'); 