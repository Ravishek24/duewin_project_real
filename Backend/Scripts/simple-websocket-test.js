/**
 * Simple WebSocket test script
 * 
 * This script simply connects to the WebSocket server and listens for events
 * No interactive commands - just establishes connection and shows incoming messages
 * 
 * Usage:
 * node scripts/simple-websocket-test.js YOUR_AUTH_TOKEN [game_type] [duration]
 * 
 * Examples:
 * - Just connect: node scripts/simple-websocket-test.js YOUR_AUTH_TOKEN
 * - Connect and join game: node scripts/simple-websocket-test.js YOUR_AUTH_TOKEN k3 60
 */

const WebSocket = require('ws');

// Get parameters from command line args
const token = process.argv[2];
const gameType = process.argv[3]; // Optional
const duration = process.argv[4] ? parseInt(process.argv[4]) : null; // Optional

if (!token) {
  console.error('Please provide an authentication token');
  console.error('Usage: node scripts/simple-websocket-test.js YOUR_AUTH_TOKEN [game_type] [duration]');
  process.exit(1);
}

// For testing local server
const isLocal = process.env.LOCAL_TEST === 'true';

// WebSocket URL options (use environment variables if available)
const host = process.env.WS_HOST || (isLocal ? 'localhost' : 'strike.atsproduct.in');
const port = process.env.WS_PORT || '5000';
const protocol = isLocal ? 'ws' : 'wss';
const serverBasePath = process.env.SERVER_PATH || '';

// WebSocket URL - construct based on environment
const wsUrl = isLocal 
  ? `${protocol}://${host}:${port}${serverBasePath}?token=${token}`
  : `${protocol}://${host}${serverBasePath}?token=${token}`;

console.log('===== SIMPLE WEBSOCKET TEST =====');
console.log(`Connecting to: ${wsUrl}`);
if (gameType && duration) {
  console.log(`Will join game: ${gameType} with duration: ${duration}s`);
}

// Create WebSocket connection
const ws = new WebSocket(wsUrl);

// Connection opened handler
ws.on('open', function() {
  console.log('✅ Connection established successfully');
  console.log('Listening for events...');
  console.log('Press Ctrl+C to exit');
  
  // If game type and duration are provided, join the game automatically
  if (gameType && duration) {
    const joinMessage = {
      type: 'joinGame',
      gameType: gameType,
      duration: duration
    };
    
    ws.send(JSON.stringify(joinMessage));
    console.log(`Sent join request for ${gameType} with ${duration}s duration`);
  }
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
  if (ws) {
    ws.close(1000);
  }
  process.exit(0);
}); 