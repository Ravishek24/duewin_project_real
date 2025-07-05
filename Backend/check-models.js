async function checkModels() {
    console.log('🔍 Checking Models Availability');
    console.log('===============================');
    
    try {
        // Test 1: Import models directly
        console.log('1. Testing direct models import...');
        const models = require('./models');
        console.log('Models object keys:', Object.keys(models));
        
        // Test 2: Check specific models
        console.log('\n2. Checking specific models...');
        console.log('WalletRecharge:', !!models.WalletRecharge);
        console.log('WalletWithdrawal:', !!models.WalletWithdrawal);
        console.log('User:', !!models.User);
        
        // Test 3: Check if models have create method
        console.log('\n3. Checking model methods...');
        if (models.WalletRecharge) {
            console.log('WalletRecharge.create:', typeof models.WalletRecharge.create);
        }
        if (models.WalletWithdrawal) {
            console.log('WalletWithdrawal.create:', typeof models.WalletWithdrawal.create);
        }
        if (models.User) {
            console.log('User.findByPk:', typeof models.User.findByPk);
        }
        
        // Test 4: Check destructuring import
        console.log('\n4. Testing destructuring import...');
        try {
            const { WalletRecharge } = models;
            console.log('Destructured WalletRecharge:', !!WalletRecharge);
            console.log('Destructured WalletRecharge.create:', typeof WalletRecharge?.create);
        } catch (destructError) {
            console.log('Destructuring error:', destructError.message);
        }
        
    } catch (error) {
        console.error('❌ Error loading models:', error);
        console.error('Stack:', error.stack);
    }
}

checkModels().catch(console.error); 