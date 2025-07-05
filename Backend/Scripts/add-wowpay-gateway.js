#!/usr/bin/env node

/**
 * Add WOWPAY Payment Gateway
 * Adds WOWPAY to the payment gateways table
 */

// Load environment variables first
require('dotenv').config();

const { sequelize } = require('../config/db');

async function addWowPayGateway() {
    try {
        console.log('🔧 Adding WOWPAY payment gateway...');
        
        // Initialize models properly - wait for async initialization
        const modelsModule = require('../models');
        const models = await modelsModule.getModels();
        const PaymentGateway = models.PaymentGateway;
        
        if (!PaymentGateway) {
            console.error('❌ PaymentGateway model not found');
            return;
        }
        
        console.log('✅ Models initialized successfully');
        
        // Check if WOWPAY already exists
        const existingGateway = await PaymentGateway.findOne({
            where: { code: 'WOWPAY' }
        });
        
        if (existingGateway) {
            console.log('✅ WOWPAY gateway already exists');
            
            // Update it to be active
            await existingGateway.update({
                is_active: true,
                supports_deposit: true,
                supports_withdrawal: true
            });
            
            console.log('✅ WOWPAY gateway activated');
            console.log('Gateway ID:', existingGateway.gateway_id);
            return;
        }
        
        // Create new WOWPAY gateway
        const wowPayGateway = await PaymentGateway.create({
            name: 'WOWPAY',
            code: 'WOWPAY',
            description: 'WOWPAY payment gateway for deposits and withdrawals',
            logo_url: '/assets/images/payment/wowpay.png',
            is_active: true,
            supports_deposit: true,
            supports_withdrawal: true,
            min_deposit: 100.00,
            max_deposit: 100000.00,
            min_withdrawal: 500.00,
            max_withdrawal: 50000.00,
            display_order: 5
        });
        
        console.log('✅ WOWPAY payment gateway created successfully');
        console.log('Gateway ID:', wowPayGateway.gateway_id);
        
    } catch (error) {
        console.error('❌ Error adding WOWPAY gateway:', error);
    } finally {
        if (sequelize) {
            await sequelize.close();
        }
    }
}

// Run the script
addWowPayGateway().then(() => {
    console.log('✅ WOWPAY gateway setup completed');
    process.exit(0);
}).catch((error) => {
    console.error('❌ WOWPAY gateway setup failed:', error);
    process.exit(1);
}); 