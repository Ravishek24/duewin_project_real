// Backend/middleware/websocketAuth.js - Enhanced WebSocket Authentication

const jwt = require('jsonwebtoken');
const { AUTH: { JWT_SECRET } } = require('../config/constants');

/**
 * Enhanced WebSocket authentication middleware
 */
const authenticateWebSocket = async (socket, next) => {
    try {
        console.log('🔍 WebSocket Auth: Starting authentication process...');
        
        // Multiple ways to extract token
        let token = null;
        
        // Method 1: From auth object (most common for Socket.IO clients)
        if (socket.handshake.auth && socket.handshake.auth.token) {
            token = socket.handshake.auth.token;
            console.log('🔍 Token found in auth object');
        }
        
        // Method 2: From query parameters (fallback)
        if (!token && socket.handshake.query && socket.handshake.query.token) {
            token = socket.handshake.query.token;
            console.log('🔍 Token found in query parameters');
        }
        
        // Method 3: From headers (for some clients)
        if (!token && socket.handshake.headers && socket.handshake.headers.authorization) {
            const authHeader = socket.handshake.headers.authorization;
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
                console.log('🔍 Token found in authorization header');
            }
        }
        
        // Method 4: From custom header (some mobile apps use this)
        if (!token && socket.handshake.headers && socket.handshake.headers['x-auth-token']) {
            token = socket.handshake.headers['x-auth-token'];
            console.log('🔍 Token found in x-auth-token header');
        }
        
        if (!token) {
            console.log('❌ WebSocket Auth: No token provided in any expected location');
            console.log('🔍 Available auth methods:', {
                auth: !!socket.handshake.auth,
                query: !!socket.handshake.query,
                headers: Object.keys(socket.handshake.headers || {}),
                authKeys: socket.handshake.auth ? Object.keys(socket.handshake.auth) : [],
                queryKeys: socket.handshake.query ? Object.keys(socket.handshake.query) : []
            });
            return next(new Error('Authentication required - no token provided'));
        }

        // Clean up token (remove any extra whitespace or Bearer prefix)
        token = token.toString().trim();
        if (token.startsWith('Bearer ')) {
            token = token.substring(7).trim();
        }
        
        // Validate token format with detailed logging
        console.log('🔍 WebSocket Auth: Token validation details:');
        console.log('  - Token exists:', !!token);
        console.log('  - Token type:', typeof token);
        console.log('  - Token length:', token ? token.length : 0);
        console.log('  - Token value (first 100 chars):', token ? token.substring(0, 100) : 'null');
        console.log('  - Token value (full):', token);
        
        if (!token) {
            console.log('❌ WebSocket Auth: Token is null or undefined');
            return next(new Error('Token is required'));
        }
        
        if (typeof token !== 'string') {
            console.log('❌ WebSocket Auth: Token is not a string, type:', typeof token);
            // Try to convert to string
            try {
                token = String(token);
                console.log('🔧 WebSocket Auth: Converted token to string, new length:', token.length);
            } catch (conversionError) {
                console.log('❌ WebSocket Auth: Cannot convert token to string:', conversionError.message);
                return next(new Error('Invalid token type'));
            }
        }
        
        // Check for common invalid token values
        if (token === 'null' || token === 'undefined' || token === 'false' || token === '') {
            console.log('❌ WebSocket Auth: Token is invalid string value:', token);
            console.log('🔍 Frontend is sending string "null" instead of actual token');
            console.log('🔧 Frontend should send: socket.auth = { token: actualJwtToken }');
            console.log('🔧 Not: socket.auth = { token: "null" }');
            return next(new Error('Invalid token - frontend sending "null" string'));
        }

        if (token.length < 10) {
            console.log('❌ WebSocket Auth: Token too short, length:', token.length);
            console.log('❌ WebSocket Auth: Token content:', JSON.stringify(token));
            console.log('🔧 Valid JWT tokens are typically 100+ characters long');
            return next(new Error('Token too short - minimum 10 characters required'));
        }
        
        // Check if token looks like a JWT (has 3 parts separated by dots)
        const tokenParts = token.split('.');
        if (tokenParts.length !== 3) {
            console.log('❌ WebSocket Auth: Token does not have JWT format (3 parts)');
            console.log('🔍 Token parts count:', tokenParts.length);
            return next(new Error('Invalid JWT format'));
        }

        console.log('🔍 WebSocket Auth: Token format validated, attempting to verify...');
        console.log('🔍 Token length:', token.length);
        console.log('🔍 Token prefix:', token.substring(0, 20) + '...');

        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (jwtError) {
            console.error('❌ JWT Verification Error:', jwtError.message);
            console.error('🔍 JWT Error name:', jwtError.name);
            
            if (jwtError.name === 'JsonWebTokenError') {
                console.log('🔍 Malformed JWT - checking token structure...');
                console.log('🔍 First 50 chars:', token.substring(0, 50));
                return next(new Error('Malformed JWT token'));
            } else if (jwtError.name === 'TokenExpiredError') {
                console.log('🔍 JWT expired at:', jwtError.expiredAt);
                return next(new Error('Token expired'));
            } else if (jwtError.name === 'NotBeforeError') {
                return next(new Error('Token not active yet'));
            } else {
                return next(new Error('Token verification failed'));
            }
        }
        
        // Validate decoded token structure
        if (!decoded) {
            console.log('❌ WebSocket Auth: Token decoded to null/undefined');
            return next(new Error('Invalid token payload'));
        }
        
        // Check for user ID in various possible fields
        const userId = decoded.userId || decoded.id || decoded.user_id || decoded.sub;
        if (!userId) {
            console.log('❌ WebSocket Auth: No user ID found in token');
            console.log('🔍 Token payload keys:', Object.keys(decoded));
            return next(new Error('Invalid token - no user ID'));
        }
        
        // Check token expiration manually (additional safety)
        if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
            console.log('❌ WebSocket Auth: Token expired');
            console.log('🔍 Token exp:', new Date(decoded.exp * 1000));
            console.log('🔍 Current time:', new Date());
            return next(new Error('Token expired'));
        }

        // Set user data on socket with normalized structure
        socket.user = {
            id: userId,
            userId: userId,
            email: decoded.email,
            phone: decoded.phone,
            role: decoded.role,
            ...decoded
        };
        
        console.log('✅ WebSocket Auth: User authenticated successfully');
        console.log('🔍 User ID:', userId);
        console.log('🔍 User email:', decoded.email || 'not provided');
        
        next();
        
    } catch (error) {
        console.error('❌ WebSocket Auth: Unexpected error during authentication:', error);
        console.error('🔍 Error stack:', error.stack);
        next(new Error('Authentication failed - internal error'));
    }
};

