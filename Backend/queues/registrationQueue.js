const { Queue } = require('bullmq');
const getQueueConnections = require('../config/queueConfig');

// Lazy queue creation - only create when needed
let registrationQueue = null;

function getRegistrationQueue() {
  if (!registrationQueue) {
    const queueConnections = getQueueConnections();
    registrationQueue = new Queue('registration', { connection: queueConnections.registration });
  }
  return registrationQueue;
}

module.exports = { getRegistrationQueue }; 