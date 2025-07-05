const { sequelize } = require('./config/db');
const PaymentGateway = require('./models/PaymentGateway');
require('dotenv').config();

console.log('🔧 Adding PPAYPRO Payment Gateway');
console.log('==================================');

async function addPpayProGateway() {
  const t = await sequelize.transaction();
  
  try {
    console.log('\n📋 PPAYPRO Configuration:');
    console.log('==========================');
    console.log('Host:', process.env.PPAYPRO_HOST || 'https://pay.ppaypros.com');
    console.log('Merchant No:', process.env.PPAYPRO_MCH_NO || '❌ NOT SET');
    console.log('App ID:', process.env.PPAYPRO_APP_ID || '❌ NOT SET');
    console.log('Key:', process.env.PPAYPRO_KEY ? '***SET***' : '❌ NOT SET');
    
    // Check if PPAYPRO already exists
    const existingGateway = await PaymentGateway.findOne({
      where: { code: 'PPAYPRO' },
      transaction: t
    });
    
    if (existingGateway) {
      console.log('\n⚠️  PPAYPRO gateway already exists!');
      console.log('Gateway ID:', existingGateway.gateway_id);
      console.log('Status:', existingGateway.is_active ? '✅ Active' : '❌ Inactive');
      
      // Update if needed
      const updateNeeded = !existingGateway.is_active;
      if (updateNeeded) {
        await PaymentGateway.update(
          { is_active: true },
          { where: { code: 'PPAYPRO' }, transaction: t }
        );
        console.log('✅ Updated PPAYPRO gateway to active status');
      }
      
      await t.commit();
      return existingGateway;
    }
    
    // Create new PPAYPRO gateway
    const ppayProGateway = await PaymentGateway.create({
      code: 'PPAYPRO',
      name: 'PPayPro',
      description: 'PPayPro Payment Gateway',
      is_active: true,
      config: {
        host: process.env.PPAYPRO_HOST || 'https://pay.ppaypros.com',
        mchNo: process.env.PPAYPRO_MCH_NO,
        appId: process.env.PPAYPRO_APP_ID,
        key: process.env.PPAYPRO_KEY
      },
      created_at: new Date(),
      updated_at: new Date()
    }, { transaction: t });
    
    console.log('\n✅ PPAYPRO gateway created successfully!');
    console.log('Gateway ID:', ppayProGateway.gateway_id);
    console.log('Code:', ppayProGateway.code);
    console.log('Name:', ppayProGateway.name);
    console.log('Status:', ppayProGateway.is_active ? '✅ Active' : '❌ Inactive');
    
    await t.commit();
    return ppayProGateway;
    
  } catch (error) {
    await t.rollback();
    console.error('\n❌ Error adding PPAYPRO gateway:', error.message);
    throw error;
  }
}

async function main() {
  try {
    console.log('🔍 Node.js Version:', process.version);
    console.log('🔍 Database Connection: Testing...');
    
    // Initialize database connection
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');
    
    // Sync models to ensure tables exist
    await sequelize.sync({ alter: false });
    console.log('✅ Database models synced');
    
    // Add PPAYPRO gateway
    const gateway = await addPpayProGateway();
    
    console.log('\n📋 Summary:');
    console.log('===========');
    console.log('✅ PPAYPRO gateway added/updated successfully');
    console.log('Gateway ID:', gateway.gateway_id);
    console.log('Code:', gateway.code);
    console.log('Status:', gateway.is_active ? 'Active' : 'Inactive');
    
    console.log('\n💡 Next Steps:');
    console.log('==============');
    console.log('1. Set PPAYPRO environment variables in .env file');
    console.log('2. Test PPAYPRO connectivity');
    console.log('3. Test deposit and withdrawal flows');
    
    console.log('\n📋 Required Environment Variables:');
    console.log('==================================');
    console.log('PPAYPRO_HOST=https://pay.ppaypros.com');
    console.log('PPAYPRO_MCH_NO=your_merchant_number');
    console.log('PPAYPRO_APP_ID=your_app_id');
    console.log('PPAYPRO_KEY=your_secret_key');
    
  } catch (error) {
    console.error('\n❌ Failed to add PPAYPRO gateway:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  } finally {
    if (sequelize) {
      await sequelize.close();
    }
  }
}

main(); 