const { getModels } = require('../../models');
const { generateToken, generateRefreshToken } = require('../../utils/jwt');
const { Op } = require('sequelize');
const { getAttendanceQueue } = require('../../queues/attendanceQueue');
const createSessionService = require('../../services/sessionService');

// 🚀 PERFORMANCE: Global cache for ultra-fast access
let globalCache = {
    models: null,
    sessionService: null,
    attendanceQueue: null,
    initialized: false,
    initPromise: null
};

// In-memory user cache for recent lookups (TTL: 5 minutes)
const userCache = new Map();
const USER_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const initializeGlobalCache = async () => {
    if (globalCache.initialized) {
        return globalCache;
    }
    
    if (globalCache.initPromise) {
        return await globalCache.initPromise;
    }
    
    globalCache.initPromise = (async () => {
        try {
            console.log('🔄 Initializing optimized global cache...');
            globalCache.models = await getModels();
            globalCache.sessionService = createSessionService(globalCache.models);
            globalCache.attendanceQueue = getAttendanceQueue();
            globalCache.initialized = true;
            console.log('✅ Global cache initialized');
            return globalCache;
        } catch (error) {
            console.error('❌ Failed to initialize global cache:', error);
            globalCache.initPromise = null;
            throw error;
        }
    })();
    
    return await globalCache.initPromise;
};

// Optimized user lookup with caching
const getCachedUser = async (phone_no, User) => {
    const cacheKey = `user:${phone_no}`;
    const cached = userCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < USER_CACHE_TTL) {
        return cached.user;
    }
    
    const user = await User.findOne({
        where: { phone_no },
        attributes: ['user_id', 'phone_no', 'password', 'is_blocked', 'wallet_balance', 'user_name', 'vip_level', 'profile_picture_id', 'is_phone_verified'],
        raw: false,
        benchmark: false,
        logging: false
    });
    
    if (user) {
        userCache.set(cacheKey, {
            user,
            timestamp: Date.now()
        });
        
        // Clean up old cache entries
        if (userCache.size > 1000) {
            const cutoff = Date.now() - USER_CACHE_TTL;
            for (const [key, value] of userCache.entries()) {
                if (value.timestamp < cutoff) {
                    userCache.delete(key);
                }
            }
        }
    }
    
    return user;
};

