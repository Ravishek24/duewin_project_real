// Enhanced login performance profiler to identify specific bottlenecks
const { performance } = require('perf_hooks');

class LoginPerformanceProfiler {
    constructor() {
        this.timings = {};
        this.startTime = null;
    }

    start(label = 'total') {
        this.startTime = performance.now();
        this.timings[label] = { start: this.startTime };
        return this;
    }

    mark(label) {
        const now = performance.now();
        if (this.timings[label]) {
            this.timings[label].end = now;
            this.timings[label].duration = now - this.timings[label].start;
        } else {
            this.timings[label] = { start: now };
        }
        return this;
    }

    end(label = 'total') {
        const now = performance.now();
        if (this.timings[label]) {
            this.timings[label].end = now;
            this.timings[label].duration = now - this.timings[label].start;
        }
        return this;
    }

    getReport() {
        const report = {};
        for (const [label, timing] of Object.entries(this.timings)) {
            if (timing.duration !== undefined) {
                report[label] = `${timing.duration.toFixed(2)}ms`;
            }
        }
        return report;
    }

    logReport(context = 'Performance') {
        console.log(`🔍 ${context} Report:`);
        const report = this.getReport();
        for (const [label, duration] of Object.entries(report)) {
            console.log(`  ${label}: ${duration}`);
        }
        const total = this.timings.total?.duration;
        if (total) {
            console.log(`  🎯 Total: ${total.toFixed(2)}ms`);
            if (total > 300) {
                console.log(`  🐌 SLOW: Target is <200ms`);
            } else if (total < 200) {
                console.log(`  ⚡ FAST: Within target!`);
            }
        }
    }
}

// Enhanced login controller with detailed profiling
const enhancedLoginWithProfiling = async (req, res) => {
    const profiler = new LoginPerformanceProfiler().start();

    try {
        // Import dependencies
        profiler.mark('imports');
        const { getModels } = require('./models');
        const { generateToken, generateRefreshToken } = require('./utils/jwt');
        const { getAttendanceQueue } = require('./queues/attendanceQueue');
        const createSessionService = require('./services/sessionService');
        profiler.end('imports');

        // Validation
        profiler.mark('validation');
        const { phone_no, password } = req.body;
        if (!phone_no || !password) {
            profiler.end('validation').logReport('Login Failed - Validation');
            return res.status(400).json({
                success: false,
                message: 'Phone number and password are required'
            });
        }
        profiler.end('validation');

        // Model initialization (potentially cached)
        profiler.mark('model_init');
        let cachedModels = null;
        let cachedSessionService = null;

        const initializeCache = async () => {
            if (!cachedModels) {
                const modelStart = performance.now();
                cachedModels = await getModels();
                cachedSessionService = createSessionService(cachedModels);
                console.log(`📊 Model cache initialization: ${(performance.now() - modelStart).toFixed(2)}ms`);
            }
            return { models: cachedModels, sessionService: cachedSessionService };
        };

        const { models, sessionService } = await initializeCache();
        const User = models.User;
        profiler.end('model_init');

        // Database query - User lookup
        profiler.mark('user_query');
        const ipAddress = req.ip || req.connection.remoteAddress;
        const user = await User.findOne({
            where: { phone_no },
            attributes: ['user_id', 'phone_no', 'password', 'is_blocked', 'wallet_balance', 'user_name', 'vip_level', 'profile_picture_id', 'is_phone_verified']
        });
        profiler.end('user_query');

        if (!user) {
            profiler.end().logReport('Login Failed - User Not Found');
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        if (user.is_blocked) {
            profiler.end().logReport('Login Failed - User Blocked');
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        // Password verification (bcrypt)
        profiler.mark('password_check');
        const isValidPassword = await user.checkPassword(password);
        profiler.end('password_check');

        if (!isValidPassword) {
            profiler.end().logReport('Login Failed - Invalid Password');
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Session management (database transaction)
        profiler.mark('session_management');
        const now = new Date();
        const deviceInfo = {
            userAgent: req.headers['user-agent'],
            ipAddress,
            loginTime: now
        };

        const session = await models.sequelize.transaction(async (t) => {
            const sessionResult = await sessionService.createSession(user.user_id, deviceInfo, req, t);
            await user.update({ 
                last_login_at: now, 
                last_login_ip: ipAddress 
            }, { transaction: t });
            return sessionResult;
        });
        profiler.end('session_management');

        // Token generation
        profiler.mark('token_generation');
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
        profiler.end('token_generation');

        // Queue operations (async)
        profiler.mark('queue_operations');
        process.nextTick(() => {
            const today = new Date().toISOString().split('T')[0];
            const jobId = `attendance:${user.user_id}:${today}`;
            getAttendanceQueue().add('checkAttendance', 
                { userId: user.user_id }, 
                { 
                    jobId,
                    removeOnComplete: 5,
                    removeOnFail: 10,
                    attempts: 2,
                    backoff: { type: 'fixed', delay: 5000 }
                }
            ).catch(console.error);
        });
        profiler.end('queue_operations');

        // Response preparation
        profiler.mark('response_prep');
        res.set({
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block',
            'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
            'Content-Security-Policy': "default-src 'self'",
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
        });
        profiler.end('response_prep');

        profiler.end();
        profiler.logReport('Successful Login');

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
                },
                performance: profiler.getReport()
            }
        });

    } catch (error) {
        profiler.end().logReport('Login Error');
        console.error('Enhanced login error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred',
            performance: profiler.getReport()
        });
    }
};

// Middleware chain performance profiler
const middlewarePerformanceProfiler = () => {
    return (req, res, next) => {
        if (!req.performanceProfiler) {
            req.performanceProfiler = new LoginPerformanceProfiler().start('total_request');
            req.middlewareTimings = [];
        }

        const middlewareName = arguments.callee.caller?.name || 'unknown_middleware';
        const startTime = performance.now();

        // Override next to capture middleware timing
        const originalNext = next;
        next = (...args) => {
            const endTime = performance.now();
            const duration = endTime - startTime;
            req.middlewareTimings.push({
                middleware: middlewareName,
                duration: duration.toFixed(2) + 'ms'
            });
            
            if (duration > 50) {
                console.log(`🐌 SLOW MIDDLEWARE: ${middlewareName} took ${duration.toFixed(2)}ms`);
            }
            
            originalNext(...args);
        };

        next();
    };
};

module.exports = {
    LoginPerformanceProfiler,
    enhancedLoginWithProfiling,
    middlewarePerformanceProfiler
};