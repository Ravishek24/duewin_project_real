const { getModels } = require('../../models');
const { generateToken, generateRefreshToken } = require('../../utils/jwt');
const { Op } = require('sequelize');
const { getAttendanceQueue } = require('../../queues/attendanceQueue');
const createSessionService = require('../../services/sessionService');

// 🚀 PERFORMANCE: Enhanced caching with lazy loading
let cachedModels = null;
let cachedSessionService = null;
let cachedAttendanceQueue = null;
let cachePromise = null; // Prevent concurrent cache initialization

const initializeCache = async () => {
    // Prevent multiple concurrent cache initializations
    if (cachePromise) return cachePromise;
    
    if (!cachedModels) {
        cachePromise = (async () => {
            cachedModels = await getModels();
            cachedSessionService = createSessionService(cachedModels);
            cachedAttendanceQueue = getAttendanceQueue();
            return { 
                models: cachedModels, 
                sessionService: cachedSessionService,
                attendanceQueue: cachedAttendanceQueue 
            };
        })();
        return cachePromise;
    }
    
    return { 
        models: cachedModels, 
        sessionService: cachedSessionService,
        attendanceQueue: cachedAttendanceQueue 
    };
};

// 🚀 PERFORMANCE: Pre-compiled validation regex
const PHONE_VALIDATION = /^\d{10,15}$/; // Adjust based on your phone format
const PASSWORD_MIN_LENGTH = 6; // Adjust based on your requirements

