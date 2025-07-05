const { connectDB, getSequelizeInstance } = require('./config/db');
const { getModels } = require('./models/index');

async function addPpayProGateway() {
  let sequelize = null;
  
  try {
    console.log('🔧 Adding PPAYPRO Payment Gateway');
    console.log('==================================');
    
    console.log('🔗 Connecting to database...');
    
    // Initialize database connection
    await connectDB();
    sequelize = await getSequelizeInstance();
    
    console.log('✅ Database connected successfully');

    // Initialize models
    console.log('🔄 Initializing models...');
    const models = await getModels();
    const PaymentGateway = models.PaymentGateway;
    
    console.log('✅ Models initialized successfully');

    console.log('\n📋 PPAYPRO Configuration:');
    console.log('==========================');
    console.log('Host:', process.env.PPAYPRO_HOST || 'https://pay.ppaypros.com');
    console.log('Merchant No:', process.env.PPAYPRO_MCH_NO || '❌ NOT SET');
    console.log('App ID:', process.env.PPAYPRO_APP_ID || '❌ NOT SET');
    console.log('Key:', process.env.PPAYPRO_KEY ? '***SET***' : '❌ NOT SET');

    // Check if PPAYPRO gateway already exists
    const existingGateway = await PaymentGateway.findOne({
      where: { code: 'PPAYPRO' }
    });

    if (existingGateway) {
      console.log('\n✅ PPAYPRO gateway already exists');
      console.log('Gateway ID:', existingGateway.gateway_id);
      console.log('Name:', existingGateway.name);
      console.log('Is Active:', existingGateway.is_active);
      
      // Update to ensure it's active
      await existingGateway.update({
        is_active: true,
        supports_deposit: true,
        supports_withdrawal: true
      });
      console.log('✅ PPAYPRO gateway updated and activated');
    } else {
      console.log('\n📝 Creating PPAYPRO gateway...');
      
      const newGateway = await PaymentGateway.create({
        name: 'PPayPro',
        code: 'PPAYPRO',
        description: 'PPayPro payment gateway for deposits and withdrawals',
        logo_url: '/assets/images/payment/ppaypro.png',
        is_active: true,
        supports_deposit: true,
        supports_withdrawal: true,
        min_deposit: 100.00,
        max_deposit: 100000.00,
        min_withdrawal: 500.00,
        max_withdrawal: 50000.00,
        display_order: 9
      });
      
      console.log('✅ PPAYPRO gateway created successfully');
      console.log('Gateway ID:', newGateway.gateway_id);
    }

    // List all active gateways
    console.log('\n📋 All Active Payment Gateways:');
    const activeGateways = await PaymentGateway.findAll({
      where: { is_active: true },
      order: [['display_order', 'ASC']]
    });

    activeGateways.forEach(gateway => {
      console.log(`- ${gateway.name} (${gateway.code}) - ID: ${gateway.gateway_id}`);
    });

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
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    if (sequelize) {
      try {
        await sequelize.close();
        console.log('\n🔌 Database connection closed');
      } catch (closeError) {
        console.warn('⚠️ Error closing connection:', closeError.message);
      }
    }
  }
}

addPpayProGateway().catch(console.error); 