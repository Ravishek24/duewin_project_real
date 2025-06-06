// Backend/utils/websocketDiagnostic.js - DIAGNOSTIC TOOL FOR ROOM ISOLATION

const websocketService = require('../services/websocketService');

/**
 * Comprehensive diagnostic tool to identify cross-contamination issues
 */
class WebSocketDiagnostic {
    constructor() {
        this.eventLog = [];
        this.roomActivity = new Map();
        this.resultLog = new Map();
        this.crossContaminationDetected = [];
    }

    /**
     * Start monitoring all WebSocket events
     */
    startMonitoring() {
        console.log('🔍 Starting WebSocket diagnostic monitoring...');
        
        const io = websocketService.getIo();
        if (!io) {
            console.error('❌ WebSocket server not available');
            return;
        }

        // Monitor all socket events
        io.on('connection', (socket) => {
            this.logEvent('CONNECTION', `Socket ${socket.id} connected`, {
                socketId: socket.id,
                userId: socket.user?.userId || socket.user?.id
            });

            // Monitor join/leave events
            socket.on('joinGame', (data) => {
                this.logEvent('JOIN_GAME', `Socket ${socket.id} joining game`, {
                    socketId: socket.id,
                    userId: socket.user?.userId || socket.user?.id,
                    gameType: data.gameType,
                    duration: data.duration,
                    timeline: data.timeline,
                    expectedRoom: `${data.gameType}_${data.duration}_${data.timeline || 'default'}`
                });
            });

            socket.on('leaveGame', (data) => {
                this.logEvent('LEAVE_GAME', `Socket ${socket.id} leaving game`, {
                    socketId: socket.id,
                    gameType: data.gameType,
                    duration: data.duration,
                    timeline: data.timeline
                });
            });

            socket.on('disconnect', () => {
                this.logEvent('DISCONNECT', `Socket ${socket.id} disconnected`, {
                    socketId: socket.id
                });
            });
        });

        // Monitor room-specific events
        this.monitorRoomEvents(io);
        
        // Start periodic checks
        setInterval(() => this.performDiagnosticCheck(), 30000); // Every 30 seconds
        
        console.log('✅ WebSocket diagnostic monitoring started');
    }

    /**
     * Monitor all room-specific events
     */
    monitorRoomEvents(io) {
        // Hook into emit function to monitor all broadcasts
        const originalEmit = io.to.bind(io);
        
        io.to = (room) => {
            const emitWrapper = {
                emit: (event, data) => {
                    this.logRoomEvent(room, event, data);
                    return originalEmit(room).emit(event, data);
                }
            };
            return emitWrapper;
        };
    }

    /**
     * Log room-specific events
     */
    logRoomEvent(room, event, data) {
        const timestamp = new Date().toISOString();
        const eventData = {
            timestamp,
            room,
            event,
            data: this.sanitizeData(data)
        };

        // Store room activity
        if (!this.roomActivity.has(room)) {
            this.roomActivity.set(room, []);
        }
        this.roomActivity.get(room).push(eventData);

        // Check for cross-contamination
        if (event === 'periodResult' || event === 'gameResult') {
            this.checkCrossContamination(room, data);
        }

        this.logEvent('ROOM_EVENT', `Event ${event} sent to room ${room}`, eventData);
    }

    /**
     * Check for cross-contamination in results
     */
    checkCrossContamination(room, data) {
        const gameType = data?.gameType;
        const duration = data?.duration;
        const timeline = data?.timeline;

        if (!gameType || !duration || !timeline) {
            this.logEvent('CONTAMINATION_WARNING', 'Result data missing game info', {
                room,
                data: this.sanitizeData(data)
            });
            return;
        }

        const expectedRoom = `${gameType}_${duration}_${timeline}`;
        
        if (room !== expectedRoom) {
            const contamination = {
                timestamp: new Date().toISOString(),
                issue: 'ROOM_MISMATCH',
                expectedRoom,
                actualRoom: room,
                gameType,
                duration,
                timeline,
                data: this.sanitizeData(data)
            };

            this.crossContaminationDetected.push(contamination);
            
            console.error('🚨 CROSS-CONTAMINATION DETECTED:', contamination);
            
            this.logEvent('CROSS_CONTAMINATION', 'Result sent to wrong room', contamination);
        }

        // Store result for tracking
        const resultKey = `${gameType}_${duration}_${timeline}`;
        if (!this.resultLog.has(resultKey)) {
            this.resultLog.set(resultKey, []);
        }
        this.resultLog.get(resultKey).push({
            timestamp: new Date().toISOString(),
            room,
            periodId: data?.periodId,
            result: data?.result
        });
    }

