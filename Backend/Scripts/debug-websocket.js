/**
 * WebSocket Connection Debugger
 * 
 * Tests both ws and Socket.io implementations to identify which one is working
 * 
 * Usage:
 * node scripts/debug-websocket.js YOUR_AUTH_TOKEN
 */

const WebSocket = require('ws');
const io = require('socket.io-client');
const http = require('http');

// Get auth token from command line args
const token = process.argv[2];
if (!token) {
  console.error('Please provide an authentication token');
  console.error('Usage: node scripts/debug-websocket.js YOUR_AUTH_TOKEN');
  process.exit(1);
}

// Target server configuration
const host = 'strike.atsproduct.in';
const wsUrl = `wss://${host}?token=${token}`;
const socketIoUrl = `https://${host}`;

console.log('===== WEBSOCKET CONNECTION DEBUG =====');
console.log('Testing both WebSocket implementations to identify issues\n');

// First try native WebSocket
console.log('STEP 1: Testing Native WebSocket (ws) Connection...');
console.log(`Connecting to: ${wsUrl}`);

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('✅ Native WebSocket connection successful!');
  
  // Send a ping message
  const pingMessage = {
    type: 'ping',
    timestamp: new Date().toISOString()
  };
  
  console.log('Sending ping message...');
  ws.send(JSON.stringify(pingMessage));
  
  // Close after 5 seconds to continue testing
  setTimeout(() => {
    console.log('Closing native WebSocket connection...');
    ws.close();
    testSocketIo();
  }, 5000);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log('📩 Received response:', JSON.stringify(message, null, 2));
  } catch (err) {
    console.log('📩 Received raw data:', data);
  }
});

ws.on('error', (error) => {
  console.error('❌ Native WebSocket error:', error.message);
  console.log('Moving to next test...');
  testSocketIo();
});

ws.on('close', (code, reason) => {
  if (code !== 1000) {
    console.log(`❌ Native WebSocket closed with code ${code}${reason ? ', reason: ' + reason : ''}`);
  }
});

// Then try Socket.io
function testSocketIo() {
  console.log('\nSTEP 2: Testing Socket.io Connection...');
  console.log(`Connecting to: ${socketIoUrl}`);
  
  const socket = io(socketIoUrl, {
    transports: ['websocket'],
    auth: { token }
  });
  
  socket.on('connect', () => {
    console.log('✅ Socket.io connection successful!');
    
    // Send a test event
    console.log('Sending test event...');
    socket.emit('ping', { timestamp: new Date().toISOString() });
    
    // Close after 5 seconds
    setTimeout(() => {
      console.log('Closing Socket.io connection...');
      socket.close();
      console.log('\nTesting complete. Check results above to determine which implementation is working.');
      
      // Print connection summary
      printSummary();
    }, 5000);
  });
  
  socket.on('pong', (data) => {
    console.log('📩 Received pong response:', JSON.stringify(data, null, 2));
  });
  
  socket.on('connect_error', (error) => {
    console.error('❌ Socket.io connection error:', error.message);
    
    // Print connection summary
    printSummary();
  });
}

// Test HTTP endpoint for backend availability
console.log('\nSTEP 0: Testing HTTP connectivity to server...');
http.get(`https://${host}/health`, (res) => {
  console.log(`✅ HTTP Status: ${res.statusCode}`);
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`Response: ${data}`);
  });
}).on('error', (err) => {
  console.error(`❌ HTTP Error: ${err.message}`);
});

function printSummary() {
  console.log('\n===== CONNECTION SUMMARY =====');
  console.log('If both WebSocket implementations failed:');
  console.log('1. Check if the server is running (HTTP health check should be successful)');
  console.log('2. Verify your token is valid and not expired');
  console.log('3. Check server logs for errors in WebSocket initialization');
  console.log('4. Ensure Redis is connected if using Socket.io with Redis adapter');
  console.log('\nIf one implementation works but the other fails:');
  console.log('- Update your client code to use the working implementation');
  console.log('- Check server configuration to ensure both implementations are properly initialized');
} 