// scripts/cleanupSessions.js
import { cleanupExpiredSessions } from '../services/seamlessWalletService.js';

/**
 * Cleanup script for expired sessions
 * This can be run as a cron job
 */
const runCleanup = async () => {
  console.log('Starting expired session cleanup...');
  
  try {
    const result = await cleanupExpiredSessions();
    console.log(result.message);
  } catch (error) {
    console.error('Cleanup error:', error);
  }
  
  console.log('Cleanup complete');
};

// Run the cleanup
runCleanup();