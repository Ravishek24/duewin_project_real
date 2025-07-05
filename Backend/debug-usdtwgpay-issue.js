const { connectDB, getSequelizeInstance } = require('./config/db');
const { getModels } = require('./models/index');

async function debugUsdtwgPayIssue() {
  let sequelize = null;
  
  try {
    console.log('🔍 DEBUGGING USDT WG PAY ISSUE');
    console.log('='.repeat(50));
    
    // Initialize database connection
    await connectDB();
    sequelize = await getSequelizeInstance();
    
    console.log('✅ Database connected successfully');

    // Initialize models
    const models = await getModels();
    const PaymentGateway = models.PaymentGateway;
    
    console.log('✅ Models initialized successfully');

    // Check if USDTWGPAY gateway exists
    console.log('\n📋 Checking USDTWGPAY gateway in database...');
    const usdtwgPayGateway = await PaymentGateway.findOne({
      where: { code: 'USDTWGPAY' }
    });

    if (usdtwgPayGateway) {
      console.log('✅ USDTWGPAY gateway found:');
      console.log('  - Gateway ID:', usdtwgPayGateway.gateway_id);
      console.log('  - Name:', usdtwgPayGateway.name);
      console.log('  - Code:', usdtwgPayGateway.code);
      console.log('  - Is Active:', usdtwgPayGateway.is_active);
      console.log('  - Supports Deposit:', usdtwgPayGateway.supports_deposit);
      console.log('  - Supports Withdrawal:', usdtwgPayGateway.supports_withdrawal);
    } else {
      console.log('❌ USDTWGPAY gateway NOT found in database');
    }

    // List all gateways to see what's available
    console.log('\n📋 All Payment Gateways:');
    const allGateways = await PaymentGateway.findAll({
      order: [['display_order', 'ASC']]
    });

    allGateways.forEach(gateway => {
      console.log(`  - ${gateway.name} (${gateway.code}) - ID: ${gateway.gateway_id} - Active: ${gateway.is_active}`);
    });

    // Check for case sensitivity issues
    console.log('\n🔍 Checking for case sensitivity issues...');
    const usdtwgpayLower = await PaymentGateway.findOne({
      where: { code: 'usdtwgpay' }
    });
    
    const usdtwgpayUpper = await PaymentGateway.findOne({
      where: { code: 'USDTWGPAY' }
    });

    console.log('  - usdtwgpay (lowercase):', usdtwgpayLower ? 'Found' : 'Not found');
    console.log('  - USDTWGPAY (uppercase):', usdtwgpayUpper ? 'Found' : 'Not found');

    // Test the exact request that would be sent
    console.log('\n🧪 Testing request parameters...');
    const testRequest = {
      amount: 1000,
      gateway: 'USDTWGPAY',
      pay_type: 'USDT'
    };
    
    console.log('Request body:', JSON.stringify(testRequest, null, 2));
    console.log('Gateway parameter:', `"${testRequest.gateway}"`);
    console.log('Gateway parameter length:', testRequest.gateway.length);
    console.log('Gateway parameter type:', typeof testRequest.gateway);

    // Check if there are any whitespace issues
    console.log('Gateway trimmed:', `"${testRequest.gateway.trim()}"`);
    console.log('Gateway toUpperCase():', `"${testRequest.gateway.toUpperCase()}"`);
    console.log('Gateway toLowerCase():', `"${testRequest.gateway.toLowerCase()}"`);

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

// Run the debug function
debugUsdtwgPayIssue(); 