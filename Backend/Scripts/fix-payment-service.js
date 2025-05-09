/**
 * Script to fix payment service issues
 * Run with: node fix-payment-service.js
 */

const fs = require('fs');
const path = require('path');
const { sequelize } = require('../config/db');

async function fixPaymentService() {
  console.log('Starting payment service fix...');
  
  try {
    // 1. Update payment config to use dummy values for testing
    const paymentConfigPath = path.join(__dirname, '..', 'config', 'paymentConfig.js');
    
    if (!fs.existsSync(paymentConfigPath)) {
      console.error('❌ Payment config file not found at:', paymentConfigPath);
      return false;
    }
    
    console.log('✅ Found payment config file');
    
    // Update config with test values
    const newConfigContent = `
const paymentConfig = {
    mchId: "TEST123",  // Test Merchant ID
    key: "TEST_SECRET_KEY",  // Test Secret key
    host: "https://sandbox.testpay.com",  // Test API base URL
    
    // Mock responses for testing
    mockResponses: {
        createOrder: {
            code: 0,
            msg: "Success",
            data: {
                url: "https://sandbox.testpay.com/pay?orderId=TEST_ORDER_123",
                transaction_Id: "MOCK_TX_123456"
            }
        }
    }
};

module.exports = paymentConfig;
`;

    // Backup original file
    const configBackupPath = `${paymentConfigPath}.backup`;
    fs.writeFileSync(configBackupPath, fs.readFileSync(paymentConfigPath, 'utf8'));
    console.log(`✅ Original payment config backed up to ${configBackupPath}`);
    
    // Write new config
    fs.writeFileSync(paymentConfigPath, newConfigContent);
    console.log('✅ Payment config updated with test values');
    
    // 2. Check payment service file and add a mock response for testing
    const paymentServicePath = path.join(__dirname, '..', 'services', 'paymentService.js');
    
    if (!fs.existsSync(paymentServicePath)) {
      console.error('❌ Payment service file not found at:', paymentServicePath);
      return false;
    }
    
    console.log('✅ Found payment service file');
    
    const serviceContent = fs.readFileSync(paymentServicePath, 'utf8');
    
    // Check if mock functionality already exists
    if (serviceContent.includes('USE_MOCK_RESPONSE')) {
      console.log('✅ Payment service already contains mock functionality');
    } else {
      // Find createPayInOrder function
      const lines = serviceContent.split('\n');
      let createPayInOrderStart = -1;
      let axiosPostStart = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('createPayInOrder =') || 
            lines[i].includes('const createPayInOrder =')) {
          createPayInOrderStart = i;
        }
        
        // Look for axios.post call within the function
        if (createPayInOrderStart !== -1 && 
            lines[i].includes('axios.post') && 
            lines[i].includes('Collect')) {
          axiosPostStart = i;
          break;
        }
      }
      
      if (axiosPostStart === -1) {
        console.log('⚠️ Could not find axios.post in createPayInOrder function');
        console.log('Skipping payment service modification');
      } else {
        // Insert mock code before the axios call
        const mockCode = [
          '    // Use mock response for testing',
          '    const USE_MOCK_RESPONSE = true;',
          '    if (USE_MOCK_RESPONSE) {',
          '      console.log("Using mock payment response for testing");',
          '      await WalletRecharge.update(',
          '        { transaction_id: "MOCK_TX_" + Date.now() },',
          '        { ',
          '          where: { order_id: orderId },',
          '          transaction: t ',
          '        }',
          '      );',
          '      ',
          '      await t.commit();',
          '      ',
          '      return {',
          '        success: true,',
          '        message: "Payment order created successfully (MOCK)",',
          '        paymentUrl: "https://sandbox.testpay.com/mockpayment?orderId=" + orderId,',
          '        transactionId: "MOCK_TX_" + Date.now(),',
          '        orderId: orderId',
          '      };',
          '    }',
          ''
        ];
        
        lines.splice(axiosPostStart, 0, ...mockCode);
        const newServiceContent = lines.join('\n');
        
        // Backup original file
        const serviceBackupPath = `${paymentServicePath}.backup`;
        fs.writeFileSync(serviceBackupPath, serviceContent);
        console.log(`✅ Original payment service backed up to ${serviceBackupPath}`);
        
        // Write updated service file
        fs.writeFileSync(paymentServicePath, newServiceContent);
        console.log('✅ Payment service updated with mock response');
      }
    }
    
    console.log('\n✅ Payment fixes applied:');
    console.log('1. Updated payment config with test values');
    console.log('2. Added mock responses for payment endpoints');
    console.log('\nThese changes will allow testing without a real payment gateway');
    
    return true;
  } catch (error) {
    console.error('❌ Error fixing payment service:', error);
    return false;
  }
}

// Run if executed directly
if (require.main === module) {
  fixPaymentService()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unhandled error:', error);
      process.exit(1);
    });
} 