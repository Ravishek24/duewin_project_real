#!/usr/bin/env node

/**
 * Test Queue Worker Mismatch
 * This script tests if there's a connection mismatch between queue and worker
 */

const unifiedRedis = require('./config/unifiedRedisManager');
const { Queue, Worker } = require('bullmq');

async function testQueueWorkerMismatch() {
  try {
    console.log('🔍 Testing queue and worker connection mismatch...');
    
    await unifiedRedis.initialize();
    
    // Create a test queue
    console.log('\n📋 Creating test queue...');
    const testQueue = new Queue('test-queue', { 
      connection: await unifiedRedis.getConnection('main') 
    });
    
    // Add a test job
    console.log('📝 Adding test job...');
    const testJob = await testQueue.add('test-job', {
      type: 'test',
      data: { userId: 999 }
    });
    
    console.log(`✅ Test job added with ID: ${testJob.id}`);
    
    // Create a test worker
    console.log('\n👷 Creating test worker...');
    const testWorker = new Worker('test-queue', async (job) => {
      console.log(`🔍 [TEST WORKER] Processing job:`, {
        jobId: job.id,
        jobName: job.name,
        jobData: job.data,
        jobDataType: typeof job.data
      });
      
      if (job.data && job.data.type && job.data.data && job.data.data.userId) {
        console.log(`✅ [TEST WORKER] Found nested structure: userId=${job.data.data.userId}`);
        return { success: true, userId: job.data.data.userId };
      } else if (job.data && job.data.type && job.data.userId) {
        console.log(`✅ [TEST WORKER] Found flat structure: userId=${job.data.userId}`);
        return { success: true, userId: job.data.userId };
      } else if (job.data && job.data.userId) {
        console.log(`✅ [TEST WORKER] Found direct structure: userId=${job.data.userId}`);
        return { success: true, userId: job.data.userId };
      } else {
        console.log(`❌ [TEST WORKER] No userId found in job data`);
        throw new Error('No userId found in job data');
      }
    }, {
      connection: await unifiedRedis.getConnection('main')
    });
    
    // Wait for job to be processed
    console.log('\n⏳ Waiting for job to be processed...');
    await new Promise((resolve) => {
      testWorker.on('completed', (job) => {
        console.log(`✅ [TEST WORKER] Job completed:`, job.id);
        resolve();
      });
      
      testWorker.on('failed', (job, err) => {
        console.error(`❌ [TEST WORKER] Job failed:`, job.id, err.message);
        resolve();
      });
      
      // Timeout after 10 seconds
      setTimeout(() => {
        console.log('⏰ Timeout waiting for job processing');
        resolve();
      }, 10000);
    });
    
    // Clean up
    await testQueue.close();
    await testWorker.close();
    
    console.log('\n✅ Test completed');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run test if called directly
if (require.main === module) {
  testQueueWorkerMismatch()
    .then(() => {
      console.log('✅ Test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Test failed:', error.message);
      process.exit(1);
    });
}

module.exports = { testQueueWorkerMismatch };
