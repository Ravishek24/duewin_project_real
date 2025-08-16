const { Queue } = require('bullmq');
const unifiedRedis = require('../config/unifiedRedisManager');

// Lazy queue creation - only create when needed
let registrationQueue = null;

async function getRegistrationQueue() {
  try {
    console.log(`🔍 [QUEUE DEBUG] getRegistrationQueue called`);
    console.log(`🔍 [QUEUE DEBUG] BullMQ Queue class:`, typeof Queue);
    console.log(`🔍 [QUEUE DEBUG] unifiedRedis object:`, typeof unifiedRedis);
    
    if (!registrationQueue) {
      console.log(`🔍 [QUEUE DEBUG] Creating new registration queue...`);
      
      // Check if unifiedRedis is properly initialized
      if (!unifiedRedis) {
        throw new Error('unifiedRedis not available');
      }
      
      let connection;
      
      // Try async method first (preferred)
      if (typeof unifiedRedis.getConnection === 'function') {
        try {
          console.log(`🔍 [QUEUE DEBUG] Trying async getConnection...`);
          connection = await unifiedRedis.getConnection('main');
          console.log(`🔍 [QUEUE DEBUG] Async connection obtained:`, {
            type: typeof connection,
            isRedisClient: connection && typeof connection === 'object',
            hasStatus: connection && typeof connection.status === 'string',
            status: connection?.status
          });
        } catch (asyncError) {
          console.log(`⚠️ [QUEUE DEBUG] Async connection failed, trying sync:`, asyncError.message);
        }
      }
      
      // Fallback to sync method if async failed or not available
      if (!connection && typeof unifiedRedis.getConnectionSync === 'function') {
        console.log(`🔍 [QUEUE DEBUG] Trying sync getConnectionSync...`);
        connection = unifiedRedis.getConnectionSync('main');
        console.log(`🔍 [QUEUE DEBUG] Sync connection obtained:`, {
          type: typeof connection,
          isRedisClient: connection && typeof connection === 'object',
          hasStatus: connection && typeof connection.status === 'string',
          status: connection?.status
        });
      }
      
      if (!connection) {
        throw new Error('Failed to obtain Redis connection from both async and sync methods');
      }
      
      // The connection object is the actual Redis client, not a wrapper
      // We can pass it directly to BullMQ Queue constructor
      registrationQueue = new Queue('registration', { connection });
      console.log(`✅ [QUEUE DEBUG] Registration queue created successfully:`, {
        type: typeof registrationQueue,
        hasAdd: typeof registrationQueue?.add === 'function',
        queueName: registrationQueue?.name,
        constructor: registrationQueue?.constructor?.name
      });
    } else {
      console.log(`🔍 [QUEUE DEBUG] Returning existing registration queue:`, {
        type: typeof registrationQueue,
        hasAdd: typeof registrationQueue?.add === 'function',
        queueName: registrationQueue?.name
      });
    }
    
    return registrationQueue;
  } catch (error) {
    console.error(`❌ [QUEUE DEBUG] Error in getRegistrationQueue:`, error);
    console.error(`❌ [QUEUE DEBUG] Error stack:`, error.stack);
    throw error;
  }
}

module.exports = { getRegistrationQueue }; 