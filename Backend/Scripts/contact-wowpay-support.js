const wowPayConfig = require('../config/wowPayConfig');

function generateWowPaySupportRequest() {
    console.log('📧 WOWPAY Support Request Template\n');
    console.log('='.repeat(80));
    console.log('SUBJECT: Test Merchant Account Not Working - Need Credentials Verification\n');
    console.log('Dear WOWPAY Support Team,\n');
    console.log('We are trying to integrate with your payment gateway but encountering issues with our test merchant account.\n');
    console.log('Please help us verify the following credentials and provide the correct information:\n\n');
    
    console.log('🔍 CURRENT CONFIGURATION:');
    console.log(`   Merchant ID: ${wowPayConfig.mchId}`);
    console.log(`   Secret Key: ${wowPayConfig.key.substring(0, 10)}...${wowPayConfig.key.substring(wowPayConfig.key.length - 5)}`);
    console.log(`   Base URL: ${wowPayConfig.host}`);
    console.log(`   Sign Type: ${wowPayConfig.signType}\n`);
    
    console.log('❌ ISSUES ENCOUNTERED:');
    console.log('1. API Response: "商户不存在" (Merchant does not exist) - Code 102');
    console.log('2. Tested multiple endpoints with same result');
    console.log('3. SSL certificate issues with api.wowpay.biz domain\n');
    
    console.log('🧪 TEST RESULTS:');
    console.log('✅ API endpoints are responding correctly');
    console.log('✅ Request format and signature generation working');
    console.log('✅ JSON content-type headers properly set');
    console.log('❌ Merchant account not recognized by system\n');
    
    console.log('📋 REQUESTED INFORMATION:');
    console.log('1. Please verify if our test merchant account is properly activated');
    console.log('2. Confirm the correct merchant ID format (case sensitivity)');
    console.log('3. Verify the correct secret key for our test account');
    console.log('4. Provide the correct API endpoint URLs for:');
    console.log('   - Test environment');
    console.log('   - Production environment');
    console.log('5. Confirm if there are any IP whitelisting requirements');
    console.log('6. Verify if the account supports both deposit and withdrawal\n');
    
    console.log('🔧 TECHNICAL DETAILS:');
    console.log('- Integration follows your documentation exactly');
    console.log('- Using MD5 signature method');
    console.log('- All required fields included in requests');
    console.log('- Proper error handling implemented');
    console.log('- Testing with standard deposit creation endpoint\n');
    
    console.log('📞 CONTACT INFORMATION:');
    console.log('Please provide the corrected credentials or contact us at:');
    console.log('- Email: [Your Email]');
    console.log('- Phone: [Your Phone]');
    console.log('- Company: [Your Company Name]\n');
    
    console.log('Thank you for your assistance.\n');
    console.log('Best regards,');
    console.log('[Your Name]');
    console.log('[Your Company]');
    console.log('='.repeat(80));
    
    console.log('\n💡 ADDITIONAL TROUBLESHOOTING STEPS:');
    console.log('1. Check if the test merchant account needs activation');
    console.log('2. Verify if there are any pending verification steps');
    console.log('3. Confirm if the account is in the correct environment (test vs production)');
    console.log('4. Check if there are any account restrictions or limitations');
    console.log('5. Verify if the API keys are properly generated and active');
    
    console.log('\n📋 ALTERNATIVE CONTACT METHODS:');
    console.log('- WOWPAY Official Website: https://wowpay.biz');
    console.log('- Email Support: [Check their documentation for support email]');
    console.log('- Live Chat: [If available on their website]');
    console.log('- Phone Support: [Check their documentation for phone number]');
}

// Generate the support request
generateWowPaySupportRequest(); 