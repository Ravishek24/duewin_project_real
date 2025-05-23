/**
 * WebSocket-only Test Script
 * 
 * Tests WebSocket connection using only the native WebSocket implementation
 * No Socket.io dependency required
 * 
 * Usage:
 * node scripts/ws-only-test.js YOUR_AUTH_TOKEN
 */

const WebSocket = require('ws');
const https = require('https');
const readline = require('readline');

// Get auth token from command line args
const token = process.argv[2];
if (!token) {
  console.error('Please provide an authentication token');
  console.error('Usage: node scripts/ws-only-test.js YOUR_AUTH_TOKEN');
  process.exit(1);
}

// WebSocket URL options
const host = process.env.WS_HOST || 'strike.atsproduct.in';
const protocol = 'wss';
const serverBasePath = process.env.WS_PATH || '';

console.log('===== WEBSOCKET-ONLY TEST =====');

// First check HTTP connectivity
console.log('\nChecking server health...');
https.get(`https://${host}/health`, (res) => {
  console.log(`✅ HTTP Status: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`Response: ${data}`);
    // Proceed with WebSocket test
    testWebSocket();
  });
}).on('error', (err) => {
  console.error(`❌ HTTP Error: ${err.message}`);
  console.log('Proceeding with WebSocket test anyway...');
  testWebSocket();
});

function testWebSocket() {
  const wsUrl = `${protocol}://${host}${serverBasePath}?token=${token}`;
  console.log(`\nConnecting to: ${wsUrl}`);
  
  // Adding headers and other options to help with troubleshooting
  const ws = new WebSocket(wsUrl, {
    headers: {
      'User-Agent': 'WebSocketTestClient/1.0'
    },
    handshakeTimeout: 15000 // 15 seconds timeout
  });
  
  // Set a connection timeout
  const connectionTimeout = setTimeout(() => {
    console.error('❌ Connection timeout after 15 seconds');
    console.log('Troubleshooting tips:');
    console.log('1. Check if the server is running and accepting WebSocket connections');
    console.log('2. Verify the token is valid and not expired');
    console.log('3. Check if a proxy/load balancer is properly configured for WebSockets');
    console.log('4. Try connecting to a different endpoint or port');
    
    ws.terminate();
  }, 15000);
  
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
    
    // Set up interactive mode
    setupPrompt(ws);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log('📩 Received message:', JSON.stringify(message, null, 2));
    } catch (err) {
      console.log('📩 Received raw data:', data);
    }
  });
  
  ws.on('error', (error) => {
    clearTimeout(connectionTimeout);
    console.error('❌ WebSocket error:', error.message);
    
    console.log('\nPossible causes:');
    console.log('1. Invalid token or authentication failure');
    console.log('2. Server not accepting WebSocket connections');
    console.log('3. Network issues or firewall blocking WebSocket traffic');
    console.log('4. Proxy misconfiguration');
    
    // Try to print more detailed error info if available
    if (error.code) {
      console.log(`Error code: ${error.code}`);
    }
  });
  
  ws.on('close', (code, reason) => {
    clearTimeout(connectionTimeout);
    console.log(`\n❌ Connection closed: Code ${code}${reason ? ', Reason: ' + reason : ''}`);
    
    // Provide guidance based on close code
    switch (code) {
      case 1000:
        console.log('Normal closure - connection closed cleanly');
        break;
      case 1001:
        console.log('Server going down or client navigated away');
        break;
      case 1002:
        console.log('Protocol error');
        break;
      case 1003:
        console.log('Unsupported data received');
        break;
      case 1006:
        console.log('Abnormal closure - no close frame received');
        console.log('This often indicates network issues or server crash');
        break;
      case 1008:
        console.log('Policy violation - likely auth error');
        break;
      case 1011:
        console.log('Server encountered an error');
        break;
      case 1012:
        console.log('Server is restarting');
        break;
      case 1013:
        console.log('Try again later - server is temporarily unavailable');
        break;
      case 1015:
        console.log('TLS handshake failed');
        break;
      default:
        if (code >= 4000) {
          console.log('Application-specific close code');
        }
    }
  });
  
  ws.on('upgrade', (response) => {
    console.log('✅ WebSocket upgrade successful');
  });
  
  ws.on('unexpected-response', (req, res) => {
    clearTimeout(connectionTimeout);
    console.error(`❌ Unexpected response: HTTP ${res.statusCode}`);
    
    // Read and display response body
    let body = '';
    res.on('data', (chunk) => {
      body += chunk;
    });
    
    res.on('end', () => {
      console.log('Response headers:', res.headers);
      console.log('Response body:', body);
      
      if (res.statusCode === 401 || res.statusCode === 403) {
        console.log('Authentication error - token may be invalid or expired');
      } else if (res.statusCode === 502) {
        console.log('Bad Gateway - proxy error or server unavailable');
        console.log('Check NGINX/proxy configuration for WebSocket support');
      } else if (res.statusCode === 503) {
        console.log('Service Unavailable - server may be down or overloaded');
      }
    });
  });
}

function setupPrompt(ws) {
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
          ws.close(1000);
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
    const message = {
      type: type,
      ...data,
      timestamp: new Date().toISOString()
    };
    ws.send(JSON.stringify(message));
    console.log(`📤 Sent message:`, JSON.stringify(message, null, 2));
  }
  
  // Handle CTRL+C
  process.on('SIGINT', () => {
    console.log('\nClosing connection and exiting...');
    ws.close(1000);
    rl.close();
    process.exit(0);
  });
} 