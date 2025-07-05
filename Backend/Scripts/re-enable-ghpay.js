#!/usr/bin/env node

/**
 * Re-enable GHPAY
 * Re-enables GHPAY payment gateway after account issues are resolved
 */

// Load environment variables first
require('dotenv').config();

const { sequelize } = require('../config/db');

async function reEnableGhPay() {
    try {
        console.log('🔧 Re-enabling GHPAY payment gateway...');
        
        // Initialize models properly - wait for async initialization
        const modelsModule = require('../models');
        const models = await modelsModule.getModels();
        const PaymentGateway = models.PaymentGateway;
        
        if (!PaymentGateway) {
            console.error('❌ PaymentGateway model not found');
            return;
        }
        
        console.log('✅ Models initialized successfully');
        
        // Find GHPAY gateway
        const ghPayGateway = await PaymentGateway.findOne({
            where: { code: 'GHPAY' }
        });
        
        if (!ghPayGateway) {
            console.log('❌ GHPAY gateway not found in database');
            return;
        }
        
        // Re-enable GHPAY
        await ghPayGateway.update({
            is_active: true,
            supports_deposit: true,
            supports_withdrawal: true
        });
        
        console.log('✅ GHPAY payment gateway re-enabled');
        console.log('Gateway ID:', ghPayGateway.gateway_id);
        console.log('Status: Active');
        
        // Test the connection
        console.log('\n🧪 Testing GHPAY connection...');
        const { testGhPayConnection } = require('./test-ghpay-connection');
        await testGhPayConnection();
        
    } catch (error) {
        console.error('❌ Error re-enabling GHPAY gateway:', error);
    } finally {
        if (sequelize) {
            await sequelize.close();
        }
    }
}

// Run the script
reEnableGhPay().then(() => {
    console.log('\n✅ GHPAY re-enable completed');
    process.exit(0);
}).catch((error) => {
    console.error('\n❌ GHPAY re-enable failed:', error);
    process.exit(1);
}); 