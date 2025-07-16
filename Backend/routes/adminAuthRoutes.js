const express = require('express');
const router = express.Router();
const adminAuthService = require('../services/adminAuthService');
const adminExposureService = require('../services/adminExposureService');
const rateLimit = require('express-rate-limit');

/**
 * Rate Limiting for Admin Auth Endpoints
 */
const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 login attempts per windowMs
    message: {
        success: false,
        error: 'Too many login attempts',
        message: 'Rate limit exceeded for admin login'
    },
    skipSuccessfulRequests: false,
    keyGenerator: (req) => req.ip
});

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
 * POST /admin/auth/login
 * Admin login endpoint
 */
router.post('/login', adminIpWhitelist, authRateLimiter, async (req, res) => {
    try {
        const { username, password, otp } = req.body;
        
        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Missing credentials',
                message: 'Username and password are required'
            });
        }

        const loginResult = await adminAuthService.adminLogin(username, password, otp);
        
        if (loginResult.success) {
            // Log successful login
            adminAuthService.logAdminActivity(loginResult.data.admin, 'admin_login', {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.json({
                success: true,
                message: 'Admin login successful',
                data: {
                    token: loginResult.data.token,
                    admin: loginResult.data.admin,
                    expiresIn: loginResult.data.expiresIn
                }
            });
        } else {
            res.status(401).json({
                success: false,
                error: loginResult.error,
                message: loginResult.message
            });
        }
        
    } catch (error) {
        console.error('❌ [ADMIN_AUTH_ROUTES] Login error:', error);
        res.status(500).json({
            success: false,
            error: 'Login failed',
            message: 'Internal server error'
        });
    }
});

/**
 * POST /admin/auth/logout
 * Admin logout endpoint
 */
router.post('/logout', adminIpWhitelist, adminAuthService.createAdminMiddleware(), async (req, res) => {
    try {
        // Log logout activity
        adminAuthService.logAdminActivity(req.admin, 'admin_logout', {
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.json({
            success: true,
            message: 'Admin logout successful'
        });
        
    } catch (error) {
        console.error('❌ [ADMIN_AUTH_ROUTES] Logout error:', error);
        res.status(500).json({
            success: false,
            error: 'Logout failed',
            message: 'Internal server error'
        });
    }
});

/**
 * POST /admin/auth/refresh
 * Refresh admin token
 */
router.post('/refresh', adminIpWhitelist, adminAuthService.createAdminMiddleware(), async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        const refreshResult = await adminAuthService.refreshAdminToken(token);
        
        if (refreshResult.success) {
            // Log token refresh
            adminAuthService.logAdminActivity(req.admin, 'token_refresh', {
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });

            res.json({
                success: true,
                message: 'Token refreshed successfully',
                data: {
                    token: refreshResult.data.token,
                    admin: refreshResult.data.admin,
                    expiresIn: refreshResult.data.expiresIn
                }
            });
        } else {
            res.status(401).json({
                success: false,
                error: refreshResult.error,
                message: refreshResult.message
            });
        }
        
    } catch (error) {
        console.error('❌ [ADMIN_AUTH_ROUTES] Token refresh error:', error);
        res.status(500).json({
            success: false,
            error: 'Token refresh failed',
            message: 'Internal server error'
        });
    }
});

/**
 * GET /admin/auth/verify
 * Verify admin token
 */
router.get('/verify', adminIpWhitelist, adminAuthService.createAdminMiddleware(), async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Token is valid',
            data: {
                admin: req.admin,
                permissions: adminAuthService.getAdminPermissions(req.admin),
                hasExposureMonitor: adminAuthService.hasExposureMonitorPermission(req.admin),
                hasGameControl: adminAuthService.hasGameControlPermission(req.admin),
                hasUserManagement: adminAuthService.hasUserManagementPermission(req.admin)
            }
        });
        
    } catch (error) {
        console.error('❌ [ADMIN_AUTH_ROUTES] Token verification error:', error);
        res.status(500).json({
            success: false,
            error: 'Token verification failed',
            message: 'Internal server error'
        });
    }
});

/**
 * GET /admin/auth/permissions
 * Get admin permissions
 */
router.get('/permissions', adminIpWhitelist, adminAuthService.createAdminMiddleware(), async (req, res) => {
    try {
        const permissions = adminAuthService.getAdminPermissions(req.admin);
        
        res.json({
            success: true,
            message: 'Admin permissions retrieved successfully',
            data: {
                permissions: permissions,
                hasExposureMonitor: adminAuthService.hasExposureMonitorPermission(req.admin),
                hasGameControl: adminAuthService.hasGameControlPermission(req.admin),
                hasUserManagement: adminAuthService.hasUserManagementPermission(req.admin)
            }
        });
        
    } catch (error) {
        console.error('❌ [ADMIN_AUTH_ROUTES] Permissions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get permissions',
            message: 'Internal server error'
        });
    }
});

/**
 * GET /admin/auth/profile
 * Get admin profile
 */
router.get('/profile', adminIpWhitelist, adminAuthService.createAdminMiddleware(), async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Admin profile retrieved successfully',
            data: {
                admin: {
                    id: req.admin.id,
                    username: req.admin.username,
                    role: req.admin.role,
                    permissions: req.admin.permissions,
                    loginTime: req.admin.loginTime
                },
                permissions: adminAuthService.getAdminPermissions(req.admin)
            }
        });
        
    } catch (error) {
        console.error('❌ [ADMIN_AUTH_ROUTES] Profile error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get profile',
            message: 'Internal server error'
        });
    }
});

/**
 * GET /admin/auth/health
 * Health check for admin auth service
 */
router.get('/health', adminIpWhitelist, async (req, res) => {
    try {
        res.json({
            success: true,
            message: 'Admin auth service is healthy',
            data: {
                service: 'admin_auth',
                status: 'running',
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ [ADMIN_AUTH_ROUTES] Health check error:', error);
        res.status(500).json({
            success: false,
            error: 'Health check failed',
            message: 'Internal server error'
        });
    }
});

module.exports = router; 