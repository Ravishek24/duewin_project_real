const { Queue } = require('bullmq');
const getQueueConnections = require('../config/queueConfig');
const queueConnections = getQueueConnections();

const registrationQueue = new Queue('registration', { connection: queueConnections.registration });

module.exports = registrationQueue; 