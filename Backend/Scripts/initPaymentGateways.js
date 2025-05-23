// Script to initialize default payment gateways
const { sequelize } = require('../config/db');
const PaymentGateway = require('../models/PaymentGateway');

async function initializePaymentGateways() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Connected to database successfully.');

    // Check if default gateways exist
    console.log('Checking existing payment gateways...');
    const existingCount = await PaymentGateway.count();
    
    if (existingCount > 0) {
      console.log(`${existingCount} payment gateways already exist.`);
      
      // Ensure OKPAY exists
      const okpay = await PaymentGateway.findOne({
        where: { code: 'OKPAY' }
      });
      
      if (!okpay) {
        console.log('Creating OKPAY gateway...');
        await PaymentGateway.create({
          name: 'OKPAY',
          code: 'OKPAY',
          description: 'Original payment gateway integration',
          is_active: true,
          supports_deposit: true,
          supports_withdrawal: true,
          min_deposit: 100.00,
          max_deposit: 100000.00,
          min_withdrawal: 500.00,
          max_withdrawal: 50000.00,
          display_order: 1
        });
        console.log('OKPAY gateway created successfully.');
      } else {
        console.log('OKPAY gateway already exists.');
      }
      
      return;
    }
    
    // Create default gateways
    console.log('Creating default payment gateways...');
    await PaymentGateway.bulkCreate([
      {
        name: 'OKPAY',
        code: 'OKPAY',
        description: 'Original payment gateway integration',
        is_active: true,
        supports_deposit: true,
        supports_withdrawal: true,
        min_deposit: 100.00,
        max_deposit: 100000.00,
        min_withdrawal: 500.00,
        max_withdrawal: 50000.00,
        display_order: 1
      },
      {
        name: 'WePayGlobal',
        code: 'WEPAY',
        description: 'International payment gateway with multiple options',
        is_active: true,
        supports_deposit: true,
        supports_withdrawal: true,
        min_deposit: 100.00,
        max_deposit: 100000.00,
        min_withdrawal: 500.00,
        max_withdrawal: 50000.00,
        display_order: 2
      },
      {
        name: 'MxPay',
        code: 'MXPAY',
        description: 'MxPay payment gateway',
        is_active: true,
        supports_deposit: true,
        supports_withdrawal: true,
        min_deposit: 100.00,
        max_deposit: 100000.00,
        min_withdrawal: 500.00,
        max_withdrawal: 50000.00,
        display_order: 3
      }
    ]);
    
    console.log('Default payment gateways created successfully.');
  } catch (error) {
    console.error('Error initializing payment gateways:', error);
  } finally {
    await sequelize.close();
  }
}

// Run the initialization function
initializePaymentGateways(); 