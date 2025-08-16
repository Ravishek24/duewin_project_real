// Quick test to verify session timing
const { generateToken } = require('./utils/jwt');
const crypto = require('crypto');

console.log('🕐 Quick Session Duration Test');
console.log('==============================\n');

// Test JWT generation
const testPayload = {
    userId: 123,
    sessionToken: crypto.randomBytes(16).toString('hex'),
    deviceId: crypto.randomBytes(16).toString('hex')
};

console.log('1. Testing JWT Token Generation:');
const token = generateToken(testPayload);
console.log(`   Generated Token: ${token.substring(0, 50)}...`);

// Decode the token to check expiration
try {
    const base64Payload = token.split('.')[1];
    const decodedPayload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
    
    const now = Math.floor(Date.now() / 1000);
    const issuedAt = decodedPayload.iat;
    const expiresAt = decodedPayload.exp;
    const duration = expiresAt - issuedAt;
    const durationHours = duration / 3600;
    
    console.log(`   Issued At: ${new Date(issuedAt * 1000).toLocaleString()}`);
    console.log(`   Expires At: ${new Date(expiresAt * 1000).toLocaleString()}`);
    console.log(`   Duration: ${duration} seconds (${durationHours} hours)`);
    
    if (durationHours === 5) {
        console.log('   ✅ JWT Duration is correct: 5 hours');
    } else {
        console.log(`   ❌ JWT Duration is wrong: ${durationHours} hours (expected: 5)`);
    }
    
} catch (error) {
    console.log(`   ❌ Error decoding token: ${error.message}`);
}

console.log('\n2. Testing Session Expiration Calculation:');
const now = new Date();
const expiresAt = new Date(now.getTime() + 5 * 60 * 60 * 1000); // 5 hours
const duration = Math.round((expiresAt - now) / (1000 * 60 * 60) * 10) / 10;

console.log(`   Session Created: ${now.toLocaleString()}`);
console.log(`   Session Expires: ${expiresAt.toLocaleString()}`);
console.log(`   Duration: ${duration} hours`);

if (Math.abs(duration - 5) < 0.1) {
    console.log('   ✅ Session duration calculation is correct');
} else {
    console.log(`   ❌ Session duration calculation is wrong: ${duration}h (expected: ~5h)`);
}

console.log('\n3. Configuration Check:');
const config = require('./config/config');
console.log(`   JWT Expiration Config: ${config.jwtExpiration || 'NOT SET'}`);

console.log('\n🏁 Quick test completed!');