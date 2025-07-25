const { connectDB, getSequelizeInstance } = require('./config/db');
const { getModels } = require('./models/index');

async function addSolPayGateway() {
  let sequelize = null;
  
  try {
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

    // Check if SOLPAY gateway already exists
    const existingGateway = await PaymentGateway.findOne({
      where: { code: 'SOLPAY' }
    });

    if (existingGateway) {
      console.log('✅ SOLPAY gateway already exists');
      console.log('Gateway ID:', existingGateway.gateway_id);
      console.log('Name:', existingGateway.name);
      console.log('Is Active:', existingGateway.is_active);
      
      // Update to ensure it's active
      await existingGateway.update({
        is_active: true,
        supports_deposit: true,
        supports_withdrawal: true
      });
      console.log('✅ SOLPAY gateway updated and activated');
    } else {
      console.log('📝 Creating SOLPAY gateway...');
      
      const newGateway = await PaymentGateway.create({
        name: 'SolPay',
        code: 'SOLPAY',
        description: 'SolPay payment gateway for deposits and withdrawals',
        logo_url: '/assets/images/payment/solpay.png',
        is_active: true,
        supports_deposit: true,
        supports_withdrawal: true,
        min_deposit: 100.00,
        max_deposit: 100000.00,
        min_withdrawal: 500.00,
        max_withdrawal: 50000.00,
        display_order: 9
      });
      
      console.log('✅ SOLPAY gateway created successfully');
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

addSolPayGateway().catch(console.error); 