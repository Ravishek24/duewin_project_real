// routes/monitoringRoutes.js - Dedicated monitoring routes (no auth required)
const express = require('express');
const router = express.Router();

// 🔓 PUBLIC MONITORING ROUTES (No Auth Required) - For monitoring and debugging
// Database lock monitoring endpoint - PUBLIC
router.get('/database-locks', async (req, res) => {
    try {
        const CreditService = require('../services/creditService');
        const lockInfo = await CreditService.getDatabaseLockInfo();
        const queueStatus = await CreditService.getEnhancedQueueStatus();
        
        res.json({
            success: true,
            locks: lockInfo,
            queue: queueStatus,
            timestamp: new Date().toISOString(),
            note: 'Public monitoring endpoint - no authentication required'
        });
    } catch (error) {
        console.error('❌ [MONITORING_ROUTES] Database locks endpoint error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Credit service queue status endpoint - PUBLIC
router.get('/credit-service-status', async (req, res) => {
    try {
        const CreditService = require('../services/creditService');
        const queueStatus = await CreditService.getEnhancedQueueStatus();
        
        res.json({
            success: true,
            queue: queueStatus,
            timestamp: new Date().toISOString(),
            note: 'Public monitoring endpoint - no authentication required'
        });
    } catch (error) {
        console.error('❌ [MONITORING_ROUTES] Credit service status error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// System health check endpoint - PUBLIC
router.get('/health', async (req, res) => {
    try {
        const CreditService = require('../services/creditService');
        const queueStatus = await CreditService.getEnhancedQueueStatus();
        
        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                creditService: 'operational',
                database: 'operational',
                queue: queueStatus.queueSize || 0
            },
            note: 'Public health check endpoint - no authentication required'
        });
    } catch (error) {
        console.error('❌ [MONITORING_ROUTES] Health check error:', error);
        res.status(500).json({
            success: false,
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Database connection pool status - PUBLIC
router.get('/database-pool', async (req, res) => {
    try {
        const { getModels } = require('../models');
        const models = await getModels();
        
        // Get connection pool info
        const pool = models.sequelize.connectionManager.pool;
        const poolInfo = {
            size: pool.size,
            available: pool.available,
            pending: pool.pending,
            borrowed: pool.borrowed,
            min: pool.min,
            max: pool.max
        };
        
        res.json({
            success: true,
            pool: poolInfo,
            timestamp: new Date().toISOString(),
            note: 'Public database pool endpoint - no authentication required'
        });
    } catch (error) {
        console.error('❌ [MONITORING_ROUTES] Database pool error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

module.exports = router;