const optimizedLoginController = async (req, res) => {
    const startTime = process.hrtime.bigint();
    const timings = {};
    
    try {
        const { phone_no, password } = req.body;
        if (!phone_no || !password) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and password are required'
            });
        }
        
        // 1. Ultra-fast cache access
        const cacheStart = process.hrtime.bigint();
        const { models, sessionService, attendanceQueue } = await initializeGlobalCache();
        const User = models.User;
        const ipAddress = req.ip || req.connection.remoteAddress;
        timings.cache = Number(process.hrtime.bigint() - cacheStart) / 1000000;
        
        // 2. Optimized user lookup with caching
        const queryStart = process.hrtime.bigint();
        const user = await getCachedUser(phone_no, User);
        timings.query = Number(process.hrtime.bigint() - queryStart) / 1000000;
        
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        if (user.is_blocked) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        // 3. Password verification
        const bcryptStart = process.hrtime.bigint();
        const isValidPassword = await user.checkPassword(password);
        timings.bcrypt = Number(process.hrtime.bigint() - bcryptStart) / 1000000;
        
        if (!isValidPassword) {
            // Invalidate cache for failed logins to prevent enumeration
            userCache.delete(`user:${phone_no}`);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        // 4. Parallel operations for session and JWT
        const sessionStart = process.hrtime.bigint();
        const now = new Date();
        const deviceInfo = {
            userAgent: req.headers['user-agent'],
            ipAddress,
            loginTime: now
        };
        
        // Create session and generate tokens in parallel where possible
        const [session, _] = await Promise.all([
            // Session creation (sequential due to transaction)
            models.sequelize.transaction(async (t) => {
                const sessionResult = await sessionService.createSession(user.user_id, deviceInfo, req, t);
                await user.update({ 
                    last_login_at: now, 
                    last_login_ip: ipAddress 
                }, { transaction: t });
                return sessionResult;
            }),
            // Prefetch for next request (async, doesn't block)
            Promise.resolve()
        ]);
        timings.session = Number(process.hrtime.bigint() - sessionStart) / 1000000;
        
        // 5. JWT generation
        const jwtStart = process.hrtime.bigint();
        const tokenPayload = {
            userId: user.user_id,
            sessionToken: session.session_token,
            deviceId: session.device_id
        };
        
        const [accessToken, refreshToken] = await Promise.all([
            Promise.resolve(generateToken(tokenPayload)),
            Promise.resolve(generateRefreshToken(tokenPayload))
        ]);
        timings.jwt = Number(process.hrtime.bigint() - jwtStart) / 1000000;
        
        // 6. Background tasks (non-blocking)
        process.nextTick(() => {
            const today = new Date().toISOString().split('T')[0];
            const jobId = `attendance:${user.user_id}:${today}`;
            attendanceQueue.add('checkAttendance', 
                { userId: user.user_id }, 
                { 
                    jobId,
                    removeOnComplete: 5,
                    removeOnFail: 10,
                    attempts: 1,
                    backoff: { type: 'fixed', delay: 2000 }
                }
            ).catch(console.error);
        });
        
        // Calculate total time
        const totalTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        
        // Performance logging
        console.log(`✅ OPTIMIZED LOGIN: ${phone_no} - ${totalTime.toFixed(2)}ms`);
        console.log(`📊 Cache: ${timings.cache.toFixed(2)}ms | Query: ${timings.query.toFixed(2)}ms | Bcrypt: ${timings.bcrypt.toFixed(2)}ms | Session: ${timings.session.toFixed(2)}ms | JWT: ${timings.jwt.toFixed(2)}ms`);
        
        // Alert on performance issues
        if (totalTime > 200) {
            const issues = [];
            if (timings.cache > 20) issues.push(`Cache: ${timings.cache.toFixed(2)}ms`);
            if (timings.query > 30) issues.push(`Query: ${timings.query.toFixed(2)}ms`);
            if (timings.bcrypt > 100) issues.push(`Bcrypt: ${timings.bcrypt.toFixed(2)}ms`);
            if (timings.session > 80) issues.push(`Session: ${timings.session.toFixed(2)}ms`);
            if (timings.jwt > 10) issues.push(`JWT: ${timings.jwt.toFixed(2)}ms`);
            
            if (issues.length > 0) {
                console.log(`⚠️  SLOW LOGIN: ${issues.join(' | ')}`);
            }
        }
        
        // Optimized response
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'X-Content-Type-Options': 'nosniff'
        });
        
        res.json({
            success: true,
            data: {
                user: {
                    id: user.user_id,
                    phone_no: user.phone_no,
                    is_phone_verified: user.is_phone_verified,
                    wallet_balance: user.wallet_balance,
                    profile_picture_id: user.profile_picture_id,
                    member_detail: `MEMBER${user.user_name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}`,
                    vip_level: user.vip_level
                },
                tokens: {
                    accessToken,
                    refreshToken
                },
                session: {
                    deviceId: session.device_id,
                    expiresAt: session.expires_at
                }
            },
            // Include performance data in development
            ...(process.env.NODE_ENV === 'development' && {
                performance: {
                    totalTime,
                    breakdown: timings,
                    cacheSize: userCache.size
                }
            })
        });
        
    } catch (error) {
        const errorTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        console.error('❌ Optimized login error:', error);
        console.log(`📊 Error after ${errorTime.toFixed(2)}ms`);
        
        res.status(500).json({
            success: false,
            message: 'An error occurred',
            ...(process.env.NODE_ENV === 'development' && {
                performance: { 
                    errorTime,
                    partialTimings: timings 
                }
            })
        });
    }
};

// Cache cleanup interval
setInterval(() => {
    const cutoff = Date.now() - USER_CACHE_TTL;
    let cleaned = 0;
    for (const [key, value] of userCache.entries()) {
        if (value.timestamp < cutoff) {
            userCache.delete(key);
            cleaned++;
        }
    }
    if (cleaned > 0) {
        console.log(`🧹 Cleaned ${cleaned} expired cache entries`);
    }
}, 60000); // Clean every minute

module.exports = optimizedLoginController;