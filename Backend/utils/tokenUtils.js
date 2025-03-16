import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Generate a random token for email verification or password reset
export const generateToken = (length = 32) => {
    return crypto.randomBytes(length).toString('hex');
};

// Generate JWT token for authentication
export const generateJWT = (userId, email) => {
    return jwt.sign(
        { id: userId, email: email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );
};

// Verify JWT token
export const verifyJWT = (token) => {
    try {
        return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
        throw new Error('Invalid or expired token');
    }
};

export default {
    generateToken,
    generateJWT,
    verifyJWT
};