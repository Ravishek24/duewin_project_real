/**
 * Local WebSocket Connection Test
 * 
 * This is a minimal script to test WebSocket connection to the local server
 * that runs in the same process as your Node.js application.
 * 
 * Usage:
 * node scripts/test-local-websocket.js
 */

const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const http = require('http');

// Load environment variables
dotenv.config();

// Check JWT_SECRET
if (!process.env.JWT_SECRET) {
  console.error('Error: JWT_SECRET is not defined in .env file');
  process.exit(1);
}

// Create a test user token directly (no need to use existing generate-test-token.js)
const generateToken = (userId = 1) => {
  const payload = {
    userId,
    role: 'user',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60)
  };
  return jwt.sign(payload, process.env.JWT_SECRET);
};

console.log('===== LOCAL WEBSOCKET TEST =====');

// Create HTTP Server (if needed for local testing)
const httpServer = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket test server');
});

// Create WebSocket server
const wss = new WebSocket.Server({ 
  server: httpServer, 
  path: '/'
});

// Handle WebSocket connections
wss.on('connection', function(ws, req) {
  console.log('Client connected');
  
  ws.on('message', function(message) {
    try {
      const data = JSON.parse(message);
      console.log('Received message:', data);
      
      // Echo back the message
      ws.send(JSON.stringify({
        type: 'echo',
        message: data,
        timestamp: new Date().toISOString()
      }));
      
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });
  
  ws.on('close', function() {
    console.log('Client disconnected');
  });
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    message: 'Welcome to the test WebSocket server',
    timestamp: new Date().toISOString()
  }));
});

// Start server
const PORT = process.env.WS_TEST_PORT || 8080;
httpServer.listen(PORT, () => {
  console.log(`Test server listening on port ${PORT}`);
  
  // Generate test token
  const token = generateToken();
  console.log('\nTest token generated:', token);
  
  // Connection URL for clients
  console.log(`\nConnect to: ws://localhost:${PORT}?token=${token}`);
  console.log('\nPress Ctrl+C to exit');
});

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 