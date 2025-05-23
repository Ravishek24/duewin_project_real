#!/usr/bin/env node

// Backend/start-scheduler.js
require('dotenv').config();
const { startGameScheduler } = require('./scripts/gameScheduler');

// Start the game scheduler
console.log('Starting game scheduler as standalone process...');
startGameScheduler()
  .then((success) => {
    if (success) {
      console.log('✅ Game scheduler started successfully');
    } else {
      console.error('❌ Failed to start game scheduler');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('❌ Error starting game scheduler:', error);
    process.exit(1);
  });

// Keep the process alive
process.stdin.resume();

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  // Don't exit the process to keep the scheduler running
}); 