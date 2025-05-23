// Debug script to help identify JWT token issues
const jwt = require('jsonwebtoken');
const config = require('./config/config');
const dotenv = require('dotenv');

// Load .env file
dotenv.config();

// Constants from the codebase
const DEFAULT_JWT_SECRET = 'default_jwt_secret_for_development_only';

// Helper function to decode a token without verification
function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch (error) {
    return { error: error.message };
  }
}

// Get JWT secrets from different sources
const configSecret = config.jwtSecret || DEFAULT_JWT_SECRET;
const envSecret = process.env.JWT_SECRET || 'not_set';

console.log('=== JWT Secret Sources ===');
console.log('config.jwtSecret:', configSecret);
console.log('process.env.JWT_SECRET:', envSecret);
console.log('Are they equal?', configSecret === envSecret);
console.log('\n');

// Test token decoding
console.log('=== Testing Token Decode ===');
console.log('Please paste your access token below and press Enter:');

// Setup readline for user input
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Token: ', (token) => {
  // Clean the token in case they copied with "Bearer "
  token = token.replace('Bearer ', '').trim();
  
  console.log('\nToken Payload (decoded without verification):');
  console.log(decodeToken(token));
  
  console.log('\nVerification attempts:');
  
  try {
    const verifiedWithConfigSecret = jwt.verify(token, configSecret);
    console.log('✅ Verified with config.jwtSecret:', verifiedWithConfigSecret);
  } catch (error) {
    console.log('❌ Failed with config.jwtSecret:', error.message);
  }
  
  try {
    const verifiedWithEnvSecret = jwt.verify(token, envSecret);
    console.log('✅ Verified with process.env.JWT_SECRET:', verifiedWithEnvSecret);
  } catch (error) {
    console.log('❌ Failed with process.env.JWT_SECRET:', error.message);
  }
  
  console.log('\nTesting in both middlewares:');
  
  // Simulate middleware check for userId
  const payload = decodeToken(token);
  console.log('- utils/jwt.js looks for "userId":', payload.userId ? '✅ Found' : '❌ Not found');
  
  // Simulate middleware check for user_id
  console.log('- middlewares/authMiddleware.js looks for "user_id":', payload.user_id ? '✅ Found' : '❌ Not found');
  
  rl.close();
}); 