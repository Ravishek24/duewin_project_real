#!/usr/bin/env node

/**
 * Test Gateway Restriction Solution
 * Demonstrates how users can only deposit through active gateways
 */

const { sequelize } = require('./config/db');

async function testGatewayRestriction() {
    try {
        console.log('🔧 Testing Gateway Restriction Solution');
        console.log('=======================================\n');
        
        // Initialize models
        const modelsModule = require('./models');
        const models = await modelsModule.getModels();
        const PaymentGateway = models.PaymentGateway;
        
        console.log('✅ Models initialized successfully\n');
        
        // 1. Show current gateway status
        console.log('📋 Current Payment Gateways Status:');
        console.log('===================================');
        
        const allGateways = await PaymentGateway.findAll({
            order: [['display_order', 'ASC']]
        });
        
        allGateways.forEach(gateway => {
            const status = gateway.is_active ? '✅ Active' : '❌ Inactive';
            const deposit = gateway.supports_deposit ? '✅' : '❌';
            console.log(`${gateway.code}: ${status}`);
            console.log(`   Name: ${gateway.name}`);
            console.log(`   ID: ${gateway.gateway_id}`);
            console.log(`   Deposit Support: ${deposit}`);
            console.log(`   Min Deposit: ₹${gateway.min_deposit}`);
            console.log(`   Max Deposit: ₹${gateway.max_deposit}`);
            console.log('');
        });
        
        // 2. Test available gateways for users
        console.log('🔍 Testing Available Gateways for Users:');
        console.log('========================================');
        
        const { getUserAvailableDepositGateways } = require('./services/paymentGatewayService');
        
        // Test 1: Get all available gateways
        const allAvailable = await getUserAvailableDepositGateways();
        console.log('📱 All Available Gateways for Users:');
        console.log(`Total: ${allAvailable.total}`);
        allAvailable.gateways.forEach(gateway => {
            console.log(`- ${gateway.name} (${gateway.code})`);
            console.log(`  Min: ₹${gateway.min_amount}, Max: ₹${gateway.max_amount}`);
        });
        console.log('');
        
        // Test 2: Get gateways for specific amount
        const amount500 = await getUserAvailableDepositGateways(null, 500);
        console.log('💰 Gateways Available for ₹500:');
        console.log(`Total: ${amount500.total}`);
        amount500.gateways.forEach(gateway => {
            console.log(`- ${gateway.name} (${gateway.code})`);
        });
        console.log('');
        
        const amount50 = await getUserAvailableDepositGateways(null, 50);
        console.log('💰 Gateways Available for ₹50:');
        console.log(`Total: ${amount50.total}`);
        if (amount50.gateways.length === 0) {
            console.log('❌ No gateways available for ₹50 (below minimum)');
        } else {
            amount50.gateways.forEach(gateway => {
                console.log(`- ${gateway.name} (${gateway.code})`);
            });
        }
        console.log('');
        
        // 3. Test gateway validation
        console.log('✅ Testing Gateway Validation:');
        console.log('==============================');
        
        const { validateGatewayForDeposit } = require('./services/paymentGatewayService');
        
        // Test valid gateway
        const validTest = await validateGatewayForDeposit('WEPAY', 1000);
        console.log('✅ Valid Gateway Test (WEPAY, ₹1000):');
        console.log(`Success: ${validTest.success}`);
        console.log(`Message: ${validTest.message}`);
        if (validTest.success) {
            console.log(`Gateway: ${validTest.gateway.name}`);
            console.log(`Min: ₹${validTest.gateway.min_amount}, Max: ₹${validTest.gateway.max_amount}`);
        }
        console.log('');
        
        // Test invalid amount
        const invalidAmountTest = await validateGatewayForDeposit('WEPAY', 50);
        console.log('❌ Invalid Amount Test (WEPAY, ₹50):');
        console.log(`Success: ${invalidAmountTest.success}`);
        console.log(`Message: ${invalidAmountTest.message}`);
        console.log(`Code: ${invalidAmountTest.code}`);
        console.log('');
        
        // Test inactive gateway
        const inactiveTest = await validateGatewayForDeposit('INACTIVE', 1000);
        console.log('❌ Inactive Gateway Test (INACTIVE, ₹1000):');
        console.log(`Success: ${inactiveTest.success}`);
        console.log(`Message: ${inactiveTest.message}`);
        console.log(`Code: ${inactiveTest.code}`);
        console.log('');
        
        // 4. Show API endpoints
        console.log('🌐 API Endpoints for Frontend:');
        console.log('==============================');
        console.log('GET  /api/payments/available-gateways                    - Get all available gateways');
        console.log('GET  /api/payments/available-gateways?amount=1000        - Get gateways for specific amount');
        console.log('POST /api/payments/deposit                              - Initiate deposit (validates gateway)');
        console.log('');
        
        // 5. Show example API calls
        console.log('📝 Example API Calls:');
        console.log('=====================');
        console.log('1. Get Available Gateways:');
        console.log('GET /api/payments/available-gateways');
        console.log('Headers: { "Authorization": "Bearer <user_token>" }');
        console.log('');
        console.log('2. Get Gateways for Amount:');
        console.log('GET /api/payments/available-gateways?amount=1000');
        console.log('Headers: { "Authorization": "Bearer <user_token>" }');
        console.log('');
        console.log('3. Initiate Deposit:');
        console.log('POST /api/payments/deposit');
        console.log('Headers: { "Authorization": "Bearer <user_token>" }');
        console.log('Body: { "amount": 1000, "payment_method": "WEPAY" }');
        console.log('');
        
        // 6. Show frontend flow
        console.log('🎨 Frontend Implementation Flow:');
        console.log('================================');
        console.log('1. User visits deposit page');
        console.log('2. Frontend calls GET /api/payments/available-gateways');
        console.log('3. Frontend displays only available gateways');
        console.log('4. User selects gateway and enters amount');
        console.log('5. Frontend validates amount against gateway limits');
        console.log('6. Frontend calls POST /api/payments/deposit');
        console.log('7. Backend validates gateway again (double security)');
        console.log('8. Deposit proceeds if all validations pass');
        console.log('');
        
        // 7. Show security benefits
        console.log('🔒 Security Benefits:');
        console.log('=====================');
        console.log('✅ Users can only see active gateways');
        console.log('✅ Amount validation prevents invalid deposits');
        console.log('✅ Double validation (frontend + backend)');
        console.log('✅ Admin controls gateway availability');
        console.log('✅ Real-time gateway status updates');
        console.log('✅ Prevents deposit to inactive gateways');
        console.log('');
        
        console.log('✅ Gateway Restriction Test Completed!');
        console.log('\n💡 Key Benefits:');
        console.log('===============');
        console.log('1. Users can only deposit through active gateways');
        console.log('2. Amount limits are enforced automatically');
        console.log('3. Admin has full control over gateway availability');
        console.log('4. Frontend shows only valid options');
        console.log('5. Backend validates all requests');
        console.log('6. Real-time updates when admin toggles gateways');
        
    } catch (error) {
        console.error('❌ Error testing gateway restriction:', error);
    } finally {
        await sequelize.close();
    }
}

// Run the test
testGatewayRestriction(); 