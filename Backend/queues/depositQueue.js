const { Queue } = require('bullmq');
const queueConnections = require('../config/queueConfig');

const depositQueue = new Queue('deposits', { 
  connection: queueConnections.deposits 
});

module.exports = depositQueue; 