    /**
     * Log general events
     */
    logEvent(type, message, data = {}) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type,
            message,
            data
        };

        this.eventLog.push(logEntry);

        // Keep only last 1000 events
        if (this.eventLog.length > 1000) {
            this.eventLog.shift();
        }

        // Log critical events immediately
        if (type === 'CROSS_CONTAMINATION' || type === 'CONTAMINATION_WARNING') {
            console.error(`🚨 ${type}: ${message}`, data);
        } else if (type === 'ROOM_EVENT' && (data.event === 'periodResult' || data.event === 'gameResult')) {
            console.log(`📢 ${message}`);
        }
    }

    /**
     * Sanitize data for logging
     */
    sanitizeData(data) {
        if (!data) return null;
        
        try {
            return {
                gameType: data.gameType,
                duration: data.duration,
                timeline: data.timeline,
                periodId: data.periodId,
                event: data.event,
                room: data.room,
                roomId: data.roomId,
                source: data.source,
                timestamp: data.timestamp,
                hasResult: !!data.result,
                hasWinners: !!data.winners,
                winnerCount: data.winnerCount || 0
            };
        } catch (error) {
            return { error: 'Failed to sanitize data' };
        }
    }

    /**
     * Perform comprehensive diagnostic check
     */
    performDiagnosticCheck() {
        console.log('\n🔍 PERFORMING DIAGNOSTIC CHECK...');
        
        const io = websocketService.getIo();
        if (!io) {
            console.error('❌ WebSocket server not available');
            return;
        }

        // Check room structure
        this.checkRoomStructure(io);
        
        // Check for duplicate results
        this.checkDuplicateResults();
        
        // Check game tick isolation
        this.checkGameTickIsolation();
        
        // Report cross-contamination
        this.reportCrossContamination();
        
        console.log('✅ Diagnostic check completed\n');
    }

    /**
     * Check room structure and client distribution
     */
    checkRoomStructure(io) {
        console.log('📊 ROOM STRUCTURE ANALYSIS:');
        
        const rooms = io.sockets.adapter.rooms;
        const gameRooms = new Map();
        
        for (const [roomName, room] of rooms.entries()) {
            if (roomName.includes('_') && !roomName.startsWith('room_')) {
                const parts = roomName.split('_');
                if (parts.length >= 3) {
                    const gameType = parts[0];
                    const duration = parts[1];
                    const timeline = parts.slice(2).join('_');
                    
                    if (!gameRooms.has(gameType)) {
                        gameRooms.set(gameType, new Map());
                    }
                    if (!gameRooms.get(gameType).has(duration)) {
                        gameRooms.get(gameType).set(duration, new Map());
                    }
                    
                    gameRooms.get(gameType).get(duration).set(timeline, {
                        roomName,
                        clientCount: room.size,
                        clients: Array.from(room)
                    });
                }
            }
        }
        
        // Display structure
        gameRooms.forEach((durations, gameType) => {
            console.log(`\n🎮 ${gameType.toUpperCase()}:`);
            durations.forEach((timelines, duration) => {
                console.log(`  ⏱️ ${duration}s:`);
                timelines.forEach((roomInfo, timeline) => {
                    console.log(`    📍 ${timeline}: ${roomInfo.clientCount} clients in ${roomInfo.roomName}`);
                    
                    // Check for unexpected clients
                    if (roomInfo.clientCount > 10) {
                        console.warn(`    ⚠️ High client count (${roomInfo.clientCount}) in ${roomInfo.roomName}`);
                    }
                });
            });
        });
    }

    /**
     * Check for duplicate results across timelines
     */
    checkDuplicateResults() {
        console.log('\n🔍 DUPLICATE RESULT ANALYSIS:');
        
        const duplicates = [];
        const resultsByPeriod = new Map();
        
        this.resultLog.forEach((results, gameKey) => {
            results.forEach(result => {
                const periodKey = `${result.periodId}`;
                if (!resultsByPeriod.has(periodKey)) {
                    resultsByPeriod.set(periodKey, []);
                }
                resultsByPeriod.get(periodKey).push({
                    gameKey,
                    room: result.room,
                    result: result.result,
                    timestamp: result.timestamp
                });
            });
        });
        
        resultsByPeriod.forEach((results, periodId) => {
            if (results.length > 1) {
                // Check if they're for different timelines (expected) or same timeline (problem)
                const uniqueGameKeys = new Set(results.map(r => r.gameKey));
                if (uniqueGameKeys.size < results.length) {
                    duplicates.push({
                        periodId,
                        results,
                        issue: 'Same timeline multiple results'
                    });
                }
            }
        });
        
        if (duplicates.length > 0) {
            console.error('🚨 DUPLICATE RESULTS DETECTED:', duplicates);
        } else {
            console.log('✅ No duplicate results detected');
        }
    }

    /**
     * Check game tick isolation
     */
    checkGameTickIsolation() {
        console.log('\n⏰ GAME TICK ISOLATION CHECK:');
        
        const stats = websocketService.getSystemStats();
        const expectedTicks = Object.values(websocketService.GAME_CONFIGS)
            .reduce((sum, durations) => sum + durations.length, 0) * websocketService.TIMELINES.length;
        
        console.log(`Expected game ticks: ${expectedTicks}`);
        console.log(`Active game ticks: ${stats.activeGameIntervals}`);
        console.log(`Cached periods: ${stats.cachedPeriods}`);
        
        if (stats.activeGameIntervals !== expectedTicks) {
            console.error(`🚨 TICK ISOLATION ISSUE: Expected ${expectedTicks}, got ${stats.activeGameIntervals}`);
        } else {
            console.log('✅ Game tick isolation correct');
        }
    }

    /**
     * Report cross-contamination summary
     */
    reportCrossContamination() {
        console.log('\n🚨 CROSS-CONTAMINATION REPORT:');
        
        if (this.crossContaminationDetected.length === 0) {
            console.log('✅ No cross-contamination detected');
            return;
        }
        
        console.error(`❌ ${this.crossContaminationDetected.length} cross-contamination issues detected:`);
        
        this.crossContaminationDetected.forEach((issue, index) => {
            console.error(`\n${index + 1}. ${issue.issue}:`);
            console.error(`   Expected room: ${issue.expectedRoom}`);
            console.error(`   Actual room: ${issue.actualRoom}`);
            console.error(`   Game: ${issue.gameType} ${issue.duration}s ${issue.timeline}`);
            console.error(`   Time: ${issue.timestamp}`);
        });
        
        // Clear detected issues after reporting
        this.crossContaminationDetected = [];
    }

    /**
     * Get diagnostic summary
     */
    getDiagnosticSummary() {
        return {
            totalEvents: this.eventLog.length,
            roomsMonitored: this.roomActivity.size,
            gamesTracked: this.resultLog.size,
            crossContaminationIssues: this.crossContaminationDetected.length,
            lastCheck: new Date().toISOString()
        };
    }

    /**
     * Export diagnostic data
     */
    exportDiagnosticData() {
        return {
            summary: this.getDiagnosticSummary(),
            eventLog: this.eventLog.slice(-100), // Last 100 events
            roomActivity: Object.fromEntries(this.roomActivity),
            resultLog: Object.fromEntries(this.resultLog),
            crossContamination: this.crossContaminationDetected
        };
    }
}

// Create singleton instance
const diagnostic = new WebSocketDiagnostic();

module.exports = {
    diagnostic,
    startDiagnostic: () => diagnostic.startMonitoring(),
    getDiagnosticData: () => diagnostic.exportDiagnosticData(),
    performManualCheck: () => diagnostic.performDiagnosticCheck()
};