const { getModels } = require('../../models');
const { generateToken, generateRefreshToken } = require('../../utils/jwt');
const { Op } = require('sequelize');
const { getAttendanceQueue } = require('../../queues/attendanceQueue');
const createSessionService = require('../../services/sessionService');

// 🚀 PERFORMANCE: Cache models, sessionService, and queue to avoid repeated initialization
let cachedModels = null;
let cachedSessionService = null;
let cachedAttendanceQueue = null;

const initializeCache = async () => {
    if (!cachedModels) {
        cachedModels = await getModels();
        cachedSessionService = createSessionService(cachedModels);
        // Cache attendance queue to avoid repeated initialization
        cachedAttendanceQueue = getAttendanceQueue();
    }
    return { 
        models: cachedModels, 
        sessionService: cachedSessionService,
        attendanceQueue: cachedAttendanceQueue 
    };
};

const loginControllerWithTiming = async (req, res) => {
    const timings = {};
    const startTime = process.hrtime.bigint();
    
    try {
        const { phone_no, password } = req.body;
        if (!phone_no || !password) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and password are required'
            });
        }
        
        // 1. Model initialization timing
        const modelStart = process.hrtime.bigint();
        const { models, sessionService, attendanceQueue } = await initializeCache();
        const User = models.User;
        const ipAddress = req.ip || req.connection.remoteAddress;
        const modelEnd = process.hrtime.bigint();
        timings.modelInit = Number(modelEnd - modelStart) / 1000000;
        
        // 2. User query timing
        const queryStart = process.hrtime.bigint();
        const user = await User.findOne({
            where: { phone_no },
            attributes: ['user_id', 'phone_no', 'password', 'is_blocked', 'wallet_balance', 'user_name', 'vip_level', 'profile_picture_id', 'is_phone_verified'],
            raw: false,
            benchmark: false,
            logging: false
        });
        const queryEnd = process.hrtime.bigint();
        timings.userQuery = Number(queryEnd - queryStart) / 1000000;
        
        if (!user) {
            const totalTime = Number(process.hrtime.bigint() - startTime) / 1000000;
            console.log(`❌ Login failed (user not found) - Total time: ${totalTime.toFixed(2)}ms`);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        if (user.is_blocked) {
            const totalTime = Number(process.hrtime.bigint() - startTime) / 1000000;
            console.log(`❌ Login failed (user blocked) - Total time: ${totalTime.toFixed(2)}ms`);
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        // 3. Password verification timing
        const bcryptStart = process.hrtime.bigint();
        const isValidPassword = await user.checkPassword(password);
        const bcryptEnd = process.hrtime.bigint();
        timings.passwordCheck = Number(bcryptEnd - bcryptStart) / 1000000;
        
        if (!isValidPassword) {
            const totalTime = Number(process.hrtime.bigint() - startTime) / 1000000;
            console.log(`❌ Login failed (invalid password) - Total time: ${totalTime.toFixed(2)}ms`);
            console.log(`📊 Performance breakdown: Models: ${timings.modelInit.toFixed(2)}ms, Query: ${timings.userQuery.toFixed(2)}ms, Password: ${timings.passwordCheck.toFixed(2)}ms`);
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        // 4. Session operations timing
        const sessionStart = process.hrtime.bigint();
        const now = new Date();
        const deviceInfo = {
            userAgent: req.headers['user-agent'],
            ipAddress,
            loginTime: now
        };
        
        // Use transaction for atomic operations
        const session = await models.sequelize.transaction(async (t) => {
            // Create session (this will invalidate previous sessions) with transaction
            const sessionResult = await sessionService.createSession(user.user_id, deviceInfo, req, t);
            
            // Update last login info in the same transaction
            await user.update({ 
                last_login_at: now, 
                last_login_ip: ipAddress 
            }, { transaction: t });
            
            return sessionResult;
        });
        const sessionEnd = process.hrtime.bigint();
        timings.sessionOps = Number(sessionEnd - sessionStart) / 1000000;
        
        // 5. JWT generation timing
        const jwtStart = process.hrtime.bigint();
        const accessToken = generateToken({
            userId: user.user_id,
            sessionToken: session.session_token,
            deviceId: session.device_id
        });
        const refreshToken = generateRefreshToken({
            userId: user.user_id,
            sessionToken: session.session_token,
            deviceId: session.device_id
        });
        const jwtEnd = process.hrtime.bigint();
        timings.jwtGeneration = Number(jwtEnd - jwtStart) / 1000000;
        
        // 6. Queue operations timing (async, doesn't affect response time)
        const queueStart = process.hrtime.bigint();
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
            
            const queueEnd = process.hrtime.bigint();
            timings.queueOps = Number(queueEnd - queueStart) / 1000000;
        });
        
        // Calculate total time
        const totalEnd = process.hrtime.bigint();
        timings.total = Number(totalEnd - startTime) / 1000000;
        
        // Log performance metrics
        console.log(`\n✅ Login successful for ${phone_no}`);
        console.log(`📈 PERFORMANCE BREAKDOWN:`);
        console.log(`├── Model Init: ${timings.modelInit.toFixed(2)}ms (${(timings.modelInit/timings.total*100).toFixed(1)}%)`);
        console.log(`├── User Query: ${timings.userQuery.toFixed(2)}ms (${(timings.userQuery/timings.total*100).toFixed(1)}%)`);
        console.log(`├── Password Check: ${timings.passwordCheck.toFixed(2)}ms (${(timings.passwordCheck/timings.total*100).toFixed(1)}%)`);
        console.log(`├── Session Ops: ${timings.sessionOps.toFixed(2)}ms (${(timings.sessionOps/timings.total*100).toFixed(1)}%)`);
        console.log(`├── JWT Generation: ${timings.jwtGeneration.toFixed(2)}ms (${(timings.jwtGeneration/timings.total*100).toFixed(1)}%)`);
        console.log(`└── TOTAL: ${timings.total.toFixed(2)}ms`);
        
        // Identify potential issues
        const issues = [];
        if (timings.modelInit > 50) issues.push(`Model Init slow (${timings.modelInit.toFixed(2)}ms)`);
        if (timings.userQuery > 50) issues.push(`DB Query slow (${timings.userQuery.toFixed(2)}ms)`);
        if (timings.passwordCheck > 150) issues.push(`Password check slow (${timings.passwordCheck.toFixed(2)}ms)`);
        if (timings.sessionOps > 100) issues.push(`Session ops slow (${timings.sessionOps.toFixed(2)}ms)`);
        if (timings.jwtGeneration > 20) issues.push(`JWT gen slow (${timings.jwtGeneration.toFixed(2)}ms)`);
        
        if (issues.length > 0) {
            console.log(`⚠️  PERFORMANCE ISSUES: ${issues.join(', ')}`);
        }
        
        // Set optimized security headers
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
                    totalTime: timings.total,
                    breakdown: timings,
                    issues: issues.length > 0 ? issues : null
                }
            })
        });
        
    } catch (error) {
        const errorEnd = process.hrtime.bigint();
        const totalTime = Number(errorEnd - startTime) / 1000000;
        
        console.error('❌ Login error:', error);
        console.log(`📊 Error occurred after ${totalTime.toFixed(2)}ms`);
        
        res.status(500).json({
            success: false,
            message: 'An error occurred',
            ...(process.env.NODE_ENV === 'development' && { 
                performance: { 
                    totalTime,
                    partialTimings: timings 
                }
            })
        });
    }
};

module.exports = loginControllerWithTiming;