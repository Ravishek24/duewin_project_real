// Performance test script for optimized login
const axios = require('axios');

const baseURL = 'http://localhost:3000'; // Adjust based on your server

async function testLoginPerformance() {
    console.log('🚀 Testing Login Performance (Round 3 Optimizations)...\n');
    
    // Test user credentials (adjust these based on your test data)
    const testCredentials = {
        phone_no: '1234567890', // Replace with actual test user
        password: 'testpassword123' // Replace with actual test password
    };
    
    const results = [];
    const numTests = 20;  // Increased for better sample size
    
    for (let i = 0; i < numTests; i++) {
        try {
            const startTime = performance.now();
            
            const response = await axios.post(`${baseURL}/auth/login`, testCredentials, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10s timeout
            });
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            if (response.status === 200) {
                results.push(duration);
                const serverTime = response.headers['x-response-time'];
                console.log(`✅ Test ${i + 1}: ${duration.toFixed(2)}ms (server: ${serverTime || 'N/A'})`);
            } else {
                console.log(`❌ Test ${i + 1}: Failed with status ${response.status}`);
            }
            
            // Wait a bit between requests to avoid overwhelming
            await new Promise(resolve => setTimeout(resolve, 100));
            
        } catch (error) {
            console.log(`❌ Test ${i + 1}: Error - ${error.message}`);
        }
    }
    
    if (results.length > 0) {
        const avgTime = results.reduce((a, b) => a + b, 0) / results.length;
        const minTime = Math.min(...results);
        const maxTime = Math.max(...results);
        
        console.log('\n📊 Performance Results:');
        console.log('========================');
        console.log(`🎯 Average: ${avgTime.toFixed(2)}ms`);
        console.log(`⚡ Fastest: ${minTime.toFixed(2)}ms`);
        console.log(`🐌 Slowest: ${maxTime.toFixed(2)}ms`);
        console.log(`📈 Tests: ${results.length}/${numTests} successful`);
        
        if (avgTime < 200) {
            console.log('\n🎉 EXCELLENT! Login performance is under 200ms target!');
        } else if (avgTime < 300) {
            console.log('\n✅ GOOD! Login performance is decent but can be improved.');
        } else {
            console.log('\n⚠️  LOGIN PERFORMANCE NEEDS IMPROVEMENT');
        }
        
        console.log('\n🔧 Performance Breakdown (estimated):');
        console.log('- Database queries: ~30-50ms');
        console.log('- Password verification: ~50-150ms (depending on bcrypt rounds)');
        console.log('- Session operations: ~30-50ms');
        console.log('- Token generation: ~5-10ms');
        console.log('- Network overhead: ~10-20ms');
    } else {
        console.log('\n❌ No successful login tests completed');
    }
}

// Run the test
if (require.main === module) {
    testLoginPerformance().catch(console.error);
}

module.exports = { testLoginPerformance };