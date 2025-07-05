require('dotenv').config();

function checkWowPayEnvironmentVariables() {
    console.log('🔍 Checking WOWPAY Environment Variables\n');
    
    const wowPayVars = {
        'WOWPAY_MCH_ID': process.env.WOWPAY_MCH_ID,
        'WOWPAY_KEY': process.env.WOWPAY_KEY,
        'WOWPAY_HOST': process.env.WOWPAY_HOST,
        'WOWPAY_SIGN_TYPE': process.env.WOWPAY_SIGN_TYPE,
        // Check for alternative variable names
        'WOWPAY_MERCHANT_ID': process.env.WOWPAY_MERCHANT_ID,
        'WOWPAY_SECRET_KEY': process.env.WOWPAY_SECRET_KEY,
        'WOWPAY_API_URL': process.env.WOWPAY_API_URL,
        'WOWPAY_API_HOST': process.env.WOWPAY_API_HOST,
        'WOWPAY_BASE_URL': process.env.WOWPAY_BASE_URL,
        'WOWPAY_MERCHANT_NO': process.env.WOWPAY_MERCHANT_NO,
        'WOWPAY_SECRET': process.env.WOWPAY_SECRET,
    };
    
    console.log('📋 Current WOWPAY Environment Variables:');
    console.log('='.repeat(60));
    
    let foundVars = 0;
    for (const [key, value] of Object.entries(wowPayVars)) {
        if (value) {
            foundVars++;
            if (key.includes('KEY') || key.includes('SECRET')) {
                const maskedValue = value.length > 10 
                    ? `${value.substring(0, 5)}...${value.substring(value.length - 5)}`
                    : '***';
                console.log(`✅ ${key}: ${maskedValue}`);
            } else {
                console.log(`✅ ${key}: ${value}`);
            }
        } else {
            console.log(`❌ ${key}: Not set`);
        }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`📊 Found ${foundVars} WOWPAY-related environment variables`);
    
    // Check for any other payment gateway variables that might be relevant
    console.log('\n🔍 Checking for other payment gateway variables:');
    const allEnvVars = Object.keys(process.env);
    const paymentVars = allEnvVars.filter(key => 
        key.toLowerCase().includes('pay') || 
        key.toLowerCase().includes('gateway') ||
        key.toLowerCase().includes('merchant') ||
        key.toLowerCase().includes('api')
    );
    
    if (paymentVars.length > 0) {
        console.log('Found other payment-related variables:');
        paymentVars.forEach(key => {
            if (!key.includes('WOWPAY')) {
                const value = process.env[key];
                if (key.toLowerCase().includes('key') || key.toLowerCase().includes('secret')) {
                    const maskedValue = value.length > 10 
                        ? `${value.substring(0, 5)}...${value.substring(value.length - 5)}`
                        : '***';
                    console.log(`   ${key}: ${maskedValue}`);
                } else {
                    console.log(`   ${key}: ${value}`);
                }
            }
        });
    }
    
    console.log('\n💡 Recommendations:');
    console.log('1. If you have alternative WOWPAY credentials, update your .env file');
    console.log('2. Check if there are any backup/test credentials');
    console.log('3. Verify if the credentials are for the correct environment (test vs production)');
    console.log('4. Contact WOWPAY support with the merchant ID: ' + (process.env.WOWPAY_MCH_ID || 'Not set'));
    
    console.log('\n📞 Next Steps:');
    console.log('1. Contact WOWPAY support using the generated template');
    console.log('2. Request account activation or credential verification');
    console.log('3. Ask for the correct API endpoints for your account');
    console.log('4. Verify if there are any IP whitelisting requirements');
}

// Run the check
checkWowPayEnvironmentVariables(); 