/**
 * WebSocket Ping Test
 * 
 * A minimal script to test if the WebSocket server responds to basic messages
 * This is useful for debugging when game-specific messages don't get responses
 * 
 * Usage:
 * node scripts/websocket-ping-test.js YOUR_AUTH_TOKEN
 */

const WebSocket = require('ws');
const readline = require('readline');

// Get auth token from command line args
const token = process.argv[2];
if (!token) {
  console.error('Please provide an authentication token');
  console.error('Usage: node scripts/websocket-ping-test.js YOUR_AUTH_TOKEN');
  process.exit(1);
}

// WebSocket URL options
const host = process.env.WS_HOST || 'strike.atsproduct.in';
const protocol = 'wss';
const serverBasePath = process.env.WS_PATH || '';
const wsUrl = `${protocol}://${host}${serverBasePath}?token=${token}`;

console.log('===== WEBSOCKET PING TEST =====');
console.log(`Connecting to: ${wsUrl}`);

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Create WebSocket connection
const ws = new WebSocket(wsUrl);

// Connection opened handler
ws.on('open', function() {
  console.log('✅ Connection established successfully');
  console.log('\nSending a series of test messages...');
  
  // Send a ping message
  sendMessage('ping', {timestamp: new Date().toISOString()});
  
  // After 2 seconds, try a basic system message
  setTimeout(() => {
    sendMessage('system', {action: 'status'});
  }, 2000);
  
  // After 4 seconds, try a getActiveGames message
  setTimeout(() => {
    sendMessage('getActiveGames', {});
  }, 4000);
  
  // After 6 seconds, try an echo message
  setTimeout(() => {
    sendMessage('echo', {text: 'Hello server!'});
  }, 6000);
  
  // Start prompt for custom messages
  setTimeout(() => {
    promptForMessage();
  }, 8000);
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

// Send a message
function sendMessage(type, data) {
  const message = {
    type: type,
    ...data,
    timestamp: new Date().toISOString()
  };
  
  ws.send(JSON.stringify(message));
  console.log(`\n📤 Sent ${type} message:`, JSON.stringify(message, null, 2));
}

// Prompt for custom message
function promptForMessage() {
  console.log('\n=== Custom Message Options ===');
  console.log('1. Send ping');
  console.log('2. Request server status');
  console.log('3. Try joining k3 game');
  console.log('4. Try joining wingo game');
  console.log('5. Enter custom message');
  console.log('6. Exit');
  
  rl.question('\nEnter option (1-6): ', (input) => {
    const option = parseInt(input.trim());
    
    switch(option) {
      case 1:
        sendMessage('ping', {});
        break;
      case 2:
        sendMessage('system', {action: 'status'});
        break;
      case 3:
        sendMessage('joinGame', {gameType: 'k3', duration: 60});
        break;
      case 4:
        sendMessage('joinGame', {gameType: 'wingo', duration: 60});
        break;
      case 5:
        rl.question('Enter message type: ', (type) => {
          rl.question('Enter JSON data (or leave empty): ', (dataStr) => {
            try {
              const data = dataStr ? JSON.parse(dataStr) : {};
              sendMessage(type, data);
            } catch (err) {
              console.error('Invalid JSON:', err.message);
            }
            promptForMessage();
          });
        });
        return; // Skip the promptForMessage below as we'll call it after nested prompt
      case 6:
        console.log('Closing connection and exiting...');
        ws.close(1000);
        rl.close();
        process.exit(0);
        return;
      default:
        console.log('Invalid option');
    }
    
    // Prompt again after a short delay
    setTimeout(promptForMessage, 1000);
  });
}

// Handle CTRL+C
process.on('SIGINT', () => {
  console.log('\nClosing connection and exiting...');
  if (ws) {
    ws.close(1000);
  }
  rl.close();
  process.exit(0);
}); 