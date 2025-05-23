/**
 * Improved WebSocket Test
 * 
 * Tests WebSocket connection with more detailed error handling
 * Works with both native WebSocket and Socket.io implementations
 * 
 * Usage:
 * node scripts/improved-websocket-test.js YOUR_AUTH_TOKEN
 * 
 * Options:
 * --socketio : Force Socket.io mode
 * --native : Force native WebSocket mode
 */

const WebSocket = require('ws');
const readline = require('readline');
const https = require('https');

// Parse command line arguments
const args = process.argv.slice(2);
const token = args.find(arg => !arg.startsWith('--'));
const useSocketIo = args.includes('--socketio');
const useNative = args.includes('--native');

if (!token) {
  console.error('Please provide an authentication token');
  console.error('Usage: node scripts/improved-websocket-test.js YOUR_AUTH_TOKEN');
  console.error('Options:');
  console.error('  --socketio : Force Socket.io mode');
  console.error('  --native : Force native WebSocket mode');
  process.exit(1);
}

// WebSocket URL options
const host = process.env.WS_HOST || 'strike.atsproduct.in';
const protocol = 'wss';
const serverBasePath = process.env.WS_PATH || '';

// Determine connection mode
const mode = useSocketIo ? 'socketio' : (useNative ? 'native' : 'auto');

console.log('===== IMPROVED WEBSOCKET TEST =====');
console.log(`Mode: ${mode.toUpperCase()}`);

// First check HTTP connectivity
console.log('\nChecking server connectivity...');
checkServerHealth(`https://${host}/health`).then(isHealthy => {
  if (!isHealthy) {
    console.error('❌ Server is not responding to health checks');
    console.error('This indicates the server may be down or unreachable');
    process.exit(1);
  }
  
  if (mode === 'socketio' || mode === 'auto') {
    testSocketIo();
  } else {
    testNativeWebSocket();
  }
}).catch(err => {
  console.error('❌ Error checking server health:', err.message);
  
  // Continue anyway with tests
  if (mode === 'socketio' || mode === 'auto') {
    testSocketIo();
  } else {
    testNativeWebSocket();
  }
});

// Test native WebSocket implementation
function testNativeWebSocket() {
  console.log('\nTesting Native WebSocket...');
  
  const wsUrl = `${protocol}://${host}${serverBasePath}?token=${token}`;
  console.log(`Connecting to: ${wsUrl}`);
  
  const ws = new WebSocket(wsUrl, {
    headers: {
      'User-Agent': 'WebSocketTestClient/1.0'
    }
  });
  
  // Set a connection timeout
  const connectionTimeout = setTimeout(() => {
    console.error('❌ Connection timeout after 10 seconds');
    ws.terminate();
    
    if (mode === 'auto') {
      console.log('\nFalling back to Socket.io implementation...');
      testSocketIo();
    }
  }, 10000);
  
  ws.on('open', () => {
    clearTimeout(connectionTimeout);
    console.log('✅ Connection established successfully');
    
    // Send a ping message
    const pingMessage = {
      type: 'ping',
      timestamp: new Date().toISOString()
    };
    
    ws.send(JSON.stringify(pingMessage));
    console.log('📤 Sent ping message');
    
    // Set up a response timeout
    setTimeout(() => {
      console.log('⚠️ No response received within 5 seconds');
      
      if (mode === 'auto') {
        ws.close();
        console.log('\nFalling back to Socket.io implementation...');
        testSocketIo();
      }
    }, 5000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📩 Received message:', JSON.stringify(message, null, 2));
      
      if (mode === 'native') {
        // If in native mode, prompt for next action
        setupPrompt(ws);
      }
    } catch (err) {
      console.log('📩 Received raw data:', data);
    }
  });
  
  ws.on('error', (error) => {
    clearTimeout(connectionTimeout);
    console.error('❌ WebSocket error:', error.message);
    
    if (mode === 'auto') {
      console.log('\nFalling back to Socket.io implementation...');
      testSocketIo();
    }
  });
  
  ws.on('close', (code, reason) => {
    clearTimeout(connectionTimeout);
    if (code !== 1000) {
      console.log(`❌ Connection closed: Code ${code}${reason ? ', Reason: ' + reason : ''}`);
    }
  });
}

