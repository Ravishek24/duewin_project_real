// Backend/test-101pay-wagering.js
// Test script to verify 101PAY wagering system integration

const { initializeModels } = require('./models');

async function test101PayWagering() {
    try {
        console.log('🧪 Testing 101PAY Wagering Integration...');
        
        // Initialize models
        const models = await initializeModels();
        console.log('✅ Models initialized successfully');
        
        // Test User model wagering fields
        if (models.User) {
            console.log('✅ User model found');
            
            // Check if wagering fields exist
            const userFields = Object.keys(models.User.rawAttributes);
            const requiredFields = [
                'total_external_credits',
                'total_self_rebate_credits', 
                'current_wagering_requirement',
                'last_external_credit_at',
                'wagering_progress'
            ];
            
            console.log('🔍 Checking required wagering fields:');
            requiredFields.forEach(field => {
                if (userFields.includes(field)) {
                    console.log(`  ✅ ${field} - Found`);
                } else {
                    console.log(`  ❌ ${field} - Missing`);
                }
            });
            
            // Check if wagering methods exist
            if (typeof models.User.updateWageringRequirement === 'function') {
                console.log('✅ updateWageringRequirement method - Found');
            } else {
                console.log('❌ updateWageringRequirement method - Missing');
            }
        } else {
            console.log('❌ User model not found');
        }
        
        // Test CreditTransaction model
        if (models.CreditTransaction) {
            console.log('✅ CreditTransaction model found');
            console.log('📋 CreditTransaction fields:', Object.keys(models.CreditTransaction.rawAttributes));
        } else {
            console.log('❌ CreditTransaction model not found');
        }
        
        // Test CreditService
        try {
            const CreditService = require('./services/creditService');
            console.log('✅ CreditService imported successfully');
            
            // Check if main methods exist
            if (typeof CreditService.addCredit === 'function') {
                console.log('✅ addCredit method - Found');
            } else {
                console.log('❌ addCredit method - Missing');
            }
            
            if (typeof CreditService.isExternalCredit === 'function') {
                console.log('✅ isExternalCredit method - Found');
            } else {
                console.log('❌ isExternalCredit method - Missing');
            }
            
        } catch (error) {
            console.log('❌ CreditService import failed:', error.message);
        }
        
        console.log('\n🎯 101PAY Wagering Integration Test Complete!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
test101PayWagering();
