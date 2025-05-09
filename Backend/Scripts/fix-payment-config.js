/**
 * Script to fix payment gateway configuration
 * Run with: node fix-payment-config.js
 */

const { sequelize } = require('../config/db');
const PaymentGateway = require('../models/PaymentGateway');

async function fixPaymentGateways() {
  console.log('Starting payment gateway configuration fix...');
  
  const t = await sequelize.transaction();
  
  try {
    // Check if OKPAY gateway exists
    const okpayGateway = await PaymentGateway.findOne({
      where: { code: 'OKPAY' },
      transaction: t
    });
    
    if (okpayGateway) {
      console.log('OKPAY gateway found, updating configuration...');
      
      // Update the gateway with dummy credentials for testing
      await okpayGateway.update({
        is_active: true,
        config_data: JSON.stringify({
          mchId: "TEST123",
          key: "TEST_SECRET_KEY",
          host: "https://sandbox.testpay.com"
        })
      }, { transaction: t });
      
      console.log('✅ OKPAY gateway updated successfully');
    } else {
      console.log('OKPAY gateway not found, creating...');
      
      // Create a new gateway with dummy credentials
      await PaymentGateway.create({
        name: 'OKPAY',
        code: 'OKPAY',
        description: 'Test payment gateway for development',
        logo_url: '/assets/images/payment/okpay.png',
        is_active: true,
        supports_deposit: true,
        supports_withdrawal: true,
        min_deposit: 100.00,
        max_deposit: 10000.00,
        min_withdrawal: 500.00,
        max_withdrawal: 5000.00,
        display_order: 1,
        config_data: JSON.stringify({
          mchId: "TEST123",
          key: "TEST_SECRET_KEY",
          host: "https://sandbox.testpay.com"
        })
      }, { transaction: t });
      
      console.log('✅ OKPAY gateway created successfully');
    }
    
    // Commit transaction
    await t.commit();
    console.log('✅ Payment gateway configuration fixed successfully');
    
    // Verify configuration
    const gateways = await PaymentGateway.findAll();
    console.log(`\nActive payment gateways (${gateways.length}):`);
    gateways.forEach(gateway => {
      console.log(`- ${gateway.name} (${gateway.code}): ${gateway.is_active ? 'Active' : 'Inactive'}`);
      if (gateway.config_data) {
        try {
          const config = JSON.parse(gateway.config_data);
          console.log('  Config:', config);
        } catch (e) {
          console.log('  Config: (Invalid JSON)', gateway.config_data);
        }
      }
    });
    
    return true;
  } catch (error) {
    // Rollback transaction on error
    await t.rollback();
    console.error('❌ Error fixing payment gateways:', error);
    return false;
  } finally {
    // Close database connection
    await sequelize.close();
  }
}

// Run if executed directly
if (require.main === module) {
  fixPaymentGateways()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
} 