// Test Socket.io implementation
function testSocketIo() {
  console.log('\nTesting Socket.io...');
  console.log('Loading Socket.io client...');
  
  // Dynamically load socket.io-client to avoid requiring it if not needed
  let io;
  try {
    io = require('socket.io-client');
  } catch (err) {
    console.error('❌ Cannot load socket.io-client. Try installing it with:');
    console.error('npm install socket.io-client');
    process.exit(1);
  }
  
  const socketUrl = `https://${host}`;
  console.log(`Connecting to: ${socketUrl}`);
  
  const socket = io(socketUrl, {
    transports: ['websocket'],
    auth: { token },
    query: { token }
  });
  
  // Set a connection timeout
  const connectionTimeout = setTimeout(() => {
    console.error('❌ Socket.io connection timeout after 10 seconds');
    socket.disconnect();
    process.exit(1);
  }, 10000);
  
  socket.on('connect', () => {
    clearTimeout(connectionTimeout);
    console.log('✅ Socket.io connection established successfully');
    
    // Send a ping message
    socket.emit('ping', { timestamp: new Date().toISOString() });
    console.log('📤 Sent ping event');
    
    // Set up event listeners
    setupSocketListeners(socket);
    
    // Set up readline interface for commands
    setupPrompt(socket, true);
  });
  
  socket.on('connect_error', (error) => {
    clearTimeout(connectionTimeout);
    console.error('❌ Socket.io connection error:', error.message);
    
    if (mode === 'auto') {
      console.log('\nFalling back to native WebSocket...');
      testNativeWebSocket();
    } else {
      process.exit(1);
    }
  });
}

// Setup Socket.io event listeners
function setupSocketListeners(socket) {
  const events = ['pong', 'message', 'game_update', 'notification', 'error'];
  
  events.forEach(event => {
    socket.on(event, (data) => {
      console.log(`📩 Received '${event}' event:`, JSON.stringify(data, null, 2));
    });
  });
  
  // Generic event handler for unknown events
  socket.onAny((event, ...args) => {
    if (!events.includes(event)) {
      console.log(`📩 Received '${event}' event:`, JSON.stringify(args, null, 2));
    }
  });
}

// Setup command prompt
function setupPrompt(client, isSocketIo = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\n=== Available Commands ===');
  console.log('1. Send ping');
  console.log('2. Request status');
  console.log('3. Join game');
  console.log('4. Custom message');
  console.log('5. Exit');
  
  promptForCommand();
  
  function promptForCommand() {
    rl.question('\nEnter command (1-5): ', (input) => {
      const command = parseInt(input.trim());
      
      switch(command) {
        case 1:
          sendMessage('ping', {});
          break;
        case 2:
          sendMessage('status', {});
          break;
        case 3:
          rl.question('Enter game type (k3, wingo, etc): ', (gameType) => {
            rl.question('Enter duration (seconds): ', (duration) => {
              sendMessage('joinGame', {
                gameType: gameType.trim(),
                duration: parseInt(duration.trim())
              });
              promptForCommand();
            });
          });
          return;
        case 4:
          rl.question('Enter message type: ', (type) => {
            rl.question('Enter JSON data (or leave empty): ', (dataStr) => {
              try {
                const data = dataStr ? JSON.parse(dataStr) : {};
                sendMessage(type.trim(), data);
              } catch (err) {
                console.error('Invalid JSON:', err.message);
              }
              promptForCommand();
            });
          });
          return;
        case 5:
          console.log('Closing connection and exiting...');
          if (isSocketIo) {
            client.disconnect();
          } else {
            client.close(1000);
          }
          rl.close();
          process.exit(0);
          return;
        default:
          console.log('Invalid command');
      }
      
      promptForCommand();
    });
  }
  
  function sendMessage(type, data) {
    if (isSocketIo) {
      // Socket.io send
      client.emit(type, data);
      console.log(`📤 Sent '${type}' event:`, JSON.stringify(data, null, 2));
    } else {
      // Native WebSocket send
      const message = {
        type: type,
        ...data,
        timestamp: new Date().toISOString()
      };
      client.send(JSON.stringify(message));
      console.log(`📤 Sent message:`, JSON.stringify(message, null, 2));
    }
  }
  
  // Handle CTRL+C
  process.on('SIGINT', () => {
    console.log('\nClosing connection and exiting...');
    if (isSocketIo) {
      client.disconnect();
    } else {
      client.close(1000);
    }
    rl.close();
    process.exit(0);
  });
}

// Check if server is healthy
async function checkServerHealth(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      console.log(`✅ Server health check: HTTP ${res.statusCode}`);
      resolve(res.statusCode >= 200 && res.statusCode < 300);
    }).on('error', (err) => {
      console.error(`❌ Server health check failed: ${err.message}`);
      resolve(false);
    });
  });
} 