const { Queue } = require('bullmq');
const queueConnections = require('../config/queueConfig');

const paymentQueue = new Queue('payments', { 
  connection: queueConnections.payments 
});

module.exports = paymentQueue; 