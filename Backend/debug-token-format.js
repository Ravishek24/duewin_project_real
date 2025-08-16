// Debug script to test token format issues
const { generateToken, verifyToken } = require('./utils/jwt');
const config = require('./config/config');

console.log('🔍 Debugging Token Format Issues...\n');

// Test token generation with new format
const testPayload = {
    userId: 123,
    sessionToken: 'test-session-token-uuid',
    deviceId: 'test-device-id'
};

console.log('1. Generating token with payload:', testPayload);
const token = generateToken(testPayload);
console.log('Generated token:', token.substring(0, 50) + '...\n');

// Test token verification
try {
    console.log('2. Verifying token...');
    const decoded = verifyToken(token);
    console.log('Decoded payload:', decoded);
    
    // Check for required fields
    const userId = decoded.userId || decoded.user_id;
    const sessionToken = decoded.sessionToken;
    
    console.log('\n3. Validation checks:');
    console.log('✅ userId found:', !!userId, '(value:', userId, ')');
    console.log('✅ sessionToken found:', !!sessionToken, '(value:', sessionToken, ')');
    
    if (!userId) {
        console.log('❌ This would cause "Invalid token format" error');
    }
    if (!sessionToken) {
        console.log('❌ This would cause "Invalid session token" error');
    }
    
    if (userId && sessionToken) {
        console.log('✅ Token format is valid!');
    }
    
} catch (error) {
    console.error('❌ Token verification failed:', error.message);
}

console.log('\n4. JWT Configuration:');
console.log('JWT Secret set:', !!config.jwtSecret);
console.log('JWT Expiration:', config.jwtExpiration || '1h');