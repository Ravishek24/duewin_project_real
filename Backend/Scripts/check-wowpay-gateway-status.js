const { sequelize } = require('../config/db');

async function checkWowPayGatewayStatus() {
    try {
        console.log('🔍 Checking WOWPAY Gateway Status in Database...\n');

        // Initialize models
        const modelsModule = require('../models');
        const models = await modelsModule.getModels();
        const PaymentGateway = models.PaymentGateway;

        if (!PaymentGateway) {
            console.error('❌ PaymentGateway model not found');
            return;
        }

        // Check if WOWPAY gateway exists
        const wowPayGateway = await PaymentGateway.findOne({
            where: { code: 'WOWPAY' }
        });

        if (!wowPayGateway) {
            console.log('❌ WOWPAY gateway not found in database');
            console.log('💡 Run: node scripts/add-wowpay-gateway.js');
            return;
        }

        console.log('✅ WOWPAY gateway found in database');
        console.log(`   Gateway ID: ${wowPayGateway.gateway_id}`);
        console.log(`   Name: ${wowPayGateway.name}`);
        console.log(`   Code: ${wowPayGateway.code}`);
        console.log(`   Active: ${wowPayGateway.is_active ? '✅ Yes' : '❌ No'}`);
        console.log(`   Supports Deposit: ${wowPayGateway.supports_deposit ? '✅ Yes' : '❌ No'}`);
        console.log(`   Supports Withdrawal: ${wowPayGateway.supports_withdrawal ? '✅ Yes' : '❌ No'}`);
        console.log(`   Min Deposit: ${wowPayGateway.min_deposit}`);
        console.log(`   Max Deposit: ${wowPayGateway.max_deposit}`);
        console.log(`   Min Withdrawal: ${wowPayGateway.min_withdrawal}`);
        console.log(`   Max Withdrawal: ${wowPayGateway.max_withdrawal}`);
        console.log(`   Display Order: ${wowPayGateway.display_order}`);

        // Check if gateway is active
        if (!wowPayGateway.is_active) {
            console.log('\n⚠️  WOWPAY gateway is not active!');
            console.log('💡 To activate, run: node scripts/add-wowpay-gateway.js');
        }

        // Check if supports both deposit and withdrawal
        if (!wowPayGateway.supports_deposit || !wowPayGateway.supports_withdrawal) {
            console.log('\n⚠️  WOWPAY gateway does not support both deposit and withdrawal!');
            console.log('💡 To fix, run: node scripts/add-wowpay-gateway.js');
        }

        // Check other payment gateways for comparison
        console.log('\n📊 Other Payment Gateways:');
        const allGateways = await PaymentGateway.findAll({
            where: { is_active: true },
            order: [['display_order', 'ASC']]
        });

        allGateways.forEach(gateway => {
            console.log(`   ${gateway.code}: ${gateway.is_active ? '✅ Active' : '❌ Inactive'} | Deposit: ${gateway.supports_deposit ? '✅' : '❌'} | Withdrawal: ${gateway.supports_withdrawal ? '✅' : '❌'}`);
        });

        console.log('\n✅ Database check complete!');

    } catch (error) {
        console.error('❌ Error checking WOWPAY gateway status:', error.message);
    } finally {
        await sequelize.close();
    }
}

// Run the check
checkWowPayGatewayStatus().catch(console.error); 