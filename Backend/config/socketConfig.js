const logger = require('../utils/logger');

// Initialize io as null - it will be set by the main server
let io = null;

// Function to set io instance from main server
const setIo = (ioInstance) => {
    io = ioInstance;
    logger.info('WebSocket io instance set');
};

// Function to get io instance
const getIo = () => {
    return io;
};

module.exports = {
    io,
    setIo,
    getIo
}; 