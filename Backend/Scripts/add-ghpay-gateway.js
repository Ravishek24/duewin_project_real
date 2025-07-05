#!/usr/bin/env node

/**
 * Add GHPAY Payment Gateway
 * Adds GHPAY to the payment gateways table
 */

const { sequelize } = require('../config/db');

async function addGhPayGateway() {
    try {
        console.log('🔧 Adding GHPAY payment gateway...');
        
        // Initialize models properly - wait for async initialization
        const modelsModule = require('../models');
        const models = await modelsModule.getModels();
        const PaymentGateway = models.PaymentGateway;
        
        if (!PaymentGateway) {
            console.error('❌ PaymentGateway model not found');
            return;
        }
        
        console.log('✅ Models initialized successfully');
        
        // Check if GHPAY already exists
        const existingGateway = await PaymentGateway.findOne({
            where: { code: 'GHPAY' }
        });
        
        if (existingGateway) {
            console.log('✅ GHPAY gateway already exists');
            
            // Update it to be active
            await existingGateway.update({
                is_active: true,
                supports_deposit: true,
                supports_withdrawal: true
            });
            
            console.log('✅ GHPAY gateway activated');
            return;
        }
        
        // Create new GHPAY gateway
        const ghPayGateway = await PaymentGateway.create({
            name: 'GHPAY',
            code: 'GHPAY',
            description: 'GHPAY payment gateway for deposits and withdrawals',
            logo_url: '/assets/images/payment/ghpay.png',
            is_active: true,
            supports_deposit: true,
            supports_withdrawal: true,
            min_deposit: 100.00,
            max_deposit: 100000.00,
            min_withdrawal: 500.00,
            max_withdrawal: 50000.00,
            display_order: 4
        });
        
        console.log('✅ GHPAY payment gateway created successfully');
        console.log('Gateway ID:', ghPayGateway.gateway_id);
        
    } catch (error) {
        console.error('❌ Error adding GHPAY gateway:', error);
    } finally {
        if (sequelize) {
            await sequelize.close();
        }
    }
}

// Run the script
addGhPayGateway().then(() => {
    console.log('✅ GHPAY gateway setup completed');
    process.exit(0);
}).catch((error) => {
    console.error('❌ GHPAY gateway setup failed:', error);
    process.exit(1);
}); 