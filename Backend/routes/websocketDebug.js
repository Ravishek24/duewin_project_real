

const express = require('express');
const router = express.Router();
const { verifyGameTicks } = require('../services/websocketService');
const { getIo } = require('../config/socketConfig');

/**
 * Get WebSocket system status
 */
router.get('/status', async (req, res) => {
    try {
        // Check if Socket.IO is initialized
        const io = getIo();
        const socketInitialized = !!io;
        
        // Check game ticks status
        const gameTicksStatus = verifyGameTicks();
        
        // Get connected clients count
        let connectedClients = 0;
        let roomInfo = {};
        
        if (io) {
            connectedClients = io.engine.clientsCount;
            
            // Get room information
            const rooms = io.sockets.adapter.rooms;
            roomInfo = {};
            
            rooms.forEach((socketIds, roomName) => {
                if (!roomName.includes('_')) return; // Skip individual socket rooms
                roomInfo[roomName] = socketIds.size;
            });
        }
        
        // Check services status
        let servicesStatus = {};
        try {
            const periodService = require('../services/periodService');
            servicesStatus.periodService = 'loaded';
        } catch (e) {
            servicesStatus.periodService = 'not loaded';
        }
        
        try {
            const gameLogicService = require('../services/gameLogicService');
            servicesStatus.gameLogicService = 'loaded';
        } catch (e) {
            servicesStatus.gameLogicService = 'not loaded';
        }
        
        const status = {
            websocket: {
                initialized: socketInitialized,
                connectedClients,
                rooms: roomInfo
            },
            gameTicks: gameTicksStatus,
            services: servicesStatus,
            timestamp: new Date().toISOString()
        };
        
        res.json({
            success: true,
            data: status
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error getting WebSocket status',
            error: error.message
        });
    }
});

/**
 * Trigger a test broadcast
 */
router.post('/test-broadcast', async (req, res) => {
    try {
        const { gameType = 'wingo', duration = 60, message = 'Test broadcast' } = req.body;
        
        const io = getIo();
        if (!io) {
            return res.status(400).json({
                success: false,
                message: 'WebSocket not initialized'
            });
        }
        
        const roomId = `${gameType}_${duration}`;
        
        // Send test message to specific room
        io.to(roomId).emit('testMessage', {
            gameType,
            duration,
            message,
            timestamp: new Date().toISOString()
        });
        
        // Also send to all connected clients
        io.emit('globalTestMessage', {
            message: 'Global test broadcast',
            timestamp: new Date().toISOString()
        });
        
        res.json({
            success: true,
            message: `Test broadcast sent to room ${roomId}`,
            data: {
                roomId,
                gameType,
                duration,
                message
            }
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error sending test broadcast',
            error: error.message
        });
    }
});

/**
 * Get current game periods status
 */
router.get('/periods', async (req, res) => {
    try {
        const periodService = require('../services/periodService');
        const gameTypes = ['wingo', 'trx_wix', 'k3', 'fiveD'];
        const durations = [30, 60, 180, 300, 600];
        
        const periodsStatus = {};
        
        for (const gameType of gameTypes) {
            periodsStatus[gameType] = {};
            
            for (const duration of durations) {
                try {
                    const currentPeriod = await periodService.getCurrentPeriod(gameType, duration);
                    periodsStatus[gameType][duration] = currentPeriod ? {
                        periodId: currentPeriod.periodId,
                        startTime: currentPeriod.startTime,
                        endTime: currentPeriod.endTime,
                        timeRemaining: Math.max(0, Math.floor((new Date(currentPeriod.endTime) - new Date()) / 1000))
                    } : null;
                } catch (e) {
                    periodsStatus[gameType][duration] = { error: e.message };
                }
            }
        }
        
        res.json({
            success: true,
            data: periodsStatus,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error getting periods status',
            error: error.message
        });
    }
});

/**
 * Force restart game ticks
 */
router.post('/restart-ticks', async (req, res) => {
    try {
        const { stopGameTicks, startGameTickSystem } = require('../services/websocketService');
        
        // Stop existing ticks
        stopGameTicks();
        
        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Start new ticks
        await startGameTickSystem();
        
        res.json({
            success: true,
            message: 'Game ticks restarted successfully',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error restarting game ticks',
            error: error.message
        });
    }
});

/**
 * Debug JWT token
 */
router.post('/debug-token', async (req, res) => {
    try {
        const { token } = req.body;
        
        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required in request body'
            });
        }
        
        const { validateTokenDebug } = require('../middleware/websocketAuth');
        const validation = validateTokenDebug(token);
        
        res.json({
            success: true,
            validation,
            tokenLength: token.length,
            tokenStart: token.substring(0, 20) + '...',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error debugging token',
            error: error.message
        });
    }
});

/**
 * Test WebSocket connection with detailed logging
 */
router.get('/test-connection', async (req, res) => {
    try {
        const io = getIo();
        if (!io) {
            return res.status(500).json({
                success: false,
                message: 'WebSocket not initialized'
            });
        }
        
        // Get connection info
        const connectedSockets = io.sockets.sockets.size;
        const engines = io.engine ? io.engine.clientsCount : 0;
        
        res.json({
            success: true,
            websocket: {
                initialized: true,
                connectedSockets,
                engineClients: engines,
                rooms: Array.from(io.sockets.adapter.rooms.keys()).filter(room => room.includes('_'))
            },
            instructions: {
                auth_method_1: 'socket.auth = { token: "your-jwt-token" }',
                auth_method_2: 'socket.query = { token: "your-jwt-token" }',
                auth_method_3: 'socket.headers = { authorization: "Bearer your-jwt-token" }'
            },
            testTokenEndpoint: '/api/websocket-debug/create-test-token',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error testing connection',
            error: error.message
        });
    }
});

/**
 * Monitor incoming WebSocket connection attempts
 */
router.get('/monitor-connections', async (req, res) => {
    try {
        // This will help us see what's being sent from frontend
        res.json({
            success: true,
            message: 'Check server logs for WebSocket connection attempts',
            debugSteps: [
                '1. Make sure your frontend sends token in socket.auth.token',
                '2. Check server logs for "WebSocket Auth: Token validation details"',
                '3. Verify token is a valid JWT with 3 parts separated by dots',
                '4. Use /api/websocket-debug/create-test-token to get a working token'
            ],
            currentTime: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error setting up monitoring',
            error: error.message
        });
    }
});
router.post('/create-test-token', async (req, res) => {
    try {
        const { userId = 'test123', email = 'test@example.com' } = req.body;
        
        const { createTestToken } = require('../middleware/websocketAuth');
        const testToken = createTestToken(userId, email);
        
        if (!testToken) {
            return res.status(500).json({
                success: false,
                message: 'Failed to create test token'
            });
        }
        
        res.json({
            success: true,
            testToken,
            userId,
            email,
            usage: 'Use this token in WebSocket auth.token or query.token',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error creating test token',
            error: error.message
        });
    }
});
module.exports = router;