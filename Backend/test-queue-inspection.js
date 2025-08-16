#!/usr/bin/env node

/**
 * Test Queue Inspection
 * This script inspects the actual job data structure in the registration queue
 */

const unifiedRedis = require('./config/unifiedRedisManager');
const { Queue } = require('bullmq');

async function inspectQueue() {
  try {
    console.log('🔍 Inspecting registration queue...');
    
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
        const jobs = await registrationQueue.getJobs([jobType], 0, 20);
        
        if (jobs.length > 0) {
          console.log(`\n${jobType.toUpperCase()} Jobs (${jobs.length}):`);
          
          for (const job of jobs) {
            console.log(`\n  Job ID: ${job.id}`);
            console.log(`  Job Name: ${job.name}`);
            console.log(`  Job Data:`, JSON.stringify(job.data, null, 2));
            console.log(`  Job Timestamp: ${job.timestamp}`);
            console.log(`  Job Processed: ${job.processedOn}`);
            
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
    
    console.log('\n✅ Queue inspection completed');
    
  } catch (error) {
    console.error('❌ Queue inspection failed:', error.message);
    process.exit(1);
  }
}

// Run inspection if called directly
if (require.main === module) {
  inspectQueue()
    .then(() => {
      console.log('✅ Inspection completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Inspection failed:', error.message);
      process.exit(1);
    });
}

module.exports = { inspectQueue };
