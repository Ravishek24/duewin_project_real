const express = require('express');
const router = express.Router();
const adminExposureService = require('../services/adminExposureService');
const rateLimit = require('express-rate-limit');

/**
 * Admin IP Whitelist Middleware
 */
const adminIpWhitelist = (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (!adminExposureService.verifyAdminIP(clientIP)) {
        return res.status(403).json({
            success: false,
            error: 'Access denied',
            message: 'Your IP is not whitelisted for admin access'
        });
    }
    
    next();
};

/**
 * Admin Token Verification Middleware
 */
const verifyAdminToken = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'No token provided',
            message: 'Admin token required'
        });
    }
    
    const tokenResult = adminExposureService.verifyAdminToken(token);
    if (!tokenResult.valid) {
        return res.status(401).json({
            success: false,
            error: 'Invalid token',
            message: 'Admin authentication failed'
        });
    }
    
    req.admin = tokenResult.admin;
    next();
};

/**
 * Rate Limiting for Admin Endpoints
 */
const adminRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: {
        success: false,
        error: 'Too many requests',
        message: 'Rate limit exceeded for admin access'
    },
    skipSuccessfulRequests: false,
    keyGenerator: (req) => req.ip
});

/**
 * Admin Access Logging Middleware
 */
const adminAccessLogger = (req, res, next) => {
    const logData = {
        timestamp: new Date().toISOString(),
        adminId: req.admin?.id,
        username: req.admin?.username,
        ip: req.ip,
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent')
    };
    
    console.log('🔐 [ADMIN_ACCESS]', logData);
    adminExposureService.logAdminAccess(req.admin, `${req.method} ${req.path}`, logData);
    
    next();
};

// Apply middleware to all admin routes
// router.use(adminIpWhitelist); // Temporarily disabled for testing
router.use(verifyAdminToken);
router.use(adminRateLimiter);
router.use(adminAccessLogger);

/**
 * GET /admin/exposure/wingo/current
 * Get current exposure for all Wingo rooms
 */
router.get('/wingo/current', async (req, res) => {
    try {
        const allRoomsData = await adminExposureService.getAllWingoRoomsExposure();
        
        if (allRoomsData.success) {
            res.json({
                success: true,
                message: 'Wingo exposure data retrieved successfully',
                data: allRoomsData
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve exposure data',
                message: allRoomsData.error
            });
        }
        
    } catch (error) {
        console.error('❌ [ADMIN_ROUTES] Error getting Wingo exposure:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /admin/exposure/wingo/:duration/current
 * Get current exposure for specific Wingo duration
 */
router.get('/wingo/:duration/current', async (req, res) => {
    try {
        const duration = parseInt(req.params.duration);
        
        if (!adminExposureService.wingoDurations.includes(duration)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid duration',
                message: 'Valid durations are: 30, 60, 180, 300'
            });
        }
        
        const exposureData = await adminExposureService.getWingoExposure(duration);
        
        if (exposureData.success) {
            res.json({
                success: true,
                message: `Wingo ${duration}s exposure data retrieved successfully`,
                data: exposureData
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve exposure data',
                message: exposureData.error
            });
        }
        
    } catch (error) {
        console.error('❌ [ADMIN_ROUTES] Error getting Wingo exposure:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /admin/exposure/wingo/:duration/:periodId
 * Get exposure for specific period
 */
router.get('/wingo/:duration/:periodId', async (req, res) => {
    try {
        const duration = parseInt(req.params.duration);
        const periodId = req.params.periodId;
        
        if (!adminExposureService.wingoDurations.includes(duration)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid duration',
                message: 'Valid durations are: 30, 60, 180, 300'
            });
        }
        
        const exposureData = await adminExposureService.getWingoExposure(duration, periodId);
        
        if (exposureData.success) {
            res.json({
                success: true,
                message: `Wingo ${duration}s period ${periodId} exposure data retrieved successfully`,
                data: exposureData
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve exposure data',
                message: exposureData.error
            });
        }
        
    } catch (error) {
        console.error('❌ [ADMIN_ROUTES] Error getting Wingo exposure:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /admin/exposure/wingo/rooms/status
 * Get status of all Wingo rooms
 */
router.get('/wingo/rooms/status', async (req, res) => {
    try {
        const allRoomsData = await adminExposureService.getAllWingoRoomsExposure();
        
        if (allRoomsData.success) {
            const roomStatus = {};
            let totalUsers = 0;
            let totalBets = 0;
            let totalExposure = 0;
            
            for (const [roomName, roomData] of Object.entries(allRoomsData.rooms)) {
                const duration = roomData.duration;
                const periodInfo = roomData.periodInfo;
                const analysis = roomData.analysis;
                const betDistribution = roomData.analysis.betDistribution;
                
                roomStatus[roomName] = {
                    duration: duration,
                    periodId: roomData.periodId,
                    timeRemaining: periodInfo?.timeRemaining || 0,
                    totalExposure: parseFloat(analysis.totalExposure),
                    optimalNumber: analysis.optimalNumber,
                    zeroExposureNumbers: analysis.zeroExposureNumbers,
                    users: betDistribution.uniqueUsers,
                    bets: betDistribution.totalBets,
                    betTypes: betDistribution.betTypes,
                    status: periodInfo?.timeRemaining > 0 ? 'active' : 'ended'
                };
                
                totalUsers += betDistribution.uniqueUsers;
                totalBets += betDistribution.totalBets;
                totalExposure += parseFloat(analysis.totalExposure);
            }
            
            res.json({
                success: true,
                message: 'Wingo rooms status retrieved successfully',
                data: {
                    rooms: roomStatus,
                    summary: {
                        totalRooms: Object.keys(roomStatus).length,
                        totalUsers: totalUsers,
                        totalBets: totalBets,
                        totalExposure: totalExposure.toFixed(2),
                        timestamp: new Date().toISOString()
                    }
                }
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve rooms status',
                message: allRoomsData.error
            });
        }
        
    } catch (error) {
        console.error('❌ [ADMIN_ROUTES] Error getting rooms status:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /admin/exposure/wingo/active-admins
 * Get list of active admin connections
 */
router.get('/wingo/active-admins', (req, res) => {
    try {
        const activeAdmins = adminExposureService.getActiveAdmins();
        
        res.json({
            success: true,
            message: 'Active admins retrieved successfully',
            data: {
                activeAdmins: activeAdmins,
                count: activeAdmins.length,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ [ADMIN_ROUTES] Error getting active admins:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
});

/**
 * GET /admin/exposure/wingo/health
 * Health check for admin exposure service
 */
router.get('/wingo/health', async (req, res) => {
    try {
        // Test Redis connection
        const redisPing = await require('../config/redis').ping();
        
        // Test exposure data retrieval
        const testExposure = await adminExposureService.getWingoExposure(30);
        
        res.json({
            success: true,
            message: 'Admin exposure service health check passed',
            data: {
                redis: redisPing === 'PONG' ? 'connected' : 'disconnected',
                exposureService: testExposure.success ? 'working' : 'error',
                activeAdmins: adminExposureService.getActiveAdmins().length,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ [ADMIN_ROUTES] Health check error:', error);
        res.status(500).json({
            success: false,
            error: 'Health check failed',
            message: error.message
        });
    }
});

module.exports = router; 