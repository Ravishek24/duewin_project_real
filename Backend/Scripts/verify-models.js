/**
 * Script to verify model definitions match database schema
 */
const { sequelize } = require('../config/db');
const WalletRecharge = require('../models/WalletRecharge');
const WalletWithdrawal = require('../models/WalletWithdrawal');
const PaymentGateway = require('../models/PaymentGateway');

async function verifyModels() {
  try {
    console.log('Connecting to database...');
    await sequelize.authenticate();
    console.log('Connection established successfully');

    console.log('\nVerifying WalletRecharge model:');
    const [rechargeColumns] = await sequelize.query("DESCRIBE wallet_recharges");
    console.log('Database columns:');
    rechargeColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}, ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });

    console.log('\nModel attributes:');
    const rechargeAttrs = WalletRecharge.rawAttributes;
    for (const [name, attr] of Object.entries(rechargeAttrs)) {
      if (name !== 'createdAt' && name !== 'updatedAt') {
        console.log(`  - ${name} (${attr.field || name}, ${attr.type.constructor.name})`);
      }
    }

    console.log('\nVerifying WalletWithdrawal model:');
    const [withdrawalColumns] = await sequelize.query("DESCRIBE wallet_withdrawals");
    console.log('Database columns:');
    withdrawalColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}, ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });

    console.log('\nModel attributes:');
    const withdrawalAttrs = WalletWithdrawal.rawAttributes;
    for (const [name, attr] of Object.entries(withdrawalAttrs)) {
      if (name !== 'createdAt' && name !== 'updatedAt') {
        console.log(`  - ${name} (${attr.field || name}, ${attr.type.constructor.name})`);
      }
    }

    console.log('\nVerifying PaymentGateway model:');
    const [gatewayColumns] = await sequelize.query("DESCRIBE payment_gateways");
    console.log('Database columns:');
    gatewayColumns.forEach(col => {
      console.log(`  - ${col.Field} (${col.Type}, ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });

    console.log('\nModel attributes:');
    const gatewayAttrs = PaymentGateway.rawAttributes;
    for (const [name, attr] of Object.entries(gatewayAttrs)) {
      if (name !== 'createdAt' && name !== 'updatedAt') {
        console.log(`  - ${name} (${attr.field || name}, ${attr.type.constructor.name})`);
      }
    }

  } catch (error) {
    console.error('Error verifying models:', error);
  } finally {
    await sequelize.close();
  }
}

verifyModels(); 