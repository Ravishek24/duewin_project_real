const wowPayConfig = require('./config/wowPayConfig');

// Initialize database connection first
async function initializeDatabase() {
    try {
        const { waitForDatabase } = require('./config/db');
        await waitForDatabase();
        console.log('✅ Database connection initialized');
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        throw error;
    }
}

// Import service after database is ready
let createWowPayDepositOrder;

async function testApiWowPay() {
    console.log('🧪 Testing WowPay API Call (Simulating Server)');
    console.log('===============================================');
    
    // Initialize database and import service
    await initializeDatabase();
    const wowPayService = require('./services/wowPayService');
    createWowPayDepositOrder = wowPayService.createWowPayDepositOrder;
    
    // Debug config first
    console.log('Config being used:');
    console.log('- mchId:', wowPayConfig.mchId);
    console.log('- key:', wowPayConfig.key ? wowPayConfig.key.substring(0, 10) + '...' : 'undefined');
    console.log('- host:', wowPayConfig.host);
    console.log('- signType:', wowPayConfig.signType);
    
    // Simulate the exact call your API makes
    const userId = 1;
    const orderId = `PIWOW${Date.now()}${userId}`;
    const params = {
        amount: "1000.00"
    };
    const notifyUrl = 'https://api.strikecolor1.com/api/payments/wowpay/payin-callback';
    const gatewayId = 1;
    
    console.log('\nParameters:');
    console.log('- userId:', userId);
    console.log('- orderId:', orderId);
    console.log('- params:', params);
    console.log('- notifyUrl:', notifyUrl);
    console.log('- gatewayId:', gatewayId);
    
    try {
        console.log('\n📤 Calling createWowPayDepositOrder...');
        const result = await createWowPayDepositOrder(userId, orderId, params, notifyUrl, gatewayId);
        
        console.log('\n📥 Result:');
        console.log(JSON.stringify(result, null, 2));
        
        if (result.success) {
            console.log('\n✅ SUCCESS');
        } else {
            console.log('\n❌ FAILED');
            if (result.errorCode === 102) {
                console.log('💡 Error 102 "商户不存在" suggests:');
                console.log('- Environment variables not loaded correctly');
                console.log('- Wrong merchant ID being used');
                console.log('- Config fallback values being used');
            }
        }
        
    } catch (error) {
        console.log('\n❌ ERROR:', error.message);
        console.log('Stack:', error.stack);
    }
}

testApiWowPay().catch(console.error); 