/**
 * WebSocket test for specific game types
 * 
 * This script tests WebSocket connection with your local server first
 * It's designed to work with both local and remote servers
 * 
 * Usage:
 * - Local test: LOCAL_TEST=true node scripts/websocket-test-specific-game.js YOUR_AUTH_TOKEN
 * - Remote test: node scripts/websocket-test-specific-game.js YOUR_AUTH_TOKEN
 */

const WebSocket = require('ws');
const http = require('http');

// Get auth token from command line args
const token = process.argv[2];
if (!token) {
  console.error('Please provide an authentication token');
  console.error('Usage: node scripts/websocket-test-specific-game.js YOUR_AUTH_TOKEN');
  console.error('For local server test: LOCAL_TEST=true node scripts/websocket-test-specific-game.js YOUR_AUTH_TOKEN');
  process.exit(1);
}

// Test configuration
const isLocal = process.env.LOCAL_TEST === 'true';
const serverPort = process.env.PORT || 5000;
const serverHost = process.env.WS_HOST || (isLocal ? 'localhost' : 'strike.atsproduct.in');
const serverProtocol = isLocal ? 'ws' : 'wss';

console.log(`===== WEBSOCKET TEST FOR ${isLocal ? 'LOCAL' : 'REMOTE'} SERVER =====`);

// First check server availability with HTTP request
const httpProtocol = isLocal ? 'http' : 'https';
const testUrl = `${httpProtocol}://${serverHost}${isLocal ? `:${serverPort}` : ''}/api/health`;

console.log(`Testing server availability: ${testUrl}`);

function testServerHealth() {
  return new Promise((resolve, reject) => {
    const req = http.get(testUrl, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Server is available');
          resolve(true);
        } else {
          console.log(`⚠️ Server responded with status code: ${res.statusCode}`);
          console.log(`Response: ${data}`);
          resolve(false);
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`❌ Server health check failed: ${error.message}`);
      resolve(false);
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      console.error('❌ Server health check timed out');
      resolve(false);
    });
  });
}

// Connect to WebSocket server
async function connectWebSocket() {
  // Check server health first (but proceed anyway)
  await testServerHealth();
  
  // Construct WebSocket URL
  const wsUrl = `${serverProtocol}://${serverHost}${isLocal ? `:${serverPort}` : ''}?token=${token}`;
  console.log(`Connecting to WebSocket: ${wsUrl}`);
  
  // Create WebSocket connection
  const ws = new WebSocket(wsUrl);
  
  // Connection opened handler
  ws.on('open', function() {
    console.log('✅ WebSocket connection established successfully');
    
    // Test sequence
    console.log('\nRunning test sequence...');
    runTestSequence(ws);
  });
  
  // Listen for messages
  ws.on('message', function(data) {
    try {
      const message = JSON.parse(data.toString());
      console.log('\n📩 Received message:', new Date().toISOString());
      console.log(JSON.stringify(message, null, 2));
    } catch (err) {
      console.log('\n📩 Received raw data:', data);
    }
  });
  
  // Handle errors
  ws.on('error', function(error) {
    console.error('❌ WebSocket error:', error.message);
  });
  
  // Handle connection close
  ws.on('close', function(code, reason) {
    console.log(`\n❌ Connection closed: Code ${code}${reason ? ', Reason: ' + reason : ''}`);
    process.exit(0);
  });
  
  // Handle CTRL+C
  process.on('SIGINT', () => {
    console.log('\nClosing connection and exiting...');
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close(1000);
    } else {
      process.exit(0);
    }
  });
  
  return ws;
}

// Run test sequence
function runTestSequence(ws) {
  // Test games with different durations
  const testCases = [
    { gameType: 'k3', duration: 60 },
    { gameType: 'wingo', duration: 60 },
    { gameType: 'dice', duration: 30 },
    { gameType: 'crash', duration: 60 }
  ];
  
  let currentTest = 0;
  
  function runNextTest() {
    if (currentTest >= testCases.length) {
      console.log('\n✅ All tests completed');
      return;
    }
    
    const test = testCases[currentTest];
    
    // Join game
    console.log(`\nTest ${currentTest + 1}/${testCases.length}: Joining ${test.gameType} game with ${test.duration}s duration`);
    ws.send(JSON.stringify({
      type: 'joinGame',
      gameType: test.gameType,
      duration: test.duration
    }));
    
    // Allow some time to receive game data
    setTimeout(() => {
      // Leave game
      console.log(`Leaving ${test.gameType} game`);
      ws.send(JSON.stringify({
        type: 'leaveGame',
        gameType: test.gameType,
        duration: test.duration
      }));
      
      currentTest++;
      
      // Wait before running next test
      setTimeout(runNextTest, 2000);
    }, 5000);
  }
  
  // Start test sequence
  runNextTest();
}

// Start the test
connectWebSocket(); 