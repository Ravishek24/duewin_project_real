#!/usr/bin/env node

// Backend/start-scheduler.js
require('dotenv').config();
const { startGameScheduler } = require('./gameScheduler');

console.log('Starting game scheduler as standalone process...');
startGameScheduler()
  .then(() => {
    console.log('✅ Game scheduler started successfully');
    
    // Additional monitoring - print status every 5 minutes
    setInterval(() => {
      console.log(`[${new Date().toISOString()}] Game scheduler running... current time: ${new Date().toTimeString()}`);
    }, 5 * 60 * 1000);
  })
  .catch((error) => {
    console.error('❌ Error starting game scheduler:', error);
    process.exit(1);
  });

// Handle process signals
process.on('SIGINT', () => {
  console.log('Received SIGINT. Game scheduler shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM. Game scheduler shutting down...');
  process.exit(0);
});

// Keep the process alive
console.log('Scheduler process will remain running. Use Ctrl+C to terminate.');
process.stdin.resume(); 