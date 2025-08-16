// Backend/test-wagering-routes-debug.js
// Debug test to see exactly what's happening with wagering routes

try {
    console.log('🧪 Debug Testing Wagering Routes...');
    
    // Test 1: Import wagering routes
    console.log('🔍 Test 1: Import wagering routes');
    const wageringRoutes = require('./routes/wageringRoutes');
    console.log('  ✅ WageringRoutes imported successfully');
    console.log('  📊 Type:', typeof wageringRoutes);
    console.log('  📊 Constructor:', wageringRoutes.constructor.name);
    console.log('  📊 Keys:', Object.keys(wageringRoutes));
    
    // Test 2: Check if it's an Express router
    console.log('\n🔍 Test 2: Check Express router properties');
    if (wageringRoutes && typeof wageringRoutes === 'function') {
        console.log('  ✅ It\'s a function (Express router)');
        
        // Check if it has the expected Express router properties
        const expectedProps = ['stack', 'route', 'use', 'get', 'post', 'put', 'delete'];
        expectedProps.forEach(prop => {
            if (wageringRoutes[prop] !== undefined) {
                console.log(`    ✅ ${prop}: ${typeof wageringRoutes[prop]}`);
            } else {
                console.log(`    ❌ ${prop}: Missing`);
            }
        });
        
        // Check the stack
        if (wageringRoutes.stack) {
            console.log(`  📋 Stack length: ${wageringRoutes.stack.length}`);
            console.log('  📋 Stack contents:');
            wageringRoutes.stack.forEach((middleware, index) => {
                console.log(`    ${index + 1}. Type: ${middleware.name || 'anonymous'}`);
                if (middleware.route) {
                    const methods = Object.keys(middleware.route.methods);
                    console.log(`       Route: ${methods.join(',').toUpperCase()} ${middleware.route.path}`);
                } else if (middleware.name === 'router') {
                    console.log(`       Router middleware`);
                } else {
                    console.log(`       Other middleware: ${middleware.name || 'unknown'}`);
                }
            });
        } else {
            console.log('  ❌ No stack found');
        }
    } else {
        console.log('  ❌ Not a function');
        console.log('  📊 Value:', wageringRoutes);
    }
    
    // Test 3: Try to create a simple test route
    console.log('\n🔍 Test 3: Try to add a test route');
    try {
        wageringRoutes.get('/test', (req, res) => {
            res.json({ message: 'Test route works' });
        });
        console.log('  ✅ Successfully added test route');
        
        // Check if the route was added
        if (wageringRoutes.stack) {
            const testRoute = wageringRoutes.stack.find(m => 
                m.route && m.route.path === '/test'
            );
            if (testRoute) {
                console.log('  ✅ Test route found in stack');
            } else {
                console.log('  ❌ Test route not found in stack');
            }
        }
    } catch (error) {
        console.log('  ❌ Failed to add test route:', error.message);
    }
    
    // Test 4: Import wagering controller
    console.log('\n🔍 Test 4: Import wagering controller');
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
    
    console.log('\n🎯 Debug Summary:');
    console.log('✅ Routes imported successfully');
    console.log('✅ Controller imported successfully');
    console.log('✅ All methods found');
    
    if (wageringRoutes && typeof wageringRoutes === 'function' && wageringRoutes.stack) {
        console.log('✅ Routes object is valid Express router');
        console.log(`📋 Total routes: ${wageringRoutes.stack.length}`);
    } else {
        console.log('❌ Routes object is NOT a valid Express router');
    }
    
} catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack trace:', error.stack);
}
