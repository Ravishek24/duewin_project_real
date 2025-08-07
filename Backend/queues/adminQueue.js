const { Queue } = require('bullmq');
const getQueueConnections = require('../config/queueConfig');

// Lazy queue creation - only create when needed
let adminQueue = null;

function getAdminQueue() {
  if (!adminQueue) {
    const queueConnections = getQueueConnections();
    adminQueue = new Queue('admin', { connection: queueConnections.admin });
  }
  return adminQueue;
}

module.exports = { getAdminQueue }; 