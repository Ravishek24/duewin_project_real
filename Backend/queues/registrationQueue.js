const { Queue } = require('bullmq');
const queueConnections = require('../config/queueConfig');

const registrationQueue = new Queue('registration', { 
  connection: queueConnections.registration 
});

module.exports = registrationQueue; 