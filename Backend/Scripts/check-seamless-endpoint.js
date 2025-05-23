/**
 * Simple TCP connection check for Strike API endpoint
 * 
 * This script performs a low-level connection test to verify if the 
 * endpoint server is responsive, regardless of authentication issues.
 * 
 * Usage: node scripts/check-seamless-endpoint.js
 */

const net = require('net');
const https = require('https');
const url = require('url');

// Target URL
const targetUrl = 'https://strike.atsproduct.in/api/seamless/games';
const parsedUrl = url.parse(targetUrl);
const hostname = parsedUrl.hostname;
const port = parsedUrl.port || 443; // Default HTTPS port

console.log(`===== CONNECTION TEST FOR ${targetUrl} =====`);

// Test 1: Basic TCP connection
console.log(`\n1. Testing TCP connection to ${hostname}:${port}...`);
const tcpStart = Date.now();

const socket = net.createConnection({
  host: hostname,
  port: port,
  timeout: 10000 // 10 seconds timeout
}, () => {
  const connectTime = Date.now() - tcpStart;
  console.log(`✅ TCP connection successful in ${connectTime}ms`);
  socket.end();
});

socket.on('error', (err) => {
  console.error(`❌ TCP connection failed: ${err.message}`);
});

socket.on('timeout', () => {
  console.error('❌ TCP connection timed out after 10 seconds');
  socket.destroy();
});

// Test 2: HTTPS GET request
console.log(`\n2. Testing HTTPS GET request to ${targetUrl}...`);
console.log('   (This test ignores response codes, just tests connectivity)');

const requestOptions = {
  hostname: hostname,
  port: port,
  path: parsedUrl.path,
  method: 'GET',
  timeout: 20000, // 20 seconds timeout
  headers: {
    'User-Agent': 'Connection-Test-Script'
  }
};

const httpStart = Date.now();
const req = https.request(requestOptions, (res) => {
  const responseTime = Date.now() - httpStart;
  console.log(`✅ HTTP response received in ${responseTime}ms`);
  console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
  console.log(`   Headers: ${JSON.stringify(res.headers, null, 2)}`);
  
  // Don't read the body for this test
  res.on('data', () => {});
  
  res.on('end', () => {
    console.log('\n===== CONNECTION TEST COMPLETE =====');
    // Exit after both tests have completed
    if (socket.destroyed) {
      process.exit(0);
    }
  });
});

req.on('error', (err) => {
  console.error(`❌ HTTP request failed: ${err.message}`);
});

req.on('timeout', () => {
  console.error('❌ HTTP request timed out after 20 seconds');
  req.destroy();
});

req.end();

// Allow process to run for max 30 seconds before forcing exit
setTimeout(() => {
  console.log('⚠️ Force exiting after 30 seconds timeout');
  process.exit(1);
}, 30000); 