/**
 * Get WebSocket URL
 * 
 * This script prints the WebSocket URL based on your application's configuration.
 * 
 * Usage:
 * node scripts/get-websocket-url.js [env_file_path]
 */

const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// Load environment variables
const envPath = process.argv[2] || path.join(__dirname, '..', '.env');

console.log(`Loading environment from: ${envPath}`);

try {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
    console.log('Environment file loaded successfully');
  } else {
    console.log('No .env file found, using default values');
    dotenv.config();
  }
} catch (error) {
  console.error('Error loading environment:', error.message);
}

// Detect environment
const isProduction = process.env.NODE_ENV === 'production';
const port = process.env.PORT || 5000;
const host = process.env.WS_HOST || process.env.HOST || 'strike.atsproduct.in'; 

// Display WebSocket URLs
console.log('\n===== WEBSOCKET CONNECTION URLS =====\n');

// WebSocket URL (secure and non-secure)
const protocol = isProduction ? 'wss' : 'ws';
const wsPort = isProduction ? '' : `:${port}`;
const wsPath = process.env.WS_PATH || '';

console.log(`WebSocket URL (${isProduction ? 'Production' : 'Development'}):`);
console.log(`${protocol}://${host}${wsPort}${wsPath}`);

// Debug info
console.log('\nConfiguration values:');
console.log(`- NODE_ENV: ${process.env.NODE_ENV || 'not set (using development)'}`);
console.log(`- Host: ${host} (from ${process.env.WS_HOST ? 'WS_HOST' : (process.env.HOST ? 'HOST' : 'default')})`);
console.log(`- Port: ${port} (from ${process.env.PORT ? 'PORT env' : 'default'})`);
console.log(`- Protocol: ${protocol}`);

// Generate a test token if JWT_SECRET is available
if (process.env.JWT_SECRET) {
  const payload = {
    userId: 1,
    role: 'user',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
  };
  
  try {
    const token = jwt.sign(payload, process.env.JWT_SECRET);
    console.log('\nTest URL with token:');
    console.log(`${protocol}://${host}${wsPort}${wsPath}?token=${token}`);
    
    // Command to run test
    console.log('\nTest commands:');
    console.log(`node scripts/simple-websocket-test.js ${token}`);
    console.log(`\nOr with specific game:`);
    console.log(`node scripts/simple-websocket-test.js ${token} k3 60`);
  } catch (error) {
    console.error('\nFailed to generate test token:', error.message);
  }
} else {
  console.log('\nNo JWT_SECRET found in environment. Cannot generate test token.');
  console.log('Add JWT_SECRET to your .env file to generate test tokens.');
}

console.log('\n====================================='); 