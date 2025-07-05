#!/usr/bin/env node

/**
 * Check Payment Gateways
 * Verifies all payment gateways are properly configured
 */

const { sequelize } = require('../config/db');
const PaymentGateway = require('../models/PaymentGateway');

async function checkPaymentGateways() {
    try {
        console.log('🔍 Checking payment gateways...');
        
        // Get all payment gateways
        const gateways = await PaymentGateway.findAll({
            order: [['display_order', 'ASC']]
        });
        
        console.log('\n📊 Payment Gateways Status:');
        console.log('============================');
        
        if (gateways.length === 0) {
            console.log('❌ No payment gateways found in database');
            return;
        }
        
        gateways.forEach(gateway => {
            const status = gateway.is_active ? '✅ Active' : '❌ Inactive';
            console.log(`${gateway.code}: ${status}`);
            console.log(`   Name: ${gateway.name}`);
            console.log(`   ID: ${gateway.gateway_id}`);
            console.log(`   Deposit: ${gateway.supports_deposit ? '✅' : '❌'}`);
            console.log(`   Withdrawal: ${gateway.supports_withdrawal ? '✅' : '❌'}`);
            console.log(`   Min Deposit: ${gateway.min_deposit}`);
            console.log(`   Max Deposit: ${gateway.max_deposit}`);
            console.log('');
        });
        
        // Check for missing gateways
        const expectedGateways = ['OKPAY', 'WEPAY', 'MXPAY', 'GHPAY', 'WOWPAY', 'PPAYPRO', 'SOLPAY', 'LPAY'];
        const existingCodes = gateways.map(g => g.code);
        const missingGateways = expectedGateways.filter(code => !existingCodes.includes(code));
        
        if (missingGateways.length > 0) {
            console.log('⚠️ Missing payment gateways:');
            missingGateways.forEach(code => {
                console.log(`   - ${code}`);
            });
        }
        
        // Check for inactive gateways
        const inactiveGateways = gateways.filter(g => !g.is_active);
        if (inactiveGateways.length > 0) {
            console.log('\n⚠️ Inactive payment gateways:');
            inactiveGateways.forEach(gateway => {
                console.log(`   - ${gateway.code} (${gateway.name})`);
            });
        }
        
        console.log('\n✅ Payment gateway check completed');
        
    } catch (error) {
        console.error('❌ Error checking payment gateways:', error);
    } finally {
        await sequelize.close();
    }
}

// Run the check
checkPaymentGateways().then(() => {
    console.log('✅ Check completed');
    process.exit(0);
}).catch((error) => {
    console.error('❌ Check failed:', error);
    process.exit(1);
}); 