const loginController = async (req, res) => {
    const startTime = process.hrtime.bigint();
    
    try {
        const { phone_no, password } = req.body;
        
        // 🚀 PERFORMANCE: Fast input validation with early returns
        if (!phone_no || !password) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and password are required'
            });
        }
        
        // 🚀 PERFORMANCE: Quick format validation
        if (!PHONE_VALIDATION.test(phone_no) || password.length < PASSWORD_MIN_LENGTH) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input format'
            });
        }
        
        // 🚀 PERFORMANCE: Use cached models, sessionService, and queue
        const cacheStart = process.hrtime.bigint();
        const { models, sessionService, attendanceQueue } = await initializeCache();
        const cacheTime = Number(process.hrtime.bigint() - cacheStart) / 1000000;
        
        const User = models.User;
        const ipAddress = req.ip || req.connection.remoteAddress;
        
        // 🚀 PERFORMANCE: Ultra-optimized query with specific index hints
        const queryStart = process.hrtime.bigint();
        const user = await User.findOne({
            where: { phone_no },
            attributes: [
                'user_id', 'phone_no', 'password', 'is_blocked', 
                'wallet_balance', 'user_name', 'vip_level', 
                'profile_picture_id', 'is_phone_verified'
            ],
            raw: false, // Keep instance for methods
            benchmark: false,
            logging: false,
            // Force specific index usage (adjust index name based on your DB)
            // indexHints: [{ type: 'USE', values: ['idx_phone_no'] }], // Uncomment if using MySQL
            limit: 1 // Explicit limit for safety
        });
        const queryTime = Number(process.hrtime.bigint() - queryStart) / 1000000;
        
        // 🚀 PERFORMANCE: Combined validation checks
        if (!user || user.is_blocked) {
            const message = !user ? 'Invalid credentials' : 'Access denied';
            const statusCode = !user ? 401 : 403;
            return res.status(statusCode).json({
                success: false,
                message
            });
        }
        
        // 🚀 PERFORMANCE: Password verification
        const bcryptStart = process.hrtime.bigint();
        const isValidPassword = await user.checkPassword(password);
        const bcryptTime = Number(process.hrtime.bigint() - bcryptStart) / 1000000;
        
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        // 🚀 PERFORMANCE: Pre-calculate common values
        const now = new Date();
        const deviceInfo = {
            userAgent: req.headers['user-agent'],
            ipAddress,
            loginTime: now
        };
        
        // 🚀 PERFORMANCE: Optimized session creation with reduced transaction scope
        const sessionStart = process.hrtime.bigint();
        const session = await models.sequelize.transaction(async (t) => {
            // Parallel execution of session creation and user update
            const [sessionResult] = await Promise.all([
                sessionService.createSession(user.user_id, deviceInfo, req, t),
                user.update({ 
                    last_login_at: now, 
                    last_login_ip: ipAddress 
                }, { transaction: t, fields: ['last_login_at', 'last_login_ip'] }) // Specify fields for faster update
            ]);
            
            return sessionResult;
        });
        const sessionTime = Number(process.hrtime.bigint() - sessionStart) / 1000000;
        
        // 🚀 PERFORMANCE: Parallel token generation
        const jwtStart = process.hrtime.bigint();
        const tokenPayload = {
            userId: user.user_id,
            sessionToken: session.session_token,
            deviceId: session.device_id
        };
        
        // Generate both tokens in parallel
        const [accessToken, refreshToken] = await Promise.all([
            Promise.resolve(generateToken(tokenPayload)),
            Promise.resolve(generateRefreshToken(tokenPayload))
        ]);
        const jwtTime = Number(process.hrtime.bigint() - jwtStart) / 1000000;
        
        // 🚀 PERFORMANCE: Optimized attendance queue (fire-and-forget)
        setImmediate(() => {
            try {
                const today = new Date().toISOString().split('T')[0];
                const jobId = `attendance:${user.user_id}:${today}`;
                attendanceQueue.add('checkAttendance', 
                    { userId: user.user_id }, 
                    { 
                        jobId,
                                // BullMQ v5: use keepJobs instead of removeOnComplete/removeOnFail
        keepJobs: {
          completed: 5,
          failed: 3
        },
                        attempts: 1,
                        backoff: { type: 'fixed', delay: 1000 }, // Reduced from 2000ms
                        priority: 10 // Lower priority (higher number = lower priority in BullMQ)
                    }
                );
            } catch (err) {
                console.error('Attendance queue error:', err.message);
            }
        });
        
        // 🚀 PERFORMANCE: Pre-build response object
        const responseData = {
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
        };
        
        // 🚀 PERFORMANCE: Calculate timing metrics
        const totalTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        
        // 🚀 PERFORMANCE: Conditional logging (only log if slow or in development)
        if (totalTime > 200 || process.env.NODE_ENV === 'development') {
            console.log(`\n✅ Login: ${phone_no} - ${totalTime.toFixed(2)}ms`);
            console.log(`📈 Cache: ${cacheTime.toFixed(1)}ms | Query: ${queryTime.toFixed(1)}ms | Bcrypt: ${bcryptTime.toFixed(1)}ms | Session: ${sessionTime.toFixed(1)}ms | JWT: ${jwtTime.toFixed(1)}ms`);
            
            // Performance warnings
            const warnings = [];
            if (cacheTime > 30) warnings.push(`Cache: ${cacheTime.toFixed(1)}ms`);
            if (queryTime > 40) warnings.push(`Query: ${queryTime.toFixed(1)}ms`);
            if (bcryptTime > 120) warnings.push(`Bcrypt: ${bcryptTime.toFixed(1)}ms`);
            if (sessionTime > 80) warnings.push(`Session: ${sessionTime.toFixed(1)}ms`);
            if (jwtTime > 15) warnings.push(`JWT: ${jwtTime.toFixed(1)}ms`);
            
            if (warnings.length > 0) {
                console.log(`⚠️  Slow: ${warnings.join(', ')}`);
            }
        }
        
        // 🚀 PERFORMANCE: Minimal security headers (others handled by middleware)
        res.set({
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'X-Content-Type-Options': 'nosniff'
        });
        
        res.json(responseData);
        
    } catch (error) {
        console.error('Login error:', {
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            phone_no: req.body?.phone_no
        });
        
        res.status(500).json({
            success: false,
            message: 'An error occurred during login'
        });
    }
};

// 🚀 PERFORMANCE: Optional - Add cache warming for high-traffic scenarios
const warmCache = async () => {
    try {
        await initializeCache();
        console.log('📦 Login controller cache warmed successfully');
    } catch (error) {
        console.error('❌ Cache warming failed:', error.message);
    }
};

// Export the main function as default, with additional exports
module.exports = loginController;
module.exports.loginController = loginController;
module.exports.warmCache = warmCache;