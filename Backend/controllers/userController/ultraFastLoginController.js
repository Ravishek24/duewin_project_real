const { generateToken, generateRefreshToken } = require('../../utils/jwt');
const { Op } = require('sequelize');

// 🚀 ULTRA-FAST: Pre-initialized models at server startup
let globalModels = null;
let globalSessionService = null;
let globalAttendanceQueue = null;
let isGloballyInitialized = false;

// Initialize once at server startup - NOT per request
const initializeGlobal = async () => {
    if (isGloballyInitialized) {
        return {
            models: globalModels,
            sessionService: globalSessionService,
            attendanceQueue: globalAttendanceQueue
        };
    }
    
    console.log('🚀 ULTRA-FAST: Initializing global cache at startup...');
    const start = process.hrtime.bigint();
    
    try {
        // Direct imports to avoid the slow getModels() function
        const { getModelsSync } = require('../../models');
        const createSessionService = require('../../services/sessionService');
        const { getAttendanceQueue } = require('../../queues/attendanceQueue');
        
        // Try to get models synchronously first (if already initialized by server)
        try {
            globalModels = getModelsSync();
        } catch (e) {
            // Fallback to async initialization only if needed
            const { getModels } = require('../../models');
            globalModels = await getModels();
        }
        
        globalSessionService = createSessionService(globalModels);
        globalAttendanceQueue = getAttendanceQueue();
        isGloballyInitialized = true;
        
        const initTime = Number(process.hrtime.bigint() - start) / 1000000;
        console.log(`✅ ULTRA-FAST: Global cache initialized in ${initTime.toFixed(2)}ms`);
        
        return {
            models: globalModels,
            sessionService: globalSessionService,
            attendanceQueue: globalAttendanceQueue
        };
    } catch (error) {
        console.error('❌ ULTRA-FAST: Global initialization failed:', error);
        throw error;
    }
};

// Ultra-fast login with minimal overhead
const ultraFastLoginController = async (req, res) => {
    const startTime = process.hrtime.bigint();
    
    try {
        const { phone_no, password } = req.body;
        if (!phone_no || !password) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and password are required'
            });
        }
        
        // 🚀 ULTRA-FAST: Use pre-initialized global cache (should be ~1-2ms)
        const cacheStart = process.hrtime.bigint();
        const { models, sessionService, attendanceQueue } = await initializeGlobal();
        const User = models.User;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const cacheTime = Number(process.hrtime.bigint() - cacheStart) / 1000000;
        
        // 🚀 ULTRA-FAST: Direct model query without unnecessary attributes
        const queryStart = process.hrtime.bigint();
        const user = await User.findOne({
            where: { phone_no },
            attributes: ['user_id', 'phone_no', 'password', 'is_blocked', 'wallet_balance', 'user_name', 'vip_level', 'profile_picture_id', 'is_phone_verified'],
            raw: false,
            logging: false
        });
        const queryTime = Number(process.hrtime.bigint() - queryStart) / 1000000;
        
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
        
        // 🚀 Password verification
        const bcryptStart = process.hrtime.bigint();
        const isValidPassword = await user.checkPassword(password);
        const bcryptTime = Number(process.hrtime.bigint() - bcryptStart) / 1000000;
        
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        // 🚀 ULTRA-FAST: Minimal session operations
        const sessionStart = process.hrtime.bigint();
        const now = new Date();
        const deviceInfo = {
            userAgent: req.headers['user-agent'],
            ipAddress,
            loginTime: now
        };
        
        // Streamlined session creation
        const session = await models.sequelize.transaction(async (t) => {
            const sessionResult = await sessionService.createSession(user.user_id, deviceInfo, req, t);
            await user.update({ 
                last_login_at: now, 
                last_login_ip: ipAddress 
            }, { transaction: t });
            return sessionResult;
        });
        const sessionTime = Number(process.hrtime.bigint() - sessionStart) / 1000000;
        
        // 🚀 ULTRA-FAST: Parallel JWT generation
        const jwtStart = process.hrtime.bigint();
        const tokenPayload = {
            userId: user.user_id,
            sessionToken: session.session_token,
            deviceId: session.device_id
        };
        
        const [accessToken, refreshToken] = await Promise.all([
            generateToken(tokenPayload),
            generateRefreshToken(tokenPayload)
        ]);
        const jwtTime = Number(process.hrtime.bigint() - jwtStart) / 1000000;
        
        // 🚀 Background attendance (non-blocking)
        setImmediate(() => {
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
        
        // Performance metrics
        const totalTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        
        // Optimized logging for fast response
        console.log(`🚀 ULTRA-FAST LOGIN: ${phone_no} - ${totalTime.toFixed(2)}ms [Cache: ${cacheTime.toFixed(2)}ms | Query: ${queryTime.toFixed(2)}ms | Bcrypt: ${bcryptTime.toFixed(2)}ms | Session: ${sessionTime.toFixed(2)}ms | JWT: ${jwtTime.toFixed(2)}ms]`);
        
        // Alert only on real issues
        if (cacheTime > 10) console.warn(`⚠️ Cache slow: ${cacheTime.toFixed(2)}ms`);
        if (queryTime > 30) console.warn(`⚠️ Query slow: ${queryTime.toFixed(2)}ms`);
        if (bcryptTime > 150) console.warn(`⚠️ Bcrypt slow: ${bcryptTime.toFixed(2)}ms`);
        if (sessionTime > 100) console.warn(`⚠️ Session slow: ${sessionTime.toFixed(2)}ms`);
        
        // Minimal response headers
        res.set('Cache-Control', 'no-store');
        
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
            }
        });
        
    } catch (error) {
        const errorTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        console.error(`❌ ULTRA-FAST login error after ${errorTime.toFixed(2)}ms:`, error.message);
        
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
};

module.exports = ultraFastLoginController;