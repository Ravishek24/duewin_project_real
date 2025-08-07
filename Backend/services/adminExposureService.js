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
     * Get exposure for all Wingo rooms (Enhanced with user details)
     */
    async getAllWingoRoomsExposure() {
        try {
            const allRooms = {};

            for (const duration of this.wingoDurations) {
                const roomData = await this.getEnhancedWingoExposure(duration);
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
     * Get user details for a specific number
     */
    async getUserDetailsForNumber(duration, periodId, number) {
        try {
            const exposureKey = `exposure:wingo:${duration}:default:${periodId}`;
            const usersJson = await unifiedRedisHelper.hget(exposureKey, `users:number:${number}`);
            const statsJson = await unifiedRedisHelper.hget(exposureKey, `stats:number:${number}`);
            
            const users = usersJson ? JSON.parse(usersJson) : [];
            const statistics = statsJson ? JSON.parse(statsJson) : {
                totalUsers: 0,
                totalBetAmount: 0,
                uniqueUsers: 0,
                betTypes: {}
            };
            
            return {
                success: true,
                number: number,
                duration: duration,
                users: users,
                statistics: statistics
            };
        } catch (error) {
            console.error('❌ [ADMIN_EXPOSURE] Error getting user details:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all numbers with user counts
     */
    async getAllNumbersUserCounts(duration, periodId) {
        try {
            const exposureKey = `exposure:wingo:${duration}:default:${periodId}`;
            const periodStatsJson = await unifiedRedisHelper.hget(exposureKey, 'period:stats');
            
            if (!periodStatsJson) {
                return { success: true, numberDistribution: {} };
            }
            
            const periodStats = JSON.parse(periodStatsJson);
            
            return {
                success: true,
                numberDistribution: periodStats.numberDistribution || {},
                totalUsers: periodStats.totalUsers || 0,
                totalBetAmount: periodStats.totalBetAmount || 0,
                uniqueUsers: periodStats.uniqueUsers || 0
            };
        } catch (error) {
            console.error('❌ [ADMIN_EXPOSURE] Error getting number user counts:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get enhanced Wingo exposure with user details
     */
    async getEnhancedWingoExposure(duration, periodId = null) {
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

            // Get user counts for all numbers
            const userCounts = await this.getAllNumbersUserCounts(duration, periodId);

            // Format numbers data with user counts
            const numbers = {};
            for (let num = 0; num <= 9; num++) {
                const exposureCents = parseInt(exposureData[`number:${num}`] || 0);
                const exposureRupees = exposureCents / 100;
                const userCount = userCounts.numberDistribution?.[num] || 0;
                const totalBetAmount = userCounts.numberDistribution?.[`totalBetAmount:${num}`] || 0;
                
                numbers[num] = {
                    amount: exposureCents, // Keep in cents for consistency
                    users: userCount,
                    totalBetAmount: totalBetAmount
                };
            }

            // Get user details for each number
            const userDetails = {};
            for (let num = 0; num <= 9; num++) {
                try {
                    const usersJson = await unifiedRedisHelper.hget(exposureKey, `users:number:${num}`);
                    if (usersJson && typeof usersJson === 'string') {
                        userDetails[num] = JSON.parse(usersJson);
                    } else if (Array.isArray(usersJson)) {
                        userDetails[num] = usersJson;
                    } else {
                        userDetails[num] = [];
                    }
                } catch (parseError) {
                    console.error(`❌ [ADMIN_EXPOSURE] Error parsing user details for number ${num}:`, parseError);
                    userDetails[num] = [];
                }
            }

            // Get statistics for each number
            const statistics = {};
            for (let num = 0; num <= 9; num++) {
                try {
                    const statsJson = await unifiedRedisHelper.hget(exposureKey, `stats:number:${num}`);
                    if (statsJson && typeof statsJson === 'string') {
                        statistics[`number:${num}`] = JSON.parse(statsJson);
                    } else if (statsJson && typeof statsJson === 'object') {
                        statistics[`number:${num}`] = statsJson;
                    } else {
                        statistics[`number:${num}`] = {
                            totalUsers: 0,
                            totalBetAmount: 0,
                            uniqueUsers: 0,
                            betTypes: {}
                        };
                    }
                } catch (parseError) {
                    console.error(`❌ [ADMIN_EXPOSURE] Error parsing statistics for number ${num}:`, parseError);
                    statistics[`number:${num}`] = {
                        totalUsers: 0,
                        totalBetAmount: 0,
                        uniqueUsers: 0,
                        betTypes: {}
                    };
                }
            }

            // Get period summary
            let periodStats;
            try {
                const periodStatsJson = await unifiedRedisHelper.hget(exposureKey, 'period:stats');
                if (periodStatsJson && typeof periodStatsJson === 'string') {
                    periodStats = JSON.parse(periodStatsJson);
                } else if (periodStatsJson && typeof periodStatsJson === 'object') {
                    periodStats = periodStatsJson;
                } else {
                    periodStats = {
                        totalUsers: 0,
                        totalBetAmount: 0,
                        uniqueUsers: 0,
                        totalBets: 0
                    };
                }
            } catch (parseError) {
                console.error('❌ [ADMIN_EXPOSURE] Error parsing period statistics:', parseError);
                periodStats = {
                    totalUsers: 0,
                    totalBetAmount: 0,
                    uniqueUsers: 0,
                    totalBets: 0
                };
            }

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
                periodInfo: periodInfo,
                // Enhanced data structure
                numbers: numbers,
                userDetails: userDetails,
                statistics: statistics,
                periodSummary: periodStats
            };

        } catch (error) {
            console.error('❌ [ADMIN_EXPOSURE] Error getting enhanced Wingo exposure:', error);
            return {
                success: false,
                error: error.message
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

            // Subscribe to Wingo exposure updates (Enhanced with user details)
            socket.on('subscribeToWingoExposure', async (data) => {
                try {
                    const { duration } = data;
                    
                    if (!this.wingoDurations.includes(duration)) {
                        socket.emit('error', { message: 'Invalid duration' });
                        return;
                    }

                    const roomName = `admin:exposure:wingo:${duration}`;
                    socket.join(roomName);
                    
                    console.log(`📊 [ADMIN_EXPOSURE] Admin ${socket.admin.username} subscribed to enhanced ${roomName}`);

                    // Send initial enhanced exposure data
                    const enhancedData = await this.getEnhancedWingoExposure(duration);
                    socket.emit('wingoExposureUpdate', enhancedData);

                } catch (error) {
                    console.error('❌ [ADMIN_EXPOSURE] Enhanced subscription error:', error);
                    socket.emit('error', { message: 'Enhanced subscription failed' });
                }
            });

            // Subscribe to enhanced Wingo exposure with user details
            socket.on('subscribeToEnhancedWingoExposure', async (data) => {
                try {
                    const { duration } = data;
                    
                    if (!this.wingoDurations.includes(duration)) {
                        socket.emit('error', { message: 'Invalid duration' });
                        return;
                    }

                    const roomName = `admin:enhanced:exposure:wingo:${duration}`;
                    socket.join(roomName);
                    
                    console.log(`📊 [ADMIN_EXPOSURE] Admin ${socket.admin.username} subscribed to enhanced ${roomName}`);

                    // Send initial enhanced exposure data
                    const enhancedData = await this.getEnhancedWingoExposure(duration);
                    socket.emit('enhancedWingoExposureUpdate', enhancedData);

                } catch (error) {
                    console.error('❌ [ADMIN_EXPOSURE] Enhanced subscription error:', error);
                    socket.emit('error', { message: 'Enhanced subscription failed' });
                }
            });

            // Get user details for specific number
            socket.on('getUserDetailsForNumber', async (data) => {
                try {
                    const { duration, number } = data;
                    
                    if (!this.wingoDurations.includes(duration)) {
                        socket.emit('error', { message: 'Invalid duration' });
                        return;
                    }

                    if (number < 0 || number > 9) {
                        socket.emit('error', { message: 'Invalid number (must be 0-9)' });
                        return;
                    }

                    // Get current period if not provided
                    const periodId = await this.getCurrentPeriod(duration);
                    const userDetails = await this.getUserDetailsForNumber(duration, periodId, number);
                    socket.emit('userDetailsForNumber', userDetails);

                } catch (error) {
                    console.error('❌ [ADMIN_EXPOSURE] Error getting user details:', error);
                    socket.emit('error', { message: 'Failed to get user details' });
                }
            });

            // Get all numbers user counts
            socket.on('getAllNumbersUserCounts', async (data) => {
                try {
                    const { duration, periodId } = data;
                    
                    if (!this.wingoDurations.includes(duration)) {
                        socket.emit('error', { message: 'Invalid duration' });
                        return;
                    }

                    const userCounts = await this.getAllNumbersUserCounts(duration, periodId);
                    socket.emit('allNumbersUserCounts', userCounts);

                } catch (error) {
                    console.error('❌ [ADMIN_EXPOSURE] Error getting user counts:', error);
                    socket.emit('error', { message: 'Failed to get user counts' });
                }
            });

            // Subscribe to specific Wingo room only
            socket.on('subscribeToWingoRoom', async (data) => {
                try {
                    const { duration } = data;
                    
                    if (!this.wingoDurations.includes(duration)) {
                        socket.emit('error', { message: 'Invalid duration' });
                        return;
                    }

                    const roomName = `admin:exposure:wingo:${duration}`;
                    socket.join(roomName);
                    
                    console.log(`📊 [ADMIN_EXPOSURE] Admin ${socket.admin.username} subscribed to room: ${roomName}`);

                    // Send initial data for this specific room only
                    const roomData = await this.getEnhancedWingoExposure(duration);
                    socket.emit('wingoExposureUpdate', roomData);

                } catch (error) {
                    console.error('❌ [ADMIN_EXPOSURE] Room subscription error:', error);
                    socket.emit('error', { message: 'Room subscription failed' });
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
                    // Enhanced exposure updates with user details for specific room only
                    const enhancedData = await this.getEnhancedWingoExposure(duration);
                    if (enhancedData.success) {
                        // Send to specific room only
                        adminNamespace.to(`admin:exposure:wingo:${duration}`).emit('wingoExposureUpdate', enhancedData);
                    }
                }

            } catch (error) {
                console.error('❌ [ADMIN_EXPOSURE] Periodic update error:', error);
            }
        }, 500);

        console.log('🔄 [ADMIN_EXPOSURE] Periodic exposure updates started (every 500ms) - Room specific only');
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
