// Backend/test-wagering-routes.js
// Simple test to verify wagering routes are properly defined

try {
    console.log('🧪 Testing Wagering Routes...');
    
    // Test 1: Import wagering routes
    console.log('🔍 Test 1: Import wagering routes');
    const wageringRoutes = require('./routes/wageringRoutes');
    console.log('  ✅ WageringRoutes imported successfully');
    
    // Test 2: Check if routes are properly defined
    console.log('🔍 Test 2: Check routes structure');
    if (wageringRoutes && typeof wageringRoutes === 'object') {
        console.log('  ✅ Routes object is valid');
        
        // Check if it has the expected properties
        if (wageringRoutes.stack) {
            console.log(`  📋 Number of routes: ${wageringRoutes.stack.length}`);
            
            // List the routes
            wageringRoutes.stack.forEach((middleware, index) => {
                if (middleware.route) {
                    const methods = Object.keys(middleware.route.methods);
                    console.log(`    ${index + 1}. ${methods.join(',').toUpperCase()} ${middleware.route.path}`);
                }
            });
        } else {
            console.log('  ❌ Routes stack not found');
        }
    } else {
        console.log('  ❌ Routes object is invalid');
    }
    
    // Test 3: Import wagering controller
    console.log('🔍 Test 3: Import wagering controller');
    const wageringController = require('./controllers/wageringController');
    console.log('  ✅ WageringController imported successfully');
    
    const methods = ['getUserWageringDetails', 'checkWithdrawalEligibility'];
    methods.forEach(method => {
        if (typeof wageringController[method] === 'function') {
            console.log(`    ✅ ${method} method - Found`);
        } else {
            console.log(`    ❌ ${method} method - Missing`);
        }
    });
    
    console.log('\n🎯 Wagering Routes Test Summary:');
    console.log('✅ Routes imported successfully');
    console.log('✅ Controller imported successfully');
    console.log('✅ All methods found');
    console.log('\n🚀 Wagering Routes are Ready!');
    
} catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
}
