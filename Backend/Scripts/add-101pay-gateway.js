// Script to add 101pay gateway to the PaymentGateway table
const { getModels, initializeModels } = require('../models');
const { getSequelizeInstance } = require('../config/db');

async function add101PayGateway() {
  try {
    // Initialize all models and get the initialized models object
    await initializeModels();
    const { PaymentGateway } = await getModels();
    const sequelize = await getSequelizeInstance();

    await sequelize.authenticate();
    console.log('Connected to database.');

    const code = '101PAY';
    const name = '101pay';
    const description = '101pay payment gateway integration';
    const is_active = true;
    const supports_deposit = true;
    const supports_withdrawal = true;
    const min_deposit = 100.00;
    const max_deposit = 100000.00;
    const min_withdrawal = 500.00;
    const max_withdrawal = 50000.00;
    const display_order = 10;

    // Check if already exists
    const existing = await PaymentGateway.findOne({ where: { code } });
    if (existing) {
      console.log('101pay gateway already exists.');
      process.exit(0);
    }

    await PaymentGateway.create({
      name,
      code,
      description,
      is_active,
      supports_deposit,
      supports_withdrawal,
      min_deposit,
      max_deposit,
      min_withdrawal,
      max_withdrawal,
      display_order
    });
    console.log('101pay gateway added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error adding 101pay gateway:', error);
    process.exit(1);
  }
}

add101PayGateway(); 