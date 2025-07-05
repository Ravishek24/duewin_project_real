const { connectDB, getSequelizeInstance } = require('./config/db');
const { getModels } = require('./models/index');

async function addGhPayGateway() {
  let sequelize = null;
  
  try {
    console.log('🔧 Adding GHPAY Payment Gateway');
    console.log('================================');
    
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

    console.log('\n📋 GHPAY Configuration:');
    console.log('========================');
    console.log('Host:', process.env.GHPAY_HOST || 'https://api.ghpay.com');
    console.log('Merchant ID:', process.env.GHPAY_MERCHANT_ID || '❌ NOT SET');
    console.log('Secret Key:', process.env.GHPAY_SECRET_KEY ? '***SET***' : '❌ NOT SET');
    console.log('App ID:', process.env.GHPAY_APP_ID || '❌ NOT SET');

    // Check if GHPAY gateway already exists
    const existingGateway = await PaymentGateway.findOne({
      where: { code: 'GHPAY' }
    });

    if (existingGateway) {
      console.log('\n✅ GHPAY gateway already exists');
      console.log('Gateway ID:', existingGateway.gateway_id);
      console.log('Name:', existingGateway.name);
      console.log('Is Active:', existingGateway.is_active);
      
      // Update to ensure it's active
      await existingGateway.update({
        is_active: true,
        supports_deposit: true,
        supports_withdrawal: true
      });
      console.log('✅ GHPAY gateway updated and activated');
    } else {
      console.log('\n📝 Creating GHPAY gateway...');
      
      const newGateway = await PaymentGateway.create({
        name: 'GH Pay',
        code: 'GHPAY',
        description: 'GH Pay payment gateway for deposits and withdrawals',
        logo_url: '/assets/images/payment/ghpay.png',
        is_active: true,
        supports_deposit: true,
        supports_withdrawal: true,
        min_deposit: 100.00,
        max_deposit: 100000.00,
        min_withdrawal: 500.00,
        max_withdrawal: 50000.00,
        display_order: 10
      });
      
      console.log('✅ GHPAY gateway created successfully');
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
    console.log('1. Set GHPAY environment variables in .env file');
    console.log('2. Test GHPAY connectivity');
    console.log('3. Test deposit and withdrawal flows');
    
    console.log('\n📋 Required Environment Variables:');
    console.log('==================================');
    console.log('GHPAY_HOST=https://api.ghpay.com');
    console.log('GHPAY_MERCHANT_ID=your_merchant_id');
    console.log('GHPAY_SECRET_KEY=your_secret_key');
    console.log('GHPAY_APP_ID=your_app_id');

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

addGhPayGateway().catch(console.error); 