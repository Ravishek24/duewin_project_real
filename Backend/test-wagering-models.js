// Backend/test-wagering-models.js
// Test file to verify wagering models are working

const { initializeModels } = require('./models');

async function testWageringModels() {
    try {
        console.log('🧪 Testing Wagering Models...');
        
        // Initialize models
        const models = await initializeModels();
        console.log('✅ Models initialized successfully');
        
        // Test CreditTransaction model
        if (models.CreditTransaction) {
            console.log('✅ CreditTransaction model found');
            console.log('📋 CreditTransaction fields:', Object.keys(models.CreditTransaction.rawAttributes));
        } else {
            console.log('❌ CreditTransaction model not found');
        }
        
        // Test User model wagering fields
        if (models.User) {
            console.log('✅ User model found');
            
            // Check if wagering fields exist
            const wageringFields = [
                'total_external_credits',
                'total_self_rebate_credits', 
                'current_wagering_requirement',
                'last_external_credit_at',
                'wagering_progress'
            ];
            
            const userFields = Object.keys(models.User.rawAttributes);
            wageringFields.forEach(field => {
                if (userFields.includes(field)) {
                    console.log(`✅ User field found: ${field}`);
                } else {
                    console.log(`❌ User field missing: ${field}`);
                }
            });
            
            // Test wagering methods
            if (typeof models.User.updateWageringRequirement === 'function') {
                console.log('✅ User.updateWageringRequirement method found');
            } else {
                console.log('❌ User.updateWageringRequirement method missing');
            }
            
        } else {
            console.log('❌ User model not found');
        }
        
        console.log('\n🎯 Wagering Models Test Complete!');
        
    } catch (error) {
        console.error('❌ Error testing wagering models:', error);
    }
}

// Run test if called directly
if (require.main === module) {
    testWageringModels();
}

module.exports = { testWageringModels };