/**
 * Create token for testing purposes
 */
const createTestToken = (userId, email = 'test@example.com') => {
    try {
        const payload = {
            userId: userId,
            id: userId,
            email: email,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
        };
        
        const token = jwt.sign(payload, JWT_SECRET);
        console.log('🔧 Test token created for user:', userId);
        return token;
    } catch (error) {
        console.error('❌ Error creating test token:', error);
        return null;
    }
};

/**
 * Validate token without throwing errors (for debugging)
 */
const validateTokenDebug = (token) => {
    try {
        if (!token) {
            return { valid: false, error: 'No token provided' };
        }
        
        // Clean token
        token = token.toString().trim().replace('Bearer ', '');
        
        // Check format
        const parts = token.split('.');
        if (parts.length !== 3) {
            return { valid: false, error: 'Invalid JWT format', parts: parts.length };
        }
        
        // Decode without verification (for debugging)
        const decoded = jwt.decode(token);
        if (!decoded) {
            return { valid: false, error: 'Cannot decode token' };
        }
        
        // Verify with secret
        const verified = jwt.verify(token, JWT_SECRET);
        
        return {
            valid: true,
            decoded: verified,
            userId: verified.userId || verified.id,
            exp: verified.exp ? new Date(verified.exp * 1000) : null,
            iat: verified.iat ? new Date(verified.iat * 1000) : null
        };
        
    } catch (error) {
        return {
            valid: false,
            error: error.message,
            errorType: error.name
        };
    }
};

module.exports = {
    authenticateWebSocket,
    createTestToken,
    validateTokenDebug
};