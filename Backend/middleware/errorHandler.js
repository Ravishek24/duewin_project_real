// middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Default error status and message
    let status = err.status || 500;
    let message = err.message || 'Internal Server Error';

    // Handle specific error types
    if (err.name === 'SequelizeValidationError') {
        status = 400;
        message = err.errors.map(e => e.message).join(', ');
    } else if (err.name === 'SequelizeUniqueConstraintError') {
        status = 409;
        message = 'Record already exists';
    } else if (err.name === 'JsonWebTokenError') {
        status = 401;
        message = 'Invalid token';
    } else if (err.name === 'TokenExpiredError') {
        status = 401;
        message = 'Token expired';
    }

    // Send error response
    res.status(status).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? err : undefined
    });
};

module.exports = errorHandler; 