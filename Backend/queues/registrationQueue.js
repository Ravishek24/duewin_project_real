const { Queue } = require('bullmq');

const connection = {
  host: '127.0.0.1',
  port: 6379,
  db: 0
};

const registrationQueue = new Queue('registration', { connection });

module.exports = registrationQueue; 