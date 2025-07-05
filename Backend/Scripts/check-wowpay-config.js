#!/usr/bin/env node

/**
 * Check WOWPAY Configuration
 * Diagnoses WOWPAY payment gateway configuration issues
 */

// Load environment variables first
require('dotenv').config();

const wowPayConfig = require('../config/wowPayConfig');
const crypto = require('crypto');

function checkWowPayConfig() {
    console.log('🔍 Checking WOWPAY Configuration...\n');
    
    // Check environment variables
    console.log('📋 Environment Variables:');
    console.log('WOWPAY_MCH_ID:', process.env.WOWPAY_MCH_ID ? '✅ Set' : '❌ Not set');
    console.log('WOWPAY_KEY:', process.env.WOWPAY_KEY ? '✅ Set' : '❌ Not set');
    console.log('WOWPAY_HOST:', process.env.WOWPAY_HOST ? '✅ Set' : '❌ Not set');
    console.log('WOWPAY_SIGN_TYPE:', process.env.WOWPAY_SIGN_TYPE ? '✅ Set' : '❌ Not set');
    
    console.log('\n📋 Current Configuration:');
    console.log('Merchant ID:', wowPayConfig.mchId);
    console.log('API Host:', wowPayConfig.host);
    console.log('Key Length:', wowPayConfig.key ? wowPayConfig.key.length : 0);
    console.log('Sign Type:', wowPayConfig.signType);
    
    // Check for placeholder values
    if (wowPayConfig.mchId === '<YOUR_MERCHANT_ID>' || !wowPayConfig.mchId) {
        console.log('\n❌ ERROR: WOWPAY_MCH_ID is not configured properly');
        console.log('Please set the WOWPAY_MCH_ID environment variable');
    }
    
    if (wowPayConfig.key === '<YOUR_SECRET_KEY>' || !wowPayConfig.key) {
        console.log('\n❌ ERROR: WOWPAY_KEY is not configured properly');
        console.log('Please set the WOWPAY_KEY environment variable');
    }
    
    if (wowPayConfig.host === 'https://test.wowpay.biz' && !process.env.WOWPAY_HOST) {
        console.log('\n⚠️ WARNING: Using default WOWPAY test host');
        console.log('Consider setting WOWPAY_HOST environment variable for production');
    }
    
    // Test signature generation
    console.log('\n🔐 Testing Signature Generation:');
    try {
        const testData = {
            mchId: wowPayConfig.mchId,
            orderId: 'TEST_' + Date.now(),
            amount: '100.00',
            timestamp: Date.now()
        };
        
        const signString = Object.keys(testData)
            .sort()
            .map(key => `${key}=${testData[key]}`)
            .join('&') + `&key=${wowPayConfig.key}`;
            
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
    console.log('1. Set WOWPAY_MCH_ID environment variable with your merchant ID');
    console.log('2. Set WOWPAY_KEY environment variable with your secret key');
    console.log('3. Set WOWPAY_HOST for production (default is test environment)');
    console.log('4. Verify the merchant ID and key with WOWPAY support');
    console.log('5. Check if your WOWPAY account is active and approved');
    console.log('6. Ensure you have sufficient balance in your WOWPAY account');
    
    // Check if configuration is complete
    const isComplete = wowPayConfig.mchId && 
                      wowPayConfig.mchId !== '<YOUR_MERCHANT_ID>' &&
                      wowPayConfig.key && 
                      wowPayConfig.key !== '<YOUR_SECRET_KEY>';
    
    console.log('\n📊 Configuration Status:', isComplete ? '✅ Complete' : '❌ Incomplete');
    
    if (!isComplete) {
        console.log('\n🚨 ACTION REQUIRED:');
        console.log('Please configure the missing WOWPAY environment variables:');
        console.log('export WOWPAY_MCH_ID="your_merchant_id"');
        console.log('export WOWPAY_KEY="your_secret_key"');
        console.log('export WOWPAY_HOST="https://api.wowpay.biz"  # For production');
        console.log('export WOWPAY_SIGN_TYPE="MD5"  # Optional');
    }
}

// Run the check
checkWowPayConfig(); 