// config/queueConfig.js - Separate Redis databases to prevent deadlocks
const queueConnections = {
  attendance: {
    host: '127.0.0.1',
    port: 6379,
    db: 1,  // Dedicated database for attendance
    retryDelayOnFailover: 100,
    lazyConnect: true,
    family: 4
  },
  
  registration: {
    host: '127.0.0.1', 
    port: 6379,
    db: 2,  // Dedicated database for registration
    retryDelayOnFailover: 100,
    lazyConnect: true,
    family: 4
  },
  
  notifications: {
    host: '127.0.0.1',
    port: 6379, 
    db: 3,  // Dedicated database for notifications
    retryDelayOnFailover: 100,
    lazyConnect: true,
    family: 4
  },
  
  deadLetter: {
    host: '127.0.0.1',
    port: 6379,
    db: 4,  // Dead letter queue
    retryDelayOnFailover: 100,
    lazyConnect: true,
    family: 4
  }
};

module.exports = queueConnections; 