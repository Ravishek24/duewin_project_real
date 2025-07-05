#!/usr/bin/env node

/**
 * Check GHPAY Configuration
 * Diagnoses GHPAY payment gateway configuration issues
 */

// Load environment variables first
require('dotenv').config();

const ghPayConfig = require('../config/ghPayConfig');
const crypto = require('crypto');

function checkGhPayConfig() {
    console.log('🔍 Checking GHPAY Configuration...\n');
    
    // Check environment variables
    console.log('📋 Environment Variables:');
    console.log('GHPAY_MCH_ID:', process.env.GHPAY_MCH_ID ? '✅ Set' : '❌ Not set');
    console.log('GHPAY_KEY:', process.env.GHPAY_KEY ? '✅ Set' : '❌ Not set');
    console.log('GHPAY_HOST:', process.env.GHPAY_HOST ? '✅ Set' : '❌ Not set');
    
    console.log('\n📋 Current Configuration:');
    console.log('Merchant ID:', ghPayConfig.mchId);
    console.log('API Host:', ghPayConfig.host);
    console.log('Key Length:', ghPayConfig.key ? ghPayConfig.key.length : 0);
    
    // Check for placeholder values
    if (ghPayConfig.mchId === '<YOUR_MERCHANT_ID>' || !ghPayConfig.mchId) {
        console.log('\n❌ ERROR: GHPAY_MCH_ID is not configured properly');
        console.log('Please set the GHPAY_MCH_ID environment variable');
    }
    
    if (ghPayConfig.key === '<YOUR_SECRET_KEY>' || !ghPayConfig.key) {
        console.log('\n❌ ERROR: GHPAY_KEY is not configured properly');
        console.log('Please set the GHPAY_KEY environment variable');
    }
    
    if (ghPayConfig.host === 'https://api.ghpay.vip' && !process.env.GHPAY_HOST) {
        console.log('\n⚠️ WARNING: Using default GHPAY host');
        console.log('Consider setting GHPAY_HOST environment variable if needed');
    }
    
    // Test signature generation
    console.log('\n🔐 Testing Signature Generation:');
    try {
        const testData = {
            mchId: ghPayConfig.mchId,
            orderId: 'TEST_' + Date.now(),
            amount: '100.00',
            timestamp: Date.now()
        };
        
        const signString = Object.keys(testData)
            .sort()
            .map(key => `${key}=${testData[key]}`)
            .join('&') + `&key=${ghPayConfig.key}`;
            
        const signature = crypto.createHash('md5').update(signString).digest('hex');
        
        console.log('Test Data:', testData);
        console.log('Sign String:', signString);
        console.log('Generated Signature:', signature);
        console.log('✅ Signature generation working');
        
    } catch (error) {
        console.log('❌ Signature generation failed:', error.message);
    }
    
    // Recommendations
    console.log('\n💡 Recommendations:');
    console.log('1. Set GHPAY_MCH_ID environment variable with your merchant ID');
    console.log('2. Set GHPAY_KEY environment variable with your secret key');
    console.log('3. Verify the merchant ID and key with GHPAY support');
    console.log('4. Check if your GHPAY account is active and approved');
    console.log('5. Ensure you have sufficient balance in your GHPAY account');
    
    // Check if configuration is complete
    const isComplete = ghPayConfig.mchId && 
                      ghPayConfig.mchId !== '<YOUR_MERCHANT_ID>' &&
                      ghPayConfig.key && 
                      ghPayConfig.key !== '<YOUR_SECRET_KEY>';
    
    console.log('\n📊 Configuration Status:', isComplete ? '✅ Complete' : '❌ Incomplete');
    
    if (!isComplete) {
        console.log('\n🚨 ACTION REQUIRED:');
        console.log('Please configure the missing GHPAY environment variables:');
        console.log('export GHPAY_MCH_ID="your_merchant_id"');
        console.log('export GHPAY_KEY="your_secret_key"');
        console.log('export GHPAY_HOST="https://api.ghpay.vip"  # Optional');
    }
}

// Run the check
checkGhPayConfig(); 