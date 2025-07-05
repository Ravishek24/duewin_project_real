#!/usr/bin/env node

/**
 * Test WalletRecharge Model
 * Verifies that the WalletRecharge model is properly loaded and working
 */

async function testWalletRecharge() {
    try {
        console.log('🧪 Testing WalletRecharge model...');
        
        // Test model loading
        const models = require('../models');
        console.log('✅ Models loaded:', Object.keys(models));
        
        // Check WalletRecharge specifically
        const WalletRecharge = models.WalletRecharge;
        console.log('WalletRecharge type:', typeof WalletRecharge);
        console.log('WalletRecharge.create:', typeof WalletRecharge?.create);
        console.log('WalletRecharge.findOne:', typeof WalletRecharge?.findOne);
        
        if (!WalletRecharge) {
            console.error('❌ WalletRecharge model is undefined');
            return;
        }
        
        if (typeof WalletRecharge.create !== 'function') {
            console.error('❌ WalletRecharge.create is not a function');
            return;
        }
        
        // Test a simple query
        console.log('🔍 Testing WalletRecharge query...');
        const count = await WalletRecharge.count();
        console.log('✅ WalletRecharge count:', count);
        
        console.log('🎉 WalletRecharge model is working correctly!');
        
    } catch (error) {
        console.error('❌ Error testing WalletRecharge:', error);
    }
}

// Run the test
testWalletRecharge().then(() => {
    console.log('✅ Test completed');
    process.exit(0);
}).catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
}); 