const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');
const UserSession = require('../models/UserSession');
const User = require('../models/User');
const { Op } = require('sequelize');

const generateTokens = async (user, ipAddress) => {
    // Check if user has an active session from a different IP
    const existingSession = await UserSession.findOne({
        where: {
            userId: user.id,
            isValid: true,
            expiresAt: {
                [Op.gt]: new Date()
            }
        }
    });

    if (existingSession && existingSession.ipAddress !== ipAddress) {
        throw new Error('User is already logged in from another device');
    }

    // Invalidate any existing sessions for this user
    await UserSession.update(
        { isValid: false },
        { 
            where: { 
                userId: user.id,
                isValid: true
            }
        }
    );

    // Generate access token (short-lived)
    const accessToken = jwt.sign(
        { 
            id: user.id, 
            email: user.email,
            ipAddress // Include IP in token
        },
        process.env.JWT_SECRET,
        { expiresIn: '12h' } // 12 hour expiry
    );

    // Generate refresh token (long-lived)
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

    // Save refresh token to database
    await RefreshToken.create({
        token: refreshToken,
        userId: user.id,
        expiresAt
    });

    // Create new user session
    const sessionExpiresAt = new Date();
    sessionExpiresAt.setHours(sessionExpiresAt.getHours() + 12); // 12 hour session

    await UserSession.create({
        userId: user.id,
        ipAddress,
        expiresAt: sessionExpiresAt
    });

    return {
        accessToken,
        refreshToken
    };
};

const verifyAccessToken = (token, ipAddress) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Verify IP address matches
        if (decoded.ipAddress !== ipAddress) {
            throw new Error('Invalid session: IP address mismatch');
        }

        return decoded;
    } catch (error) {
        throw new Error('Invalid access token');
    }
};

const refreshAccessToken = async (refreshToken, ipAddress) => {
    const tokenRecord = await RefreshToken.findOne({
        where: {
            token: refreshToken,
            isValid: true,
            expiresAt: {
                [Op.gt]: new Date()
            }
        }
    });

    if (!tokenRecord) {
        throw new Error('Invalid refresh token');
    }

    const user = await User.findByPk(tokenRecord.userId);
    if (!user) {
        throw new Error('User not found');
    }

    // Check if user has an active session from a different IP
    const existingSession = await UserSession.findOne({
        where: {
            userId: user.id,
            isValid: true,
            expiresAt: {
                [Op.gt]: new Date()
            }
        }
    });

    if (existingSession && existingSession.ipAddress !== ipAddress) {
        throw new Error('User is already logged in from another device');
    }

    // Generate new access token
    const accessToken = jwt.sign(
        { 
            id: user.id, 
            email: user.email,
            ipAddress
        },
        process.env.JWT_SECRET,
        { expiresIn: '12h' }
    );

    // Update session expiry
    const sessionExpiresAt = new Date();
    sessionExpiresAt.setHours(sessionExpiresAt.getHours() + 12);

    await UserSession.update(
        { 
            expiresAt: sessionExpiresAt,
            lastActive: new Date()
        },
        { 
            where: { 
                userId: user.id,
                ipAddress,
                isValid: true
            }
        }
    );

    return { accessToken };
};

const invalidateRefreshToken = async (refreshToken) => {
    await RefreshToken.update(
        { isValid: false },
        { where: { token: refreshToken } }
    );
};

const invalidateUserSession = async (userId) => {
    await UserSession.update(
        { isValid: false },
        { where: { userId } }
    );
};

module.exports = {
    generateTokens,
    verifyAccessToken,
    refreshAccessToken,
    invalidateRefreshToken,
    invalidateUserSession
}; 
