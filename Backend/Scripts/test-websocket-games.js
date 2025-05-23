/**
 * WebSocket connection test script for internal games
 * 
 * This script connects to the WebSocket server and tests game-related features
 * 
 * Usage:
 * node scripts/test-websocket-games.js YOUR_AUTH_TOKEN
 */

const WebSocket = require('ws');
const readline = require('readline');

// Get auth token from command line args
const token = process.argv[2];
if (!token) {
  console.error('Please provide an authentication token');
  console.error('Usage: node scripts/test-websocket-games.js YOUR_AUTH_TOKEN');
  process.exit(1);
}

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('===== INTERNAL GAMES WEBSOCKET TEST =====');

// For testing local server
const isLocal = process.env.LOCAL_TEST === 'true';

// WebSocket URL options
const host = process.env.WS_HOST || (isLocal ? 'localhost' : 'strike.atsproduct.in');
const port = process.env.WS_PORT || '5000';
const protocol = isLocal ? 'ws' : 'wss';
const serverBasePath = process.env.SERVER_PATH || '';

// WebSocket URL - construct based on environment
const wsUrl = isLocal 
  ? `${protocol}://${host}:${port}${serverBasePath}?token=${token}`
  : `${protocol}://${host}${serverBasePath}?token=${token}`;

console.log(`Connecting to: ${wsUrl}`);

// Create WebSocket connection
let ws;
let gameJoined = false;

function connectWebSocket() {
  ws = new WebSocket(wsUrl);
  
  // Connection opened handler
  ws.on('open', function() {
    console.log('✅ Connection established successfully');
    console.log('Available commands:');
    console.log('  join <gameType> <duration> - Join a game room');
    console.log('  bet <amount> <betType> <value> - Place a bet');
    console.log('  leave - Leave the current game room');
    console.log('  exit - Close connection and exit');
    
    // Start command prompt
    promptUser();
  });
  
  // Listen for messages
  ws.on('message', function(data) {
    try {
      const message = JSON.parse(data.toString());
      console.log('\n📩 Received message:');
      console.log(JSON.stringify(message, null, 2));
      promptUser();
    } catch (err) {
      console.log('\n📩 Received raw data:', data);
      promptUser();
    }
  });
  
  // Handle errors
  ws.on('error', function(error) {
    console.error('❌ WebSocket error:', error.message);
  });
  
  // Handle connection close
  ws.on('close', function(code, reason) {
    console.log(`\n❌ Connection closed: Code ${code}${reason ? ', Reason: ' + reason : ''}`);
    if (code !== 1000) { // 1000 is normal closure
      console.log('Attempting to reconnect in 5 seconds...');
      setTimeout(connectWebSocket, 5000);
    } else {
      process.exit(0);
    }
  });
}

// Prompt user for input
function promptUser() {
  rl.question('\n> ', (input) => {
    const args = input.trim().split(' ');
    const command = args[0].toLowerCase();
    
    switch (command) {
      case 'join':
        handleJoin(args);
        break;
      case 'bet':
        handleBet(args);
        break;
      case 'leave':
        handleLeave();
        break;
      case 'exit':
        handleExit();
        break;
      default:
        console.log('Unknown command. Available commands: join, bet, leave, exit');
        promptUser();
    }
  });
}

// Join game handler
function handleJoin(args) {
  if (args.length < 3) {
    console.log('Usage: join <gameType> <duration>');
    console.log('Example: join k3 60');
    console.log('Available games: k3, crash, dice, wingo');
    promptUser();
    return;
  }
  
  const gameType = args[1];
  const duration = parseInt(args[2]);
  
  // Validate game type
  const validGameTypes = ['k3', 'crash', 'dice', 'wingo'];
  if (!validGameTypes.includes(gameType)) {
    console.log(`Invalid game type. Choose from: ${validGameTypes.join(', ')}`);
    promptUser();
    return;
  }
  
  // Validate duration
  const validDurations = [30, 60, 180, 300, 600];
  if (!validDurations.includes(duration)) {
    console.log(`Invalid duration. Choose from: ${validDurations.join(', ')}`);
    promptUser();
    return;
  }
  
  // Send join request
  const joinMessage = {
    type: 'joinGame',
    gameType: gameType,
    duration: duration
  };
  
  ws.send(JSON.stringify(joinMessage));
  gameJoined = true;
  console.log(`Sent join request for ${gameType} with ${duration}s duration`);
}

// Place bet handler
function handleBet(args) {
  if (!gameJoined) {
    console.log('You must join a game first');
    promptUser();
    return;
  }
  
  if (args.length < 4) {
    console.log('Usage: bet <amount> <betType> <value>');
    console.log('Example: bet 100 color red');
    promptUser();
    return;
  }
  
  const amount = parseFloat(args[1]);
  const betType = args[2];
  const betValue = args[3];
  
  if (isNaN(amount) || amount <= 0) {
    console.log('Amount must be a positive number');
    promptUser();
    return;
  }
  
  // Send bet request
  const betMessage = {
    type: 'placeBet',
    amount: amount,
    betType: betType,
    betValue: betValue
  };
  
  ws.send(JSON.stringify(betMessage));
  console.log(`Sent bet: ${amount} on ${betType}=${betValue}`);
}

// Leave game handler
function handleLeave() {
  if (!gameJoined) {
    console.log('You are not in any game');
    promptUser();
    return;
  }
  
  // Send leave request
  const leaveMessage = {
    type: 'leaveGame'
  };
  
  ws.send(JSON.stringify(leaveMessage));
  gameJoined = false;
  console.log('Sent leave request');
}

// Exit handler
function handleExit() {
  console.log('Closing connection and exiting...');
  if (ws) {
    ws.close(1000);
  }
  rl.close();
  process.exit(0);
}

// Handle CTRL+C
process.on('SIGINT', handleExit);

// Start connection
connectWebSocket(); 