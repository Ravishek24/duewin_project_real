// Backend/routes/internalGameRoutes.js - SIMPLIFIED VERSION - REPLACE ENTIRE FILE
const express = require('express');
const { auth, requirePhoneVerification } = require('../middlewares/authMiddleware');
const rateLimiters = require('../middleware/rateLimiter');
const gameLogicService = require('../services/gameLogicService');

const router = express.Router();

/**
 * This file is now simplified - most functionality moved to gameRoutes.js
 * Keep only admin-specific routes here
 */

// Middleware for admin routes
router.use(auth);

/**
 * Admin-only routes for game management
 */

// Get bet distribution for a period (admin only)
router.get('/admin/:gameType/:duration/:periodId/distribution', 
    requirePhoneVerification,
    async (req, res) => {
        try {
            // Check if user is admin
            if (!req.user.is_admin) {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }

            const { gameType, duration, periodId } = req.params;
            
            const distribution = await gameLogicService.getBetDistribution(
                gameType, 
                parseInt(duration), 
                periodId
            );
            
            res.json({ 
                success: true, 
                data: distribution 
            });
        } catch (error) {
            console.error('Error getting bet distribution:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get bet distribution'
            });
        }
    }
);

// Get optimization analysis for a period (admin only)
router.get('/admin/:gameType/:duration/:periodId/analysis', 
    requirePhoneVerification,
    async (req, res) => {
        try {
            // Check if user is admin
            if (!req.user.is_admin) {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }

            const { gameType, duration, periodId } = req.params;
            
            const analysis = await gameLogicService.calculateOptimizedResult(
                gameType, 
                parseInt(duration), 
                periodId
            );
            
            // Add period info
            const periodInfo = await gameLogicService.getEnhancedPeriodStatus(
                gameType, 
                parseInt(duration), 
                periodId
            );
            
            res.json({ 
                success: true, 
                data: {
                    analysis,
                    periodInfo: periodInfo.data
                }
            });
        } catch (error) {
            console.error('Error getting results analysis:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get results analysis'
            });
        }
    }
);

// Override result for a period (admin only)
router.post('/admin/:gameType/:duration/:periodId/override', 
    requirePhoneVerification,
    async (req, res) => {
        try {
            // Check if user is admin
            if (!req.user.is_admin) {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }

            const { gameType, duration, periodId } = req.params;
            const { result } = req.body;
            
            if (!result) {
                return res.status(400).json({
                    success: false,
                    message: 'Result is required'
                });
            }
            
            const override = await gameLogicService.overrideResult(
                gameType,
                parseInt(duration),
                periodId,
                result,
                req.user.user_id
            );
            
            if (!override.success) {
                return res.status(400).json(override);
            }
            
            res.json(override);
        } catch (error) {
            console.error('Error overriding result:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to override result'
            });
        }
    }
);

// Get optimization performance metrics (admin only)
router.get('/admin/:gameType/:duration/:periodId/performance', 
    requirePhoneVerification,
    async (req, res) => {
        try {
            // Check if user is admin
            if (!req.user.is_admin) {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }

            const { gameType, duration, periodId } = req.params;
            
            const metrics = await gameLogicService.getOptimizationPerformanceMetrics(
                gameType, 
                parseInt(duration), 
                periodId
            );
            
            res.json({
                success: true,
                data: metrics
            });
        } catch (error) {
            console.error('Error getting performance metrics:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get performance metrics'
            });
        }
    }
);

// Get system health check (admin only)
router.get('/admin/system/health', 
    requirePhoneVerification,
    async (req, res) => {
        try {
            // Check if user is admin
            if (!req.user.is_admin) {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required'
                });
            }

            const healthCheck = await gameLogicService.getSystemHealthCheck();
            
            res.json({
                success: true,
                data: healthCheck
            });
        } catch (error) {
            console.error('Error getting system health:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get system health'
            });
        }
    }
);

module.exports = router;  