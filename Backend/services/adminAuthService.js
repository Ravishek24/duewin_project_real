const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/**
 * Admin Authentication Service
 * Handles admin login, token generation, and authentication
 */

class AdminAuthService {
    constructor() {
        // Default admin credentials (should be moved to environment variables)
        this.adminCredentials = {
            username: process.env.ADMIN_USERNAME || 'admin',
            password: process.env.ADMIN_PASSWORD || 'admin123',
            role: 'super_admin',
            permissions: ['exposure_monitor', 'game_control', 'user_management']
        };
        
        this.jwtSecret = process.env.ADMIN_JWT_SECRET || 'admin-secret-key-change-in-production';
        this.tokenExpiry = '7h';
    }

    /**
     * Admin login
     */
    async adminLogin(username, password, otp = null) {
        try {
            // Verify credentials
            if (username !== this.adminCredentials.username) {
                return {
                    success: false,
                    error: 'Invalid credentials',
                    message: 'Username or password is incorrect'
                };
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, await bcrypt.hash(this.adminCredentials.password, 10));
            if (!isPasswordValid) {
                return {
                    success: false,
                    error: 'Invalid credentials',
                    message: 'Username or password is incorrect'
                };
            }

            // Generate admin token
            const adminData = {
                id: 'admin_001',
                username: username,
                role: this.adminCredentials.role,
                permissions: this.adminCredentials.permissions,
                loginTime: new Date().toISOString()
            };

            const token = jwt.sign(adminData, this.jwtSecret, {
                expiresIn: this.tokenExpiry
            });

            console.log(`✅ [ADMIN_AUTH] Admin login successful: ${username}`);

            return {
                success: true,
                message: 'Admin login successful',
                data: {
                    token: token,
                    admin: adminData,
                    expiresIn: this.tokenExpiry
                }
            };

        } catch (error) {
            console.error('❌ [ADMIN_AUTH] Login error:', error);
            return {
                success: false,
                error: 'Login failed',
                message: error.message
            };
        }
    }

    /**
     * Verify admin token
     */
    verifyAdminToken(token) {
        try {
            const decoded = jwt.verify(token, this.jwtSecret);
            return {
                valid: true,
                admin: decoded
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Refresh admin token
     */
    async refreshAdminToken(token) {
        try {
            const tokenResult = this.verifyAdminToken(token);
            
            if (!tokenResult.valid) {
                return {
                    success: false,
                    error: 'Invalid token',
                    message: 'Cannot refresh invalid token'
                };
            }

            // Generate new token with updated login time
            const adminData = {
                ...tokenResult.admin,
                loginTime: new Date().toISOString()
            };

            const newToken = jwt.sign(adminData, this.jwtSecret, {
                expiresIn: this.tokenExpiry
            });

            return {
                success: true,
                message: 'Token refreshed successfully',
                data: {
                    token: newToken,
                    admin: adminData,
                    expiresIn: this.tokenExpiry
                }
            };

        } catch (error) {
            console.error('❌ [ADMIN_AUTH] Token refresh error:', error);
            return {
                success: false,
                error: 'Token refresh failed',
                message: error.message
            };
        }
    }

    /**
     * Check admin permissions
     */
    checkAdminPermission(admin, permission) {
        if (!admin || !admin.permissions) {
            return false;
        }
        
        return admin.permissions.includes(permission) || admin.permissions.includes('super_admin');
    }

    /**
     * Generate admin session
     */
    generateAdminSession(admin) {
        return {
            sessionId: crypto.randomBytes(32).toString('hex'),
            adminId: admin.id,
            username: admin.username,
            role: admin.role,
            permissions: admin.permissions,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString() // 7 hours
        };
    }

    /**
     * Validate admin session
     */
    validateAdminSession(session) {
        if (!session || !session.expiresAt) {
            return false;
        }

        const now = new Date();
        const expiresAt = new Date(session.expiresAt);

        return now < expiresAt;
    }

    /**
     * Log admin activity
     */
    logAdminActivity(admin, action, details = {}) {
        const logData = {
            timestamp: new Date().toISOString(),
            adminId: admin.id,
            username: admin.username,
            action: action,
            details: details,
            ip: details.ip || 'unknown'
        };

        console.log('🔐 [ADMIN_ACTIVITY]', logData);
        
        // Store in database for audit trail
        // This would typically go to a database table
        return logData;
    }

    /**
     * Get admin permissions
     */
    getAdminPermissions(admin) {
        if (!admin) {
            return [];
        }

        return admin.permissions || [];
    }

    /**
     * Check if admin has exposure monitor permission
     */
    hasExposureMonitorPermission(admin) {
        return this.checkAdminPermission(admin, 'exposure_monitor');
    }

    /**
     * Check if admin has game control permission
     */
    hasGameControlPermission(admin) {
        return this.checkAdminPermission(admin, 'game_control');
    }

    /**
     * Check if admin has user management permission
     */
    hasUserManagementPermission(admin) {
        return this.checkAdminPermission(admin, 'user_management');
    }

    /**
     * Create admin middleware for Express
     */
    createAdminMiddleware() {
        return (req, res, next) => {
            const token = req.headers.authorization?.replace('Bearer ', '');
            
            if (!token) {
                return res.status(401).json({
                    success: false,
                    error: 'No token provided',
                    message: 'Admin token required'
                });
            }
            
            const tokenResult = this.verifyAdminToken(token);
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
    }

    /**
     * Create permission middleware
     */
    createPermissionMiddleware(permission) {
        return (req, res, next) => {
            if (!req.admin) {
                return res.status(401).json({
                    success: false,
                    error: 'No admin data',
                    message: 'Admin authentication required'
                });
            }
            
            if (!this.checkAdminPermission(req.admin, permission)) {
                return res.status(403).json({
                    success: false,
                    error: 'Permission denied',
                    message: `You need ${permission} permission`
                });
            }
            
            next();
        };
    }
}

module.exports = new AdminAuthService(); 
