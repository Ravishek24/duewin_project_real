function getredisHelper() {
  if (!redisHelper) throw new Error('redisHelper not set!');
  return getredisHelper();
}
let redisHelper = null;
function setRedisHelper(helper) { redisHelper = helper; }




const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const unifiedRedis = require('../config/unifiedRedisManager');
let unifiedRedisHelper = null;

// Initialize unifiedRedisHelper if not already
if (!unifiedRedisHelper) {
    unifiedRedisHelper = unifiedRedis.getHelper();
}

/**
 * Admin Exposure Service for Wingo Monitoring
 * Monitors live exposure across all 4 Wingo durations
 */

class AdminExposureService {
    constructor() {
        this.wingoDurations = [30, 60, 180, 300]; // 30s, 1m, 3m, 5m
        this.adminIPs = process.env.ADMIN_IP_WHITELIST?.split(',') || ['127.0.0.1', '::1'];
        this.activeAdmins = new Map();
    }

    /**
     * Verify admin IP is whitelisted
     */
    verifyAdminIP(clientIP) {
        // TEMPORARY BYPASS: Allow all IPs for testing
        return true; // <-- REMOVE THIS LINE TO RE-ENABLE WHITELIST
        // const allowedIPs = this.adminIPs;
        // return allowedIPs.includes(clientIP) || allowedIPs.includes('*');
    }

