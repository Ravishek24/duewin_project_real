const helmet = require('helmet');
const securityConfig = require('../config/securityConfig');

/**
 * Comprehensive Security Middleware
 * Applies all security headers and configurations from securityConfig.js
 */
const securityMiddleware = (app) => {
    console.log('🔒 Setting up security middleware...');

    // 1. Basic Helmet configuration
    app.use(helmet({
        // Content Security Policy
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                connectSrc: ["'self'", "wss:", "ws:", "https:"],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:"],
                styleSrc: ["'self'", "'unsafe-inline'", "https:"],
                imgSrc: ["'self'", "data:", "https:", "blob:"],
                fontSrc: ["'self'", "https:"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'", "https:"],
                frameSrc: ["'none'"],
                workerSrc: ["'self'"],
                manifestSrc: ["'self'"],
                prefetchSrc: ["'self'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'none'"],
                upgradeInsecureRequests: []
            }
        },
        // X-Frame-Options
        frameguard: {
            action: 'deny'
        },
        // X-Content-Type-Options
        noSniff: true,
        // X-XSS-Protection
        xssFilter: true,
        // HSTS
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        },
        // Referrer Policy
        referrerPolicy: {
            policy: 'strict-origin-when-cross-origin'
        },
        // Permissions Policy
        permittedCrossDomainPolicies: {
            permittedPolicies: 'none'
        },
        // DNS Prefetch Control
        dnsPrefetchControl: {
            allow: false
        },
        // IE No Open
        ieNoOpen: true,
        // Hide Powered By
        hidePoweredBy: true,
        // Force HTTPS
        forceSecureCookies: true
    }));

    // 2. Explicit security headers middleware (ensures headers are set even if Helmet fails)
    app.use((req, res, next) => {
        // Apply custom headers from securityConfig
        const headers = securityConfig.headers;
        
        // Content Security Policy (CSP) - CRITICAL
        res.setHeader('Content-Security-Policy', headers['Content-Security-Policy']);
        
        // X-Content-Type-Options - CRITICAL
        res.setHeader('X-Content-Type-Options', headers['X-Content-Type-Options']);
        
        // X-Frame-Options - CRITICAL
        res.setHeader('X-Frame-Options', headers['X-Frame-Options']);
        
        // X-XSS-Protection
        res.setHeader('X-XSS-Protection', headers['X-XSS-Protection']);
        
        // Strict-Transport-Security (HSTS)
        res.setHeader('Strict-Transport-Security', headers['Strict-Transport-Security']);
        
        // X-Permitted-Cross-Domain-Policies
        res.setHeader('X-Permitted-Cross-Domain-Policies', headers['X-Permitted-Cross-Domain-Policies']);
        
        // Referrer-Policy - CRITICAL
        res.setHeader('Referrer-Policy', headers['Referrer-Policy']);
        
        // Permissions-Policy - CRITICAL
        res.setHeader('Permissions-Policy', headers['Permissions-Policy']);
        
        // Cross-Origin-Opener-Policy
        res.setHeader('Cross-Origin-Opener-Policy', headers['Cross-Origin-Opener-Policy']);
        
        // Cross-Origin-Embedder-Policy
        if (headers['Cross-Origin-Embedder-Policy']) {
            res.setHeader('Cross-Origin-Embedder-Policy', headers['Cross-Origin-Embedder-Policy']);
        }

        // Additional security headers
        res.setHeader('X-Download-Options', 'noopen');
        res.setHeader('X-DNS-Prefetch-Control', 'off');
        res.setHeader('X-Requested-With', 'XMLHttpRequest');

        // Remove X-Powered-By header (ensure it's removed)
        res.removeHeader('X-Powered-By');

        next();
    });

    // 3. Server hardening middleware
    app.use((req, res, next) => {
        // Trust proxy configuration
        if (securityConfig.server.trustProxy) {
            app.set('trust proxy', 1);
        }

        // Disable X-Powered-By
        if (!securityConfig.server.xPoweredBy) {
            app.disable('x-powered-by');
        }

        next();
    });

    // 4. Security logging middleware
    app.use((req, res, next) => {
        // 🔒 CRITICAL: Block access to sensitive files and directories
        const sensitivePatterns = [
            /\.git/i,
            /\.env/i,
            /\.config/i,
            /\.ini/i,
            /\.log/i,
            /\.sql/i,
            /\.bak/i,
            /\.backup/i,
            /\.old/i,
            /\.tmp/i,
            /\.temp/i,
            /\/\./i  // Any hidden file/directory
        ];

        const requestPath = req.path.toLowerCase();
        
        // Check if request is for sensitive files
        for (const pattern of sensitivePatterns) {
            if (pattern.test(requestPath)) {
                console.log(`🚨 BLOCKED: ${req.method} ${req.path} from ${req.ip} - User-Agent: ${req.headers['user-agent']}`);
                return res.status(404).json({
                    success: false,
                    message: 'Not found'
                });
            }
        }

        // Log security-relevant requests
        if (req.headers['user-agent']?.includes('bot') || 
            req.headers['user-agent']?.includes('crawler') ||
            req.path.includes('admin') ||
            req.path.includes('api/admin')) {
            console.log(`🔒 Security Log: ${req.method} ${req.path} from ${req.ip} - User-Agent: ${req.headers['user-agent']}`);
        }
        next();
    });

    // 5. Response interceptor to ensure headers are set
    app.use((req, res, next) => {
        const originalSend = res.send;
        const originalJson = res.json;
        const originalEnd = res.end;

        // Override send method to ensure headers are set
        res.send = function(data) {
            // CRITICAL FIX: Only set headers if not already sent
            if (!res.headersSent) {
                ensureSecurityHeaders(res);
            }
            return originalSend.call(this, data);
        };

        // Override json method to ensure headers are set
        res.json = function(data) {
            // CRITICAL FIX: Only set headers if not already sent
            if (!res.headersSent) {
                ensureSecurityHeaders(res);
            }
            return originalJson.call(this, data);
        };

        // Override end method to ensure headers are set
        res.end = function(data) {
            // CRITICAL FIX: Only set headers if not already sent
            if (!res.headersSent) {
                ensureSecurityHeaders(res);
            }
            return originalEnd.call(this, data);
        };

        next();
    });

    console.log('✅ Security middleware configured successfully');
};

/**
 * Helper function to ensure security headers are always set
 */
function ensureSecurityHeaders(res) {
    // CRITICAL FIX: Check if headers have already been sent
    if (res.headersSent) {
        return; // Don't modify headers if already sent
    }
    
    const headers = securityConfig.headers;
    
    // Critical headers that must be present
    const criticalHeaders = [
        'Content-Security-Policy',
        'X-Content-Type-Options', 
        'X-Frame-Options',
        'Referrer-Policy',
        'Permissions-Policy'
    ];

    criticalHeaders.forEach(header => {
        if (!res.getHeader(header)) {
            res.setHeader(header, headers[header]);
        }
    });

    // Ensure X-Powered-By is removed (only if headers not sent)
    if (!res.headersSent) {
        res.removeHeader('X-Powered-By');
    }
}

module.exports = securityMiddleware; 