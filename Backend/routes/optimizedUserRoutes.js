const express = require('express');
const router = express.Router();

// Import optimized controllers
const optimizedRegisterController = require('../controllers/userController/optimizedRegisterController');
const optimizedLoginController = require('../controllers/userController/optimizedLoginController');

// Import original controllers (for fallback)
const originalRegisterController = require('../controllers/userController/registerController');
const originalLoginController = require('../controllers/userController/loginController');

// Import validation middleware (maintain original validation)
const { validationRules } = require('../middleware/inputValidator');

// Configuration: Set to true to use optimized controllers, false for original
const USE_OPTIMIZED_CONTROLLERS = process.env.USE_OPTIMIZED_CONTROLLERS === 'true' || true; // Default to optimized

/**
 * OPTIMIZED USER ROUTES
 * Features:
 * - Choose between optimized and original controllers
 * - Maintains 100% API compatibility
 * - Enhanced performance monitoring
 * - Graceful fallback on errors
 */

// Route: User Registration
router.post('/signup', 
    validationRules.signup, // Maintain original validation
    async (req, res, next) => {
        const startTime = Date.now();
        
        try {
            if (USE_OPTIMIZED_CONTROLLERS) {
                console.log('🚀 Using optimized registration controller');
                await optimizedRegisterController(req, res);
            } else {
                console.log('📝 Using original registration controller');
                await originalRegisterController(req, res);
            }
            
            const processingTime = Date.now() - startTime;
            console.log(`⚡ Registration request completed in ${processingTime}ms`);
            
        } catch (error) {
            console.error('❌ Registration route error:', error.message);
            
            // Graceful fallback to original controller if optimized fails
            if (USE_OPTIMIZED_CONTROLLERS && !res.headersSent) {
                console.log('🔄 Falling back to original registration controller');
                try {
                    await originalRegisterController(req, res);
                } catch (fallbackError) {
                    console.error('❌ Fallback registration failed:', fallbackError.message);
                    next(fallbackError);
                }
            } else {
                next(error);
            }
        }
    }
);

// Route: User Login
router.post('/login', 
    validationRules.login, // Maintain original validation
    async (req, res, next) => {
        const startTime = Date.now();
        
        try {
            if (USE_OPTIMIZED_CONTROLLERS) {
                console.log('🚀 Using optimized login controller');
                await optimizedLoginController(req, res);
            } else {
                console.log('🔑 Using original login controller');
                await originalLoginController(req, res);
            }
            
            const processingTime = Date.now() - startTime;
            console.log(`⚡ Login request completed in ${processingTime}ms`);
            
        } catch (error) {
            console.error('❌ Login route error:', error.message);
            
            // Graceful fallback to original controller if optimized fails
            if (USE_OPTIMIZED_CONTROLLERS && !res.headersSent) {
                console.log('🔄 Falling back to original login controller');
                try {
                    await originalLoginController(req, res);
                } catch (fallbackError) {
                    console.error('❌ Fallback login failed:', fallbackError.message);
                    next(fallbackError);
                }
            } else {
                next(error);
            }
        }
    }
);

// Route: Performance metrics endpoint (NEW)
router.get('/performance-metrics', async (req, res) => {
    try {
        const optimizedCacheService = require('../services/optimizedCacheService');
        const metrics = await optimizedCacheService.getCacheMetrics();
        
        res.json({
            success: true,
            data: {
                optimizationsEnabled: USE_OPTIMIZED_CONTROLLERS,
                cacheMetrics: metrics,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('❌ Error fetching performance metrics:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error fetching performance metrics'
        });
    }
});

// Route: Toggle optimization mode (for testing - admin only)
router.post('/toggle-optimization', async (req, res) => {
    try {
        // This would typically be protected by admin middleware
        // For now, just return current status
        res.json({
            success: true,
            data: {
                currentMode: USE_OPTIMIZED_CONTROLLERS ? 'optimized' : 'original',
                message: 'Optimization mode is configured via environment variable USE_OPTIMIZED_CONTROLLERS'
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error toggling optimization mode'
        });
    }
});

// Route: Cache health check (NEW)
router.get('/cache-health', async (req, res) => {
    try {
        const optimizedCacheService = require('../services/optimizedCacheService');
        await optimizedCacheService.initialize();
        
        // Simple cache test
        const testKey = 'health_check_' + Date.now();
        const testValue = 'ok';
        
        // Test cache operations
        await optimizedCacheService.cacheClient.setex(testKey, 10, testValue);
        const retrieved = await optimizedCacheService.cacheClient.get(testKey);
        await optimizedCacheService.cacheClient.del(testKey);
        
        const isHealthy = retrieved === testValue;
        
        res.json({
            success: true,
            data: {
                cacheStatus: isHealthy ? 'healthy' : 'unhealthy',
                testPassed: isHealthy,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('❌ Cache health check failed:', error.message);
        res.status(500).json({
            success: false,
            message: 'Cache health check failed',
            error: error.message
        });
    }
});

// Middleware: Request logging with performance tracking
router.use((req, res, next) => {
    const startTime = Date.now();
    
    // Log request start
    console.log(`📨 ${req.method} ${req.path} - ${req.ip} - Started`);
    
    // Override res.json to log response time
    const originalJson = res.json;
    res.json = function(data) {
        const processingTime = Date.now() - startTime;
        console.log(`📤 ${req.method} ${req.path} - ${res.statusCode} - ${processingTime}ms`);
        
        // Add performance info to response if it's a success response
        if (data && data.success && !data.meta) {
            data.meta = {
                processingTime: `${processingTime}ms`,
                optimized: USE_OPTIMIZED_CONTROLLERS
            };
        }
        
        return originalJson.call(this, data);
    };
    
    next();
});

module.exports = {
    router,
    isOptimized: () => USE_OPTIMIZED_CONTROLLERS
}; 