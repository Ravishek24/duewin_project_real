const { validationResult } = require('express-validator');

const validateInput = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array().map(err => ({
                field: err.param,
                message: err.msg
            }))
        });
    }
    next();
};

// Common validation rules
const commonValidations = {
    email: {
        isEmail: true,
        normalizeEmail: true,
        errorMessage: 'Invalid email format'
    },
    password: {
        isLength: {
            options: { min: 8 },
            errorMessage: 'Password must be at least 8 characters long'
        },
        matches: {
            options: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
            errorMessage: 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
        }
    },
    username: {
        isLength: {
            options: { min: 3, max: 30 },
            errorMessage: 'Username must be between 3 and 30 characters'
        },
        matches: {
            options: /^[a-zA-Z0-9_-]+$/,
            errorMessage: 'Username can only contain letters, numbers, underscores and hyphens'
        }
    }
};

module.exports = {
    validateInput,
    commonValidations
}; 