    /**
     * Verify admin JWT token
     */
    verifyAdminToken(token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_jwt_secret_for_development_only');
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
     * Get current exposure for specific Wingo duration
     */
    async getWingoExposure(duration, periodId = null) {
        try {
            // Get current period if not provided
            if (!periodId) {
                const currentPeriod = await this.getCurrentPeriod(duration);
                periodId = currentPeriod;
            }

            const exposureKey = `exposure:wingo:${duration}:default:${periodId}`;
            const exposureData = await unifiedRedisHelper.hgetall(exposureKey);

            // Convert cents to rupees and format
            const formattedExposure = {};
            let totalExposure = 0;
            let zeroExposureNumbers = [];
            let highestExposure = 0;
            let optimalNumber = 0;
            let minExposure = Infinity;

            for (let num = 0; num <= 9; num++) {
                const exposureCents = parseInt(exposureData[`number:${num}`] || 0);
                const exposureRupees = exposureCents / 100;
                formattedExposure[`number:${num}`] = exposureRupees.toFixed(2);
                
                totalExposure += exposureRupees;
                
                if (exposureRupees === 0) {
                    zeroExposureNumbers.push(num);
                }
                
                if (exposureRupees > highestExposure) {
                    highestExposure = exposureRupees;
                }
                
                if (exposureRupees < minExposure) {
                    minExposure = exposureRupees;
                    optimalNumber = num;
                }
            }

            // Get period info
            const periodInfo = await this.getPeriodInfo(duration, periodId);
            
            // Get bet distribution
            const betDistribution = await this.getBetDistribution(duration, periodId);

            return {
                success: true,
                room: `wingo-${duration}s`,
                duration: duration,
                periodId: periodId,
                timestamp: new Date().toISOString(),
                exposures: formattedExposure,
                analysis: {
                    totalExposure: totalExposure.toFixed(2),
                    optimalNumber: optimalNumber,
                    zeroExposureNumbers: zeroExposureNumbers,
                    highestExposure: highestExposure.toFixed(2),
                    minExposure: minExposure.toFixed(2),
                    betDistribution: betDistribution
                },
                periodInfo: periodInfo
            };

        } catch (error) {
            console.error('❌ [ADMIN_EXPOSURE] Error getting Wingo exposure:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get exposure for all Wingo rooms
     */
    async getAllWingoRoomsExposure() {
        try {
            const allRooms = {};

            for (const duration of this.wingoDurations) {
                const roomData = await this.getWingoExposure(duration);
                if (roomData.success) {
                    allRooms[`wingo-${duration}s`] = roomData;
                }
            }

            return {
                success: true,
                rooms: allRooms,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ [ADMIN_EXPOSURE] Error getting all Wingo rooms:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get current period for duration (fetch from Redis scheduler)
     */
    async getCurrentPeriod(duration) {
        try {
            const periodKey = `game_scheduler:wingo:${duration}:current`;
            const period = await unifiedRedisHelper.get(periodKey);
            if (!period) return null;
            return period.periodId;
        } catch (error) {
            console.error('❌ [ADMIN_EXPOSURE] Error getting current period from Redis:', error);
            return null;
        }
    }

    /**
     * Get period information (from scheduler in Redis)
     */
    async getPeriodInfo(duration, periodId) {
        try {
            const periodKey = `game_scheduler:wingo:${duration}:current`;
            const period = await unifiedRedisHelper.get(periodKey);
            if (!period) return null;

            // Use the endTime from Redis to calculate timeRemaining
            const now = Date.now();
            const endTime = new Date(period.endTime).getTime();
            const timeRemaining = Math.max(0, Math.floor((endTime - now) / 1000));

            return {
                startTime: period.startTime,
                endTime: period.endTime,
                timeRemaining: timeRemaining,
                duration: duration
            };
        } catch (error) {
            console.error('❌ [ADMIN_EXPOSURE] Error getting period info from Redis:', error);
            return {
                startTime: new Date().toISOString(),
                endTime: new Date(Date.now() + duration * 1000).toISOString(),
                timeRemaining: duration,
                duration: duration
            };
        }
    }

    /**
     * Get bet distribution for period
     */
    async getBetDistribution(duration, periodId) {
        try {
            const betKey = `bets:wingo:${duration}:default:${periodId}`;
            const betsData = await unifiedRedisHelper.hgetall(betKey);
            
            const distribution = {
                totalBets: 0,
                uniqueUsers: new Set(),
                betTypes: {}
            };

            for (const [betId, betJson] of Object.entries(betsData)) {
                try {
                    const bet = JSON.parse(betJson);
                    distribution.totalBets++;
                    distribution.uniqueUsers.add(bet.userId);
                    
                    const betType = bet.betType || 'unknown';
                    distribution.betTypes[betType] = (distribution.betTypes[betType] || 0) + 1;
                } catch (parseError) {
                    console.error('❌ [ADMIN_EXPOSURE] Error parsing bet:', parseError);
                }
            }

            return {
                totalBets: distribution.totalBets,
                uniqueUsers: distribution.uniqueUsers.size,
                betTypes: distribution.betTypes
            };

        } catch (error) {
            console.error('❌ [ADMIN_EXPOSURE] Error getting bet distribution:', error);
            return {
                totalBets: 0,
                uniqueUsers: 0,
                betTypes: {}
            };
        }
    }

    /**
     * Start real-time exposure monitoring
     */
    startExposureMonitoring(io) {
        console.log('🔐 [ADMIN_EXPOSURE] Starting real-time exposure monitoring...');

        // Create admin namespace
        const adminNamespace = io.of('/admin');

        // Admin authentication middleware
        adminNamespace.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token;
                const clientIP = socket.handshake.address;

                // Check IP whitelist
                if (!this.verifyAdminIP(clientIP)) {
                    console.log(`❌ [ADMIN_EXPOSURE] IP not whitelisted: ${clientIP}`);
                    return next(new Error('IP not whitelisted for admin access'));
                }

                // Verify admin token
                const tokenResult = this.verifyAdminToken(token);
                if (!tokenResult.valid) {
                    console.log(`❌ [ADMIN_EXPOSURE] Invalid admin token from IP: ${clientIP}`);
                    return next(new Error('Invalid admin token'));
                }

                socket.admin = tokenResult.admin;
                this.activeAdmins.set(socket.id, {
                    admin: tokenResult.admin,
                    ip: clientIP,
                    connectedAt: new Date()
                });

                console.log(`✅ [ADMIN_EXPOSURE] Admin connected: ${tokenResult.admin.username} from ${clientIP}`);
                next();

            } catch (error) {
                console.error('❌ [ADMIN_EXPOSURE] Admin authentication error:', error);
                next(new Error('Admin authentication failed'));
            }
        });

        // Handle admin connections
        adminNamespace.on('connection', (socket) => {
            console.log(`🔐 [ADMIN_EXPOSURE] Admin connected: ${socket.admin.username}`);

            // Subscribe to Wingo exposure updates
            socket.on('subscribeToWingoExposure', async (data) => {
                try {
                    const { duration } = data;
                    
                    if (!this.wingoDurations.includes(duration)) {
                        socket.emit('error', { message: 'Invalid duration' });
                        return;
                    }

                    const roomName = `admin:exposure:wingo:${duration}`;
                    socket.join(roomName);
                    
                    console.log(`📊 [ADMIN_EXPOSURE] Admin ${socket.admin.username} subscribed to ${roomName}`);

                    // Send initial exposure data
                    const exposureData = await this.getWingoExposure(duration);
                    socket.emit('wingoExposureUpdate', exposureData);

                } catch (error) {
                    console.error('❌ [ADMIN_EXPOSURE] Subscription error:', error);
                    socket.emit('error', { message: 'Subscription failed' });
                }
            });

            // Subscribe to all Wingo rooms
            socket.on('subscribeToAllWingoRooms', async () => {
                try {
                    for (const duration of this.wingoDurations) {
                        const roomName = `admin:exposure:wingo:${duration}`;
                        socket.join(roomName);
                    }

                    console.log(`📊 [ADMIN_EXPOSURE] Admin ${socket.admin.username} subscribed to all Wingo rooms`);

                    // Send initial data for all rooms
                    const allRoomsData = await this.getAllWingoRoomsExposure();
                    socket.emit('allWingoRoomsUpdate', allRoomsData);

                } catch (error) {
                    console.error('❌ [ADMIN_EXPOSURE] All rooms subscription error:', error);
                    socket.emit('error', { message: 'All rooms subscription failed' });
                }
            });

            // Handle disconnection
            socket.on('disconnect', () => {
                this.activeAdmins.delete(socket.id);
                console.log(`🔐 [ADMIN_EXPOSURE] Admin disconnected: ${socket.admin.username}`);
            });
        });

        // Start periodic exposure updates
        this.startPeriodicUpdates(adminNamespace);
    }

    /**
     * Start periodic exposure updates
     */
    startPeriodicUpdates(adminNamespace) {
        // Update every 500ms
        setInterval(async () => {
            try {
                for (const duration of this.wingoDurations) {
                    const exposureData = await this.getWingoExposure(duration);
                    if (exposureData.success) {
                        adminNamespace.to(`admin:exposure:wingo:${duration}`).emit('wingoExposureUpdate', exposureData);
                    }
                }

                // Send all rooms update every 2.5 seconds
                if (Date.now() % 2500 < 500) {
                    const allRoomsData = await this.getAllWingoRoomsExposure();
                    if (allRoomsData.success) {
                        adminNamespace.emit('allWingoRoomsUpdate', allRoomsData);
                    }
                }

            } catch (error) {
                console.error('❌ [ADMIN_EXPOSURE] Periodic update error:', error);
            }
        }, 500);

        console.log('🔄 [ADMIN_EXPOSURE] Periodic exposure updates started (every 500ms)');
    }

    /**
     * Get active admins
     */
    getActiveAdmins() {
        return Array.from(this.activeAdmins.values());
    }

    /**
     * Log admin access
     */
    logAdminAccess(admin, action, details = {}) {
        const logData = {
            timestamp: new Date().toISOString(),
            adminId: admin.id,
            username: admin.username,
            action: action,
            details: details
        };

        console.log('🔐 [ADMIN_ACCESS]', logData);
        // Store in database for audit trail
    }
}

module.exports = new AdminExposureService(); 
module.exports.setRedisHelper = setRedisHelper;
