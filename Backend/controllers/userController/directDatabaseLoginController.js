// Direct database login controller - bypasses Sequelize models entirely
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const { generateToken, generateRefreshToken } = require('../../utils/jwt');
const crypto = require('crypto');

// Direct database connection - bypasses Sequelize overhead
let dbPool = null;

const initDirectDatabase = async () => {
    if (dbPool) return dbPool;
    
    console.log('🚀 DIRECT DB: Initializing direct database connection...');
    
    const config = require('../../config/config');
    const env = process.env.NODE_ENV || 'development';
    const dbConfig = config[env];
    
    dbPool = mysql.createPool({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.database,
        connectionLimit: 20,
        acquireTimeout: 5000,
        timeout: 5000,
        reconnect: true
    });
    
    console.log('✅ DIRECT DB: Database pool created');
    return dbPool;
};

// Generate session token
const generateSessionToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

// Generate device ID
const generateDeviceId = (req) => {
    const data = `${req.ip || 'unknown'}-${req.headers['user-agent'] || 'unknown'}-${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex');
};

const directDatabaseLoginController = async (req, res) => {
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
        
        // 1. Initialize direct database connection
        const dbStart = process.hrtime.bigint();
        const db = await initDirectDatabase();
        timings.dbInit = Number(process.hrtime.bigint() - dbStart) / 1000000;
        
        // 2. Direct SQL query for user
        const queryStart = process.hrtime.bigint();
        const [rows] = await db.execute(
            'SELECT user_id, phone_no, password, is_blocked, wallet_balance, user_name, vip_level, profile_picture_id, is_phone_verified FROM users WHERE phone_no = ? LIMIT 1',
            [phone_no]
        );
        timings.userQuery = Number(process.hrtime.bigint() - queryStart) / 1000000;
        
        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        const user = rows[0];
        
        if (user.is_blocked) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }
        
        // 3. Password verification
        const bcryptStart = process.hrtime.bigint();
        const isValidPassword = await bcrypt.compare(password, user.password);
        timings.bcrypt = Number(process.hrtime.bigint() - bcryptStart) / 1000000;
        
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        // 4. Session management with direct SQL
        const sessionStart = process.hrtime.bigint();
        const now = new Date();
        const sessionToken = generateSessionToken();
        const deviceId = generateDeviceId(req);
        const expiresAt = new Date(now.getTime() + 5 * 60 * 60 * 1000); // 5h
        const ipAddress = req.ip || req.connection.remoteAddress;
        
        // Use transaction for atomic operations
        const connection = await db.getConnection();
        await connection.beginTransaction();
        
        try {
            // Invalidate previous sessions
            await connection.execute(
                'UPDATE user_sessions SET is_active = 0 WHERE user_id = ? AND is_active = 1',
                [user.user_id]
            );
            
            // Create new session
            await connection.execute(
                'INSERT INTO user_sessions (user_id, session_token, device_id, device_info, ip_address, user_agent, login_time, last_activity, expires_at, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
                [
                    user.user_id,
                    sessionToken,
                    deviceId,
                    JSON.stringify({
                        userAgent: req.headers['user-agent'],
                        ipAddress,
                        loginTime: now
                    }),
                    ipAddress,
                    req.headers['user-agent'],
                    now,
                    now,
                    expiresAt,
                    now,
                    now
                ]
            );
            
            // Update user last login
            await connection.execute(
                'UPDATE users SET last_login_at = ?, last_login_ip = ?, updated_at = ? WHERE user_id = ?',
                [now, ipAddress, now, user.user_id]
            );
            
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
        timings.session = Number(process.hrtime.bigint() - sessionStart) / 1000000;
        
        // 5. Generate JWT tokens
        const jwtStart = process.hrtime.bigint();
        const tokenPayload = {
            userId: user.user_id,
            sessionToken: sessionToken,
            deviceId: deviceId
        };
        
        const accessToken = generateToken(tokenPayload);
        const refreshToken = generateRefreshToken(tokenPayload);
        timings.jwt = Number(process.hrtime.bigint() - jwtStart) / 1000000;
        
        // 6. Background attendance (non-blocking)
        setImmediate(() => {
            // Skip attendance queue for maximum speed - can be added later if needed
        });
        
        // Calculate total time
        const totalTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        
        // Performance logging
        console.log(`🚀 DIRECT DB LOGIN: ${phone_no} - ${totalTime.toFixed(2)}ms [DB: ${timings.dbInit.toFixed(2)}ms | Query: ${timings.userQuery.toFixed(2)}ms | Bcrypt: ${timings.bcrypt.toFixed(2)}ms | Session: ${timings.session.toFixed(2)}ms | JWT: ${timings.jwt.toFixed(2)}ms]`);
        
        // Alert on performance issues
        if (timings.dbInit > 10) console.warn(`⚠️ DB Init slow: ${timings.dbInit.toFixed(2)}ms`);
        if (timings.userQuery > 20) console.warn(`⚠️ Query slow: ${timings.userQuery.toFixed(2)}ms`);
        if (timings.bcrypt > 150) console.warn(`⚠️ Bcrypt slow: ${timings.bcrypt.toFixed(2)}ms`);
        if (timings.session > 50) console.warn(`⚠️ Session slow: ${timings.session.toFixed(2)}ms`);
        
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
                    deviceId: deviceId,
                    expiresAt: expiresAt
                }
            },
            // Performance data for debugging
            performance: {
                totalTime,
                breakdown: timings,
                method: 'direct_database'
            }
        });
        
    } catch (error) {
        const errorTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        console.error(`❌ DIRECT DB login error after ${errorTime.toFixed(2)}ms:`, error);
        
        res.status(500).json({
            success: false,
            message: 'An error occurred',
            performance: {
                errorTime,
                partialTimings: timings,
                method: 'direct_database'
            }
        });
    }
};

module.exports = directDatabaseLoginController;