/**
 * JWT Token Generator for Testing
 * 
 * This script generates JWT tokens for testing the API and WebSocket connections.
 * 
 * Usage:
 * node generate-test-token.js [userId]
 * 
 * If userId is not provided, it defaults to 1
 */

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Get JWT secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET;

// Check if JWT_SECRET exists
if (!JWT_SECRET) {
  console.error('Error: JWT_SECRET is not defined in .env file');
  console.error('Please add JWT_SECRET=your_secret_value to your .env file');
  process.exit(1);
}

// Get user ID from command line args or default to 1
const userId = parseInt(process.argv[2]) || 1;

// Generate token with 1-hour expiration
const generateToken = (userId) => {
  const payload = {
    userId: userId,
    role: 'user',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour expiration
  };

  return jwt.sign(payload, JWT_SECRET);
};

const token = generateToken(userId);

console.log('===== JWT TOKEN FOR TESTING =====');
console.log(`\nGenerated token for userId: ${userId}`);
console.log('\nToken:');
console.log(token);

// Debug token information
const decoded = jwt.verify(token, JWT_SECRET);
console.log('\nToken payload:');
console.log(JSON.stringify(decoded, null, 2));

// Calculate expiration time
const expirationDate = new Date(decoded.exp * 1000);
console.log(`\nExpires at: ${expirationDate.toLocaleString()}`);

// Save to file for convenience
const outputDir = path.join(__dirname, 'temp');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

const outputFile = path.join(outputDir, `token-${userId}.txt`);
fs.writeFileSync(outputFile, token);
console.log(`\nToken saved to: ${outputFile}`);

console.log('\nUse this token for testing WebSocket connections:');
console.log(`node scripts/test-websocket-games.js ${token}`);
console.log('or');
console.log(`node scripts/simple-websocket-test.js ${token}`); 