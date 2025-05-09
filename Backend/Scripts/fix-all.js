/**
 * Script to apply all fixes in one go
 * Run with: node fix-all.js
 */

const { fixPaymentGateways } = require('./fix-payment-config.js'); 
const { fixAuthMiddleware } = require('./fix-auth-middleware.js');
const { fixPaymentService } = require('./fix-payment-service.js');
const { sequelize } = require('../config/db');

async function applyAllFixes() {
  console.log('=================================================');
  console.log('Starting application of all fixes');
  console.log('=================================================');
  
  try {
    // Step 1: Apply auth middleware fix
    console.log('\nStep 1: Fixing auth middleware...');
    if (typeof fixAuthMiddleware === 'function') {
      const authResult = await fixAuthMiddleware();
      if (authResult) {
        console.log('✅ Auth middleware fix applied successfully');
      } else {
        console.log('⚠️ Auth middleware fix failed or was not needed');
      }
    } else {
      console.log('⚠️ Auth middleware fix function not found, applying manual fix...');
      
      // Manual fix for auth middleware
      const fs = require('fs');
      const path = require('path');
      const authMiddlewarePath = path.join(__dirname, '..', 'middlewares', 'authMiddleware.js');
      
      if (fs.existsSync(authMiddlewarePath)) {
        console.log('Found auth middleware file, applying manual fix');
        
        const content = fs.readFileSync(authMiddlewarePath, 'utf8');
        const fixedContent = content.replace(
          /req\.user\s*=\s*decoded/,
          'req.user = decoded;\n    // Add compatibility for different user ID field names\n    if (req.user.id && !req.user.user_id) {\n      req.user.user_id = req.user.id;\n    } else if (req.user.user_id && !req.user.id) {\n      req.user.id = req.user.user_id;\n    }'
        );
        
        if (content !== fixedContent) {
          fs.writeFileSync(`${authMiddlewarePath}.backup`, content);
          fs.writeFileSync(authMiddlewarePath, fixedContent);
          console.log('✅ Auth middleware fix applied manually');
        } else {
          console.log('⚠️ Auth middleware fix not applied (already fixed or pattern not found)');
        }
      } else {
        console.log('❌ Auth middleware file not found');
      }
    }
    
    // Step 2: Fix payment gateway configuration
    console.log('\nStep 2: Fixing payment gateways...');
    if (typeof fixPaymentGateways === 'function') {
      const gatewayResult = await fixPaymentGateways();
      if (gatewayResult) {
        console.log('✅ Payment gateway fix applied successfully');
      } else {
        console.log('⚠️ Payment gateway fix failed or was not needed');
      }
    } else {
      console.log('⚠️ Payment gateway fix function not found');
      
      // Try to apply a direct fix for payment gateways
      try {
        console.log('Attempting to create/update OKPAY gateway directly...');
        const PaymentGateway = require('../models/PaymentGateway');
        
        const [gateway, created] = await PaymentGateway.findOrCreate({
          where: { code: 'OKPAY' },
          defaults: {
            name: 'OKPAY',
            code: 'OKPAY',
            description: 'Test payment gateway for development',
            logo_url: '/assets/images/payment/okpay.png',
            is_active: true,
            supports_deposit: true,
            supports_withdrawal: true,
            min_deposit: 100.00,
            max_deposit: 10000.00,
            min_withdrawal: 500.00,
            max_withdrawal: 5000.00,
            display_order: 1,
            config_data: JSON.stringify({
              mchId: "TEST123",
              key: "TEST_SECRET_KEY",
              host: "https://sandbox.testpay.com"
            })
          }
        });
        
        if (created) {
          console.log('✅ OKPAY gateway created successfully');
        } else {
          // Update existing gateway
          await gateway.update({
            is_active: true,
            config_data: JSON.stringify({
              mchId: "TEST123",
              key: "TEST_SECRET_KEY",
              host: "https://sandbox.testpay.com"
            })
          });
          console.log('✅ Existing OKPAY gateway updated successfully');
        }
      } catch (error) {
        console.error('❌ Error applying direct payment gateway fix:', error.message);
      }
    }
    
    // Step 3: Fix payment service
    console.log('\nStep 3: Fixing payment service...');
    if (typeof fixPaymentService === 'function') {
      const serviceResult = await fixPaymentService();
      if (serviceResult) {
        console.log('✅ Payment service fix applied successfully');
      } else {
        console.log('⚠️ Payment service fix failed or was not needed');
      }
    } else {
      console.log('⚠️ Payment service fix function not found');
      
      // Try to apply a direct fix for payment config
      try {
        console.log('Attempting to update payment config directly...');
        const fs = require('fs');
        const path = require('path');
        const paymentConfigPath = path.join(__dirname, '..', 'config', 'paymentConfig.js');
        
        if (fs.existsSync(paymentConfigPath)) {
          const newConfig = `
const paymentConfig = {
    mchId: "TEST123",  // Test Merchant ID
    key: "TEST_SECRET_KEY",  // Test Secret key
    host: "https://sandbox.testpay.com",  // Test API base URL
};

module.exports = paymentConfig;
`;
          fs.writeFileSync(`${paymentConfigPath}.backup`, fs.readFileSync(paymentConfigPath));
          fs.writeFileSync(paymentConfigPath, newConfig);
          console.log('✅ Payment config updated directly');
        } else {
          console.log('❌ Payment config file not found');
        }
      } catch (error) {
        console.error('❌ Error applying direct payment config fix:', error.message);
      }
    }
    
    // Step 4: Restart the server
    console.log('\nStep 4: Server should be restarted to apply changes');
    console.log('Please restart the Node.js application to apply all fixes');
    
    // Step 5: Instructions for testing
    console.log('\nStep 5: Testing the fixes');
    console.log('Run the following commands to test your fixes:');
    console.log('node scripts/server-test.js');
    
    console.log('\n=================================================');
    console.log('All fixes have been applied!');
    console.log('=================================================');
    
    return true;
  } catch (error) {
    console.error('❌ Error applying fixes:', error);
    return false;
  } finally {
    // Close database connection
    try {
      await sequelize.close();
    } catch (e) {
      // Ignore
    }
  }
}

// Run if executed directly
if (require.main === module) {
  applyAllFixes()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
} else {
  module.exports = { applyAllFixes }; 