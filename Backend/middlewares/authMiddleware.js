import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();

export const auth = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication failed. No token provided.' 
            });
        }
        
        const token = authHeader.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication failed. No token provided.' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if user exists
        const user = await User.findByPk(decoded.id, {
            attributes: ['user_id', 'email', 'is_phone_verified']
        });
        
        if (!user) {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication failed. User not found.' 
            });
        }
        
        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication failed. Invalid token.' 
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false, 
                message: 'Authentication failed. Token expired.' 
            });
        }
        
        return res.status(500).json({ 
            success: false, 
            message: 'Server error during authentication.' 
        });
    }
};

// Middleware to check if phone is verified
export const requirePhoneVerification = (req, res, next) => {
    if (!req.user.is_phone_verified) {
        return res.status(403).json({
            success: false,
            message: 'Phone verification required. Please verify your phone number before accessing this resource.'
        });
    }
    next();
};

export default { auth, requirePhoneVerification };