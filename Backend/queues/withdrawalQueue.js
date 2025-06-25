const { Queue } = require('bullmq');
const queueConnections = require('../config/queueConfig');

const withdrawalQueue = new Queue('withdrawals', { 
  connection: queueConnections.withdrawals 
});

module.exports = withdrawalQueue; 