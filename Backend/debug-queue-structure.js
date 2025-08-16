#!/usr/bin/env node

/**
 * Debug Queue Structure
 * This script inspects the actual job data structure in the queues
 */

const unifiedRedis = require('./config/unifiedRedisManager');
const { Queue } = require('bullmq');

async function debugQueueStructure() {
  try {
    console.log('🔍 Debugging queue structure...');
    
    await unifiedRedis.initialize();
    
    // Check registration queue
    const registrationQueue = new Queue('registration', { 
      connection: await unifiedRedis.getConnection('main') 
    });
    
    console.log('\n📋 Registration Queue Jobs:');
    console.log('============================');
    
    // Get all job types
    const jobTypes = ['waiting', 'active', 'delayed', 'failed'];
    
    for (const jobType of jobTypes) {
      try {
        const jobs = await registrationQueue.getJobs([jobType], 0, 10);
        
        if (jobs.length > 0) {
          console.log(`\n${jobType.toUpperCase()} Jobs (${jobs.length}):`);
          
          for (const job of jobs) {
            console.log(`\n  Job ID: ${job.id}`);
            console.log(`  Job Name: ${job.name}`);
            console.log(`  Job Data:`, JSON.stringify(job.data, null, 2));
            
            // Analyze the structure
            if (job.data) {
              console.log(`  Structure Analysis:`);
              console.log(`    - Has type: ${'type' in job.data}`);
              console.log(`    - Has data: ${'data' in job.data}`);
              console.log(`    - Has userId: ${'userId' in job.data}`);
              console.log(`    - Type value: ${job.data.type}`);
              console.log(`    - Data value:`, job.data.data);
              console.log(`    - UserId value: ${job.data.userId}`);
              
              if (job.data.data && typeof job.data.data === 'object') {
                console.log(`    - Data.userId: ${job.data.data.userId}`);
              }
            }
          }
        } else {
          console.log(`\n${jobType.toUpperCase()}: No jobs`);
        }
      } catch (error) {
        console.error(`Error getting ${jobType} jobs:`, error.message);
      }
    }
    
    await registrationQueue.close();
    
    console.log('\n✅ Queue structure debugging completed');
    
  } catch (error) {
    console.error('❌ Queue debugging failed:', error.message);
    process.exit(1);
  }
}

// Run debugging if called directly
if (require.main === module) {
  debugQueueStructure()
    .then(() => {
      console.log('✅ Debugging completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Debugging failed:', error.message);
      process.exit(1);
    });
}

module.exports = { debugQueueStructure };
