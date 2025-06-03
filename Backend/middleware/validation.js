const { logger } = require('../utils/logger');

/**
 * Middleware to validate request data against a Joi schema
 * @param {Object} schema - Joi validation schema
 * @param {string} property - Property to validate ('body', 'query', or 'params')
 * @returns {Function} Express middleware
 */
const validateRequest = (schema, property = 'body') => {
    return (req, res, next) => {
        try {
            const { error, value } = schema.validate(req[property], {
                abortEarly: false,
                stripUnknown: true
            });

            if (error) {
                const errorMessage = error.details.map(detail => detail.message).join(', ');
                logger.warn('Validation error:', {
                    path: req.path,
                    method: req.method,
                    errors: errorMessage
                });

                return res.status(400).json({
                    success: false,
                    message: 'Validation error',
                    errors: errorMessage
                });
            }

            // Replace request data with validated data
            req[property] = value;
            next();
        } catch (err) {
            logger.error('Validation middleware error:', err);
            res.status(500).json({
                success: false,
                message: 'Internal server error during validation'
            });
        }
    };
};

module.exports = {
    validateRequest
}; 