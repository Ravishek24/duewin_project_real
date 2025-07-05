#!/usr/bin/env node

/**
 * Temporarily Disable WOWPAY
 * Disables WOWPAY payment gateway while waiting for correct API documentation
 */

// Load environment variables first
require('dotenv').config();

const { sequelize } = require('../config/db');

async function disableWowPayTemporarily() {
    try {
        console.log('🔧 Temporarily disabling WOWPAY payment gateway...');
        
        // Initialize models properly - wait for async initialization
        const modelsModule = require('../models');
        const models = await modelsModule.getModels();
        const PaymentGateway = models.PaymentGateway;
        
        if (!PaymentGateway) {
            console.error('❌ PaymentGateway model not found');
            return;
        }
        
        console.log('✅ Models initialized successfully');
        
        // Find WOWPAY gateway
        const wowPayGateway = await PaymentGateway.findOne({
            where: { code: 'WOWPAY' }
        });
        
        if (!wowPayGateway) {
            console.log('❌ WOWPAY gateway not found in database');
            return;
        }
        
        // Disable WOWPAY
        await wowPayGateway.update({
            is_active: false,
            supports_deposit: false,
            supports_withdrawal: false
        });
        
        console.log('✅ WOWPAY payment gateway temporarily disabled');
        console.log('Gateway ID:', wowPayGateway.gateway_id);
        console.log('Status: Inactive');
        
        // Show available payment gateways
        const activeGateways = await PaymentGateway.findAll({
            where: { is_active: true },
            attributes: ['name', 'code', 'supports_deposit', 'supports_withdrawal']
        });
        
        console.log('\n📋 Available Payment Gateways:');
        activeGateways.forEach(gateway => {
            console.log(`- ${gateway.name} (${gateway.code})`);
            console.log(`  Deposit: ${gateway.supports_deposit ? '✅' : '❌'}`);
            console.log(`  Withdrawal: ${gateway.supports_withdrawal ? '✅' : '❌'}`);
        });
        
    } catch (error) {
        console.error('❌ Error disabling WOWPAY gateway:', error);
    } finally {
        if (sequelize) {
            await sequelize.close();
        }
    }
}

// Run the script
disableWowPayTemporarily().then(() => {
    console.log('\n✅ WOWPAY temporary disable completed');
    console.log('\n💡 Next Steps:');
    console.log('1. Contact WOWPAY support for correct API documentation');
    console.log('2. Use other payment gateways in the meantime');
    console.log('3. Re-enable WOWPAY once correct API is provided');
    console.log('\n📧 Email WOWPAY Support with:');
    console.log('- Merchant ID: ruNklnM3bncNAzd7');
    console.log('- Issue: No working API endpoints found');
    console.log('- Request: Correct API documentation and endpoints');
    process.exit(0);
}).catch((error) => {
    console.error('\n❌ WOWPAY temporary disable failed:', error);
    process.exit(1);
}); 