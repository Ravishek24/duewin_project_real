#!/usr/bin/env node

/**
 * Temporarily Disable GHPAY
 * Disables GHPAY payment gateway while account issues are being resolved
 */

// Load environment variables first
require('dotenv').config();

const { sequelize } = require('../config/db');

async function disableGhPayTemporarily() {
    try {
        console.log('🔧 Temporarily disabling GHPAY payment gateway...');
        
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
        
        // Disable GHPAY
        await ghPayGateway.update({
            is_active: false,
            supports_deposit: false,
            supports_withdrawal: false
        });
        
        console.log('✅ GHPAY payment gateway temporarily disabled');
        console.log('Gateway ID:', ghPayGateway.gateway_id);
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
        console.error('❌ Error disabling GHPAY gateway:', error);
    } finally {
        if (sequelize) {
            await sequelize.close();
        }
    }
}

// Run the script
disableGhPayTemporarily().then(() => {
    console.log('\n✅ GHPAY temporary disable completed');
    console.log('\n💡 Next Steps:');
    console.log('1. Contact GHPAY support to resolve account issues');
    console.log('2. Use other payment gateways in the meantime');
    console.log('3. Re-enable GHPAY once account is activated');
    process.exit(0);
}).catch((error) => {
    console.error('\n❌ GHPAY temporary disable failed:', error);
    process.exit(1);
}); 