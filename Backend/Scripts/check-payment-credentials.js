/**
 * Script to check payment gateway credentials across different configuration sources
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Display environment variables
console.log('\n=== ENVIRONMENT VARIABLES ===');
console.log('OKPAY_MCH_ID:', process.env.OKPAY_MCH_ID || '(not set)');
console.log('OKPAY_KEY:', process.env.OKPAY_KEY ? '******' + process.env.OKPAY_KEY.slice(-6) : '(not set)');
console.log('OKPAY_HOST:', process.env.OKPAY_HOST || '(not set)');

// Check paymentConfig.js
try {
  console.log('\n=== paymentConfig.js ===');
  const paymentConfigPath = path.join(__dirname, '../config/paymentConfig.js');
  
  if (fs.existsSync(paymentConfigPath)) {
    const paymentConfig = require('../config/paymentConfig');
    console.log('mchId:', paymentConfig.mchId || '(not set)');
    console.log('key:', paymentConfig.key ? '******' + paymentConfig.key.slice(-6) : '(not set)');
    console.log('host:', paymentConfig.host || '(not set)');
  } else {
    console.log('File not found');
  }
} catch (error) {
  console.error('Error loading paymentConfig.js:', error.message);
}

// Check okPayService.js
try {
  console.log('\n=== okPayService.js ===');
  const okPayServicePath = path.join(__dirname, '../services/okPayService.js');
  
  if (fs.existsSync(okPayServicePath)) {
    // Can't require directly as it might have imports that fail
    // Read file as string and extract values
    const fileContent = fs.readFileSync(okPayServicePath, 'utf8');
    
    // Use regex to extract values
    const mchIdMatch = fileContent.match(/mchId: process\.env\.OKPAY_MCH_ID \|\| ['"]([^'"]+)['"]/);
    const keyMatch = fileContent.match(/key: process\.env\.OKPAY_KEY \|\| ['"]([^'"]+)['"]/);
    const hostMatch = fileContent.match(/host: process\.env\.OKPAY_HOST \|\| ['"]([^'"]+)['"]/);
    
    console.log('mchId:', mchIdMatch ? mchIdMatch[1] : '(not found in file)');
    console.log('key:', keyMatch ? '******' + keyMatch[1].slice(-6) : '(not found in file)');
    console.log('host:', hostMatch ? hostMatch[1] : '(not found in file)');
  } else {
    console.log('File not found');
  }
} catch (error) {
  console.error('Error analyzing okPayService.js:', error.message);
}

// Check for .env file
try {
  console.log('\n=== .env file ===');
  const envPath = path.join(__dirname, '../.env');
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    // Use regex to extract values
    const mchIdMatch = envContent.match(/OKPAY_MCH_ID=([^\n]+)/);
    const keyMatch = envContent.match(/OKPAY_KEY=([^\n]+)/);
    const hostMatch = envContent.match(/OKPAY_HOST=([^\n]+)/);
    
    console.log('OKPAY_MCH_ID in file:', mchIdMatch ? mchIdMatch[1] : '(not found in file)');
    console.log('OKPAY_KEY in file:', keyMatch ? '******' + keyMatch[1].slice(-6) : '(not found in file)');
    console.log('OKPAY_HOST in file:', hostMatch ? hostMatch[1] : '(not found in file)');
  } else {
    console.log('File not found');
  }
} catch (error) {
  console.error('Error reading .env file:', error.message);
}

// Display which values will be used at runtime
console.log('\n=== ACTUAL VALUES USED ===');
console.log('mchId:', process.env.OKPAY_MCH_ID || 
  (fs.existsSync(path.join(__dirname, '../services/okPayService.js')) ? 
    require('../config/paymentConfig').mchId : '(unknown)'));
console.log('key:', (process.env.OKPAY_KEY ? '******' + process.env.OKPAY_KEY.slice(-6) : 
  (fs.existsSync(path.join(__dirname, '../config/paymentConfig.js')) ? 
    '******' + require('../config/paymentConfig').key.slice(-6) : '(unknown)')));
console.log('host:', process.env.OKPAY_HOST || 
  (fs.existsSync(path.join(__dirname, '../config/paymentConfig.js')) ? 
    require('../config/paymentConfig').host : '(unknown)'));

console.log('\n=== RECOMMENDATIONS ===');
if (!process.env.OKPAY_MCH_ID) {
  console.log('• Add OKPAY_MCH_ID to your .env file with the correct merchant ID');
}
if (!process.env.OKPAY_KEY) {
  console.log('• Add OKPAY_KEY to your .env file with the correct API key');
}
if (!process.env.OKPAY_HOST) {
  console.log('• Add OKPAY_HOST to your .env file with the correct host (e.g., sandbox.wpay.one)');
}

// If all are set, suggest ensuring they match
if (process.env.OKPAY_MCH_ID && process.env.OKPAY_KEY && process.env.OKPAY_HOST) {
  console.log('• All environment variables are set. Ensure they contain the correct values.');
}

// Create a sample .env setup
console.log('\n=== SAMPLE .env SETUP ===');
console.log('# Add these lines to your .env file (with correct values):');
console.log(`OKPAY_MCH_ID=${process.env.OKPAY_MCH_ID || '1285'}`);
console.log(`OKPAY_KEY=${process.env.OKPAY_KEY || 'your_production_key_here'}`);
console.log(`OKPAY_HOST=${process.env.OKPAY_HOST || 'sandbox.wpay.one'}`); 