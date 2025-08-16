const axios = require('axios');

const testUltraFastLogin = async () => {
    const baseURL = process.env.SERVER_URL || 'http://localhost:8000';
    const phone_no = process.argv[2];
    const password = process.argv[3];
    
    if (!phone_no || !password) {
        console.log('Usage: node test-ultra-fast-login.js <phone_number> <password>');
        console.log('Example: node test-ultra-fast-login.js 1234567890 mypassword');
        process.exit(1);
    }
    
    console.log('🚀 Testing Ultra-Fast Login...');
    console.log(`📞 Phone: ${phone_no}`);
    console.log(`🌐 Server: ${baseURL}`);
    console.log('================================\n');
    
    const testCases = [
        { name: 'Current Login Controller', endpoint: '/api/users/login' },
        { name: 'Ultra-Fast Login Controller', endpoint: '/api/users/ultra-fast-login' }
    ];
    
    for (const testCase of testCases) {
        console.log(`🧪 Testing: ${testCase.name}`);
        
        try {
            const startTime = Date.now();
            
            const response = await axios.post(`${baseURL}${testCase.endpoint}`, {
                phone_no,
                password
            }, {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            
            if (response.data.success) {
                console.log(`✅ SUCCESS: ${totalTime}ms`);
                
                // Show performance data if available
                if (response.data.performance) {
                    const perf = response.data.performance;
                    console.log(`📊 Detailed breakdown:`);
                    console.log(`   - Total: ${perf.totalTime?.toFixed(2) || totalTime}ms`);
                    if (perf.breakdown) {
                        const b = perf.breakdown;
                        console.log(`   - Cache: ${b.cache?.toFixed(2) || b.modelInit?.toFixed(2) || 'N/A'}ms`);
                        console.log(`   - Query: ${b.query?.toFixed(2) || b.userQuery?.toFixed(2) || 'N/A'}ms`);
                        console.log(`   - Bcrypt: ${b.bcrypt?.toFixed(2) || b.passwordCheck?.toFixed(2) || 'N/A'}ms`);
                        console.log(`   - Session: ${b.session?.toFixed(2) || b.sessionOps?.toFixed(2) || 'N/A'}ms`);
                        console.log(`   - JWT: ${b.jwt?.toFixed(2) || b.jwtGeneration?.toFixed(2) || 'N/A'}ms`);
                    }
                }
                
                console.log(`🎯 User ID: ${response.data.data?.user?.id}`);
                console.log(`💰 Balance: ${response.data.data?.user?.wallet_balance}`);
            } else {
                console.log(`❌ FAILED: ${response.data.message}`);
            }
            
        } catch (error) {
            const endTime = Date.now();
            const totalTime = endTime - startTime;
            
            if (error.response) {
                console.log(`❌ HTTP ERROR: ${error.response.status} - ${error.response.data?.message || error.message} (${totalTime}ms)`);
            } else if (error.code === 'ECONNREFUSED') {
                console.log(`❌ CONNECTION REFUSED: Server not running at ${baseURL}`);
            } else {
                console.log(`❌ ERROR: ${error.message} (${totalTime}ms)`);
            }
        }
        
        console.log(''); // Empty line for readability
    }
    
    console.log('🏁 Testing completed!');
};

// Run test if called directly
if (require.main === module) {
    testUltraFastLogin().catch(console.error);
}

module.exports = { testUltraFastLogin };