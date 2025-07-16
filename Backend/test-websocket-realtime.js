const io = require('socket.io-client');

const ADMIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjozLCJpc19hZG1pbiI6dHJ1ZSwiaWF0IjoxNzUyNDU4MDY4LCJleHAiOjE3NTI1NDQ0Njh9.kxUHGmTKb0Vw_fAFuAsPH5UryCYH5IEJqE6RYk7aLe0';

const socket = io('http://localhost:8000/admin-exposure', {
  auth: { token: ADMIN_TOKEN }
});

console.log('🔌 Connecting to WebSocket...');

// Connection events
socket.on('connect', () => {
  console.log('✅ Connected to admin exposure WebSocket');
  console.log('📡 Socket ID:', socket.id);
  
  // Subscribe to all Wingo rooms
  const rooms = ['wingo-30s', 'wingo-60s', 'wingo-180s', 'wingo-300s'];
  rooms.forEach(room => {
    socket.emit('subscribe-room', { room });
    console.log(`📡 Subscribed to ${room}`);
  });
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Disconnected:', reason);
});

// Real-time data events
socket.on('period-countdown', (data) => {
  const minutes = Math.floor(data.timeRemaining / 60);
  const seconds = data.timeRemaining % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  
  console.log(`⏰ [${data.room}] Countdown: ${timeStr} (${data.timeRemaining}s)`);
  console.log(`   Period: ${data.periodId}`);
  console.log(`   Status: ${data.status}`);
});

socket.on('exposure-update', (data) => {
  console.log(`💰 [${data.room}] Live Exposure Update:`);
  console.log(`   Total: ₹${data.totalExposure}`);
  console.log(`   Optimal Number: ${data.optimalNumber}`);
  console.log(`   Period: ${data.periodId}`);
  
  // Show active bets
  const activeBets = Object.entries(data.exposures)
    .filter(([num, amount]) => parseFloat(amount) > 0)
    .map(([num, amount]) => `${num}: ₹${amount}`);
  
  if (activeBets.length > 0) {
    console.log(`   Active Bets: ${activeBets.join(', ')}`);
  } else {
    console.log(`   Active Bets: None`);
  }
});

socket.on('period-status', (data) => {
  console.log(`🔄 [${data.room}] Period Status Change:`);
  console.log(`   Status: ${data.status}`);
  console.log(`   Old Period: ${data.oldPeriodId || 'N/A'}`);
  console.log(`   New Period: ${data.newPeriodId || 'N/A'}`);
});

// Error events
socket.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});

socket.on('auth-error', (error) => {
  console.error('❌ Authentication error:', error);
});

// Keep connection alive
setInterval(() => {
  if (socket.connected) {
    console.log('💓 Heartbeat: Connection alive');
  }
}, 30000); // Every 30 seconds

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down WebSocket connection...');
  socket.disconnect();
  process.exit(0);
});

console.log('🎯 WebSocket test started. Press Ctrl+C to stop.');
console.log('📊 Watching for real-time countdown and exposure updates...'); 