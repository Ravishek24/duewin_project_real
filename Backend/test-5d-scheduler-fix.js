#!/usr/bin/env node

/**
 * Test script to verify 5D Pre-Calculation Scheduler Redis initialization fix
 */

const { start5DPreCalcScheduler } = require('./scripts/5dPreCalcScheduler');

console.log('🧪 Testing 5D Pre-Calculation Scheduler Redis initialization...');

async function testScheduler() {
    try {
        console.log('🚀 Starting 5D Pre-Calculation Scheduler...');
        
        // Start the scheduler
        await start5DPreCalcScheduler();
        
        console.log('✅ Test completed successfully!');
        console.log('📝 The scheduler should now be running with proper Redis initialization.');
        
        // Keep the process running for a few seconds to see logs
        console.log('⏳ Keeping process alive for 10 seconds to see initialization logs...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        console.log('✅ Test finished. Check PM2 logs for detailed information.');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the test
testScheduler(); 