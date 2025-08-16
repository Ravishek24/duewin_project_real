// Test script to verify session duration changes
const axios = require('axios');

const testSessionDuration = async () => {
    const baseURL = process.env.SERVER_URL || 'http://localhost:8000';
    const phone_no = process.argv[2];
    const password = process.argv[3];
    
    if (!phone_no || !password) {
        console.log('Usage: node test-session-duration.js <phone_number> <password>');
        console.log('Example: node test-session-duration.js 1234567890 mypassword');
        process.exit(1);
    }
    
    console.log('🕐 Testing Session Duration Changes...');
    console.log(`📞 Phone: ${phone_no}`);
    console.log(`🌐 Server: ${baseURL}`);
    console.log('==========================================\n');
    
    try {
        console.log('🧪 Testing Raw SQL Login (fastest method)...');
        
        const response = await axios.post(`${baseURL}/api/users/raw-sql-login`, {
            phone_no,
            password
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.data.success) {
            const session = response.data.data.session;
            const user = response.data.data.user;
            const performance = response.data.performance;
            
            console.log('✅ Login Successful!');
            console.log(`⚡ Performance: ${performance.totalTime.toFixed(2)}ms`);
            console.log(`🎯 User ID: ${user.id}`);
            console.log(`💰 Balance: ${user.wallet_balance}`);
            
            // Calculate session duration
            const now = new Date();
            const expiresAt = new Date(session.expiresAt);
            const sessionDuration = Math.round((expiresAt - now) / (1000 * 60 * 60) * 10) / 10; // Hours with 1 decimal
            
            console.log('\n📅 Session Information:');
            console.log(`   Created: ${now.toLocaleString()}`);
            console.log(`   Expires: ${expiresAt.toLocaleString()}`);
            console.log(`   Duration: ${sessionDuration} hours`);
            console.log(`   Device ID: ${session.deviceId.substring(0, 16)}...`);
            
            // Verify session duration
            const expectedHours = 5;
            const toleranceHours = 0.1; // 6 minutes tolerance
            
            if (Math.abs(sessionDuration - expectedHours) <= toleranceHours) {
                console.log(`   ✅ Correct Duration: ${sessionDuration}h (expected: ${expectedHours}h)`);
            } else {
                console.log(`   ❌ Wrong Duration: ${sessionDuration}h (expected: ${expectedHours}h)`);
            }
            
            // Extract and test JWT token expiration
            const accessToken = response.data.data.tokens.accessToken;
            console.log('\n🔑 JWT Token Information:');
            
            try {
                // Decode JWT payload (without verification for testing)
                const base64Payload = accessToken.split('.')[1];
                const decodedPayload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
                
                const tokenIssuedAt = new Date(decodedPayload.iat * 1000);
                const tokenExpiresAt = new Date(decodedPayload.exp * 1000);
                const tokenDuration = Math.round((tokenExpiresAt - tokenIssuedAt) / (1000 * 60 * 60) * 10) / 10;
                
                console.log(`   Issued: ${tokenIssuedAt.toLocaleString()}`);
                console.log(`   Expires: ${tokenExpiresAt.toLocaleString()}`);
                console.log(`   Duration: ${tokenDuration} hours`);
                
                // For user JWT, we expect it to match session duration (5h)
                if (Math.abs(tokenDuration - 5) <= 0.1) {
                    console.log(`   ✅ JWT Duration Correct: ${tokenDuration}h (expected: 5h)`);
                } else {
                    console.log(`   ⚠️  JWT Duration: ${tokenDuration}h (expected: 5h for user sessions)`);
                }
                
            } catch (jwtError) {
                console.log(`   ❌ Could not decode JWT: ${jwtError.message}`);
            }
            
            console.log('\n📋 Summary:');
            console.log(`   - User sessions now expire after: ${sessionDuration} hours`);
            console.log(`   - Admin sessions should expire after: 7 hours`);
            console.log(`   - Previous duration was: 24 hours`);
            console.log(`   - Improvement: ${(24 - sessionDuration).toFixed(1)} hours shorter`);
            
        } else {
            console.log(`❌ Login Failed: ${response.data.message}`);
        }
        
    } catch (error) {
        if (error.response) {
            console.log(`❌ HTTP Error: ${error.response.status} - ${error.response.data?.message || error.message}`);
        } else if (error.code === 'ECONNREFUSED') {
            console.log(`❌ Connection Error: Server not running at ${baseURL}`);
        } else {
            console.log(`❌ Error: ${error.message}`);
        }
    }
    
    console.log('\n🏁 Session duration test completed!');
};

// Run test if called directly
if (require.main === module) {
    testSessionDuration().catch(console.error);
}

module.exports = { testSessionDuration };