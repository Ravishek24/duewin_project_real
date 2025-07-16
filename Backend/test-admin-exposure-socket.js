// test-admin-exposure-socket.js
// Usage: node test-admin-exposure-socket.js
// Optionally set ADMIN_TOKEN and SERVER_URL as environment variables

const { io } = require('socket.io-client');
const readline = require('readline');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:8000';

function promptForToken(callback) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter your admin token: ', (token) => {
    rl.close();
    callback(token);
  });
}

function startSocketTest(token) {
  const socket = io(`${SERVER_URL}/admin`, {
    auth: { token },
    transports: ['websocket']
  });

  socket.on('connect', () => {
    console.log('✅ Connected to /admin namespace');
    socket.emit('subscribeToAllWingoRooms');
  });

  socket.on('disconnect', () => {
    console.log('❌ Disconnected from server');
  });

  socket.on('wingoExposureUpdate', (data) => {
    console.log('\n[Wingo Exposure Update]', JSON.stringify(data, null, 2));
  });

  socket.on('allWingoRoomsUpdate', (data) => {
    console.log('\n[All Wingo Rooms Update]', JSON.stringify(data, null, 2));
  });

  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });

  socket.on('connect_error', (err) => {
    console.error('Connection error:', err.message);
  });
}

if (ADMIN_TOKEN) {
  startSocketTest(ADMIN_TOKEN);
} else {
  promptForToken(startSocketTest);
} 