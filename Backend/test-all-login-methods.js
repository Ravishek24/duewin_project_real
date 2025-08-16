const axios = require('axios');

const testAllLoginMethods = async () => {
    const baseURL = process.env.SERVER_URL || 'http://localhost:8000';
    const phone_no = process.argv[2];
    const password = process.argv[3];
    
    if (!phone_no || !password) {
        console.log('Usage: node test-all-login-methods.js <phone_number> <password>');
        console.log('Example: node test-all-login-methods.js 1234567890 mypassword');
        process.exit(1);
    }
    
    console.log('🚀 Testing All Login Methods...');
    console.log(`📞 Phone: ${phone_no}`);
    console.log(`🌐 Server: ${baseURL}`);
    console.log('=====================================\n');
    
    const testCases = [
        { name: '1. Current Login (Sequelize)', endpoint: '/api/users/login' },
        { name: '2. Ultra-Fast Login (Cached)', endpoint: '/api/users/ultra-fast-login' },
        { name: '3. Raw SQL (Existing Connection)', endpoint: '/api/users/raw-sql-login' },
        { name: '4. Direct Database (New Connection)', endpoint: '/api/users/direct-db-login' }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
        console.log(`🧪 Testing: ${testCase.name}`);
        
        try {
            const startTime = Date.now();
            
            const response = await axios.post(`${baseURL}${testCase.endpoint}`, {
                phone_no,
                password
            }, {
                timeout: 15000,
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const endTime = Date.now();
            const clientTime = endTime - startTime;
            
            if (response.data.success) {
                const serverTime = response.data.performance?.totalTime || clientTime;
                const breakdown = response.data.performance?.breakdown || {};
                
                console.log(`✅ SUCCESS`);
                console.log(`   Client Time: ${clientTime}ms`);
                console.log(`   Server Time: ${serverTime.toFixed(2)}ms`);
                
                if (breakdown.dbInit !== undefined || breakdown.cache !== undefined || breakdown.modelInit !== undefined) {
                    console.log(`   📊 Breakdown:`);
                    if (breakdown.dbInit !== undefined) console.log(`      - DB Init: ${breakdown.dbInit.toFixed(2)}ms`);
                    if (breakdown.cache !== undefined) console.log(`      - Cache: ${breakdown.cache.toFixed(2)}ms`);
                    if (breakdown.modelInit !== undefined) console.log(`      - Model Init: ${breakdown.modelInit.toFixed(2)}ms`);
                    if (breakdown.userQuery !== undefined) console.log(`      - User Query: ${breakdown.userQuery.toFixed(2)}ms`);
                    if (breakdown.query !== undefined) console.log(`      - Query: ${breakdown.query.toFixed(2)}ms`);
                    if (breakdown.bcrypt !== undefined) console.log(`      - Bcrypt: ${breakdown.bcrypt.toFixed(2)}ms`);
                    if (breakdown.passwordCheck !== undefined) console.log(`      - Password: ${breakdown.passwordCheck.toFixed(2)}ms`);
                    if (breakdown.session !== undefined) console.log(`      - Session: ${breakdown.session.toFixed(2)}ms`);
                    if (breakdown.sessionOps !== undefined) console.log(`      - Session Ops: ${breakdown.sessionOps.toFixed(2)}ms`);
                    if (breakdown.jwt !== undefined) console.log(`      - JWT: ${breakdown.jwt.toFixed(2)}ms`);
                    if (breakdown.jwtGeneration !== undefined) console.log(`      - JWT Gen: ${breakdown.jwtGeneration.toFixed(2)}ms`);
                }
                
                console.log(`   🎯 User ID: ${response.data.data?.user?.id}`);
                console.log(`   💰 Balance: ${response.data.data?.user?.wallet_balance}`);
                
                results.push({
                    name: testCase.name,
                    success: true,
                    clientTime,
                    serverTime: serverTime,
                    breakdown
                });
            } else {
                console.log(`❌ FAILED: ${response.data.message}`);
                results.push({
                    name: testCase.name,
                    success: false,
                    error: response.data.message,
                    clientTime
                });
            }
            
        } catch (error) {
            const endTime = Date.now();
            const clientTime = endTime - startTime;
            
            let errorMsg = 'Unknown error';
            if (error.response) {
                errorMsg = `HTTP ${error.response.status}: ${error.response.data?.message || error.message}`;
            } else if (error.code === 'ECONNREFUSED') {
                errorMsg = `Connection refused - Server not running at ${baseURL}`;
            } else if (error.code === 'ENOTFOUND') {
                errorMsg = `Host not found: ${baseURL}`;
            } else {
                errorMsg = error.message;
            }
            
            console.log(`❌ ERROR: ${errorMsg} (${clientTime}ms)`);
            results.push({
                name: testCase.name,
                success: false,
                error: errorMsg,
                clientTime
            });
        }
        
        console.log(''); // Empty line for readability
    }
    
    // Summary
    console.log('📊 PERFORMANCE COMPARISON SUMMARY');
    console.log('=====================================');
    
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length > 0) {
        // Sort by server time
        successfulResults.sort((a, b) => a.serverTime - b.serverTime);
        
        console.log('🏆 RANKING (by server time):');
        successfulResults.forEach((result, index) => {
            const rank = index + 1;
            const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉';
            console.log(`${emoji} ${rank}. ${result.name}: ${result.serverTime.toFixed(2)}ms`);
        });
        
        console.log('\n🎯 FASTEST METHOD:');
        const fastest = successfulResults[0];
        console.log(`   ${fastest.name}`);
        console.log(`   Server Time: ${fastest.serverTime.toFixed(2)}ms`);
        console.log(`   Client Time: ${fastest.clientTime}ms`);
        
        if (successfulResults.length > 1) {
            const slowest = successfulResults[successfulResults.length - 1];
            const improvement = ((slowest.serverTime - fastest.serverTime) / slowest.serverTime * 100);
            console.log(`   Improvement: ${improvement.toFixed(1)}% faster than slowest`);
        }
        
        // Show bottlenecks
        console.log('\n⚠️  BOTTLENECK ANALYSIS:');
        successfulResults.forEach(result => {
            const issues = [];
            const b = result.breakdown;
            
            if (b.modelInit > 100) issues.push(`Model Init (${b.modelInit.toFixed(2)}ms)`);
            if (b.cache > 50) issues.push(`Cache (${b.cache.toFixed(2)}ms)`);
            if (b.dbInit > 20) issues.push(`DB Init (${b.dbInit.toFixed(2)}ms)`);
            if ((b.userQuery || b.query) > 30) issues.push(`Query (${(b.userQuery || b.query).toFixed(2)}ms)`);
            if ((b.bcrypt || b.passwordCheck) > 150) issues.push(`Password (${(b.bcrypt || b.passwordCheck).toFixed(2)}ms)`);
            if ((b.session || b.sessionOps) > 80) issues.push(`Session (${(b.session || b.sessionOps).toFixed(2)}ms)`);
            
            if (issues.length > 0) {
                console.log(`   ${result.name}: ${issues.join(', ')}`);
            } else {
                console.log(`   ${result.name}: ✅ No significant bottlenecks`);
            }
        });
        
    } else {
        console.log('❌ No successful login attempts');
    }
    
    // Failed attempts
    const failedResults = results.filter(r => !r.success);
    if (failedResults.length > 0) {
        console.log('\n❌ FAILED ATTEMPTS:');
        failedResults.forEach(result => {
            console.log(`   ${result.name}: ${result.error}`);
        });
    }
    
    console.log('\n🏁 Testing completed!');
    console.log('\n💡 RECOMMENDATION:');
    
    if (successfulResults.length > 0) {
        const fastest = successfulResults[0];
        if (fastest.serverTime < 150) {
            console.log(`✅ Use ${fastest.name} - Excellent performance (${fastest.serverTime.toFixed(2)}ms)`);
        } else if (fastest.serverTime < 250) {
            console.log(`⚠️  Use ${fastest.name} - Good performance (${fastest.serverTime.toFixed(2)}ms) but could be optimized`);
        } else {
            console.log(`🚨 ${fastest.name} is fastest but still slow (${fastest.serverTime.toFixed(2)}ms) - needs investigation`);
        }
    } else {
        console.log('🚨 All login methods failed - check server configuration');
    }
};

// Run test if called directly
if (require.main === module) {
    testAllLoginMethods().catch(console.error);
}

module.exports = { testAllLoginMethods };