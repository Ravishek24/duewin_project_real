const { Queue } = require('bullmq');
const queueConnections = require('../config/queueConfig');

const adminQueue = new Queue('admin', { 
  connection: queueConnections.admin 
});

module.exports = adminQueue; 