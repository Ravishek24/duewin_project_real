// Raw SQL login controller - uses existing Sequelize connection but bypasses model overhead
const bcrypt = require('bcryptjs');
const { generateToken, generateRefreshToken } = require('../../utils/jwt');
const crypto = require('crypto');

// Use existing Sequelize connection but raw SQL queries
let sequelizeInstance = null;

const getSequelizeConnection = async () => {
    if (sequelizeInstance) return sequelizeInstance;
    
    // Use the existing Sequelize instance from the server
    const { getSequelizeInstance } = require('../../config/db');
    sequelizeInstance = await getSequelizeInstance();
    return sequelizeInstance;
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

const rawSqlLoginController = async (req, res) => {
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
        
        // 1. Get Sequelize connection (should be fast since it's already initialized)
        const connStart = process.hrtime.bigint();
        const sequelize = await getSequelizeConnection();
        timings.connection = Number(process.hrtime.bigint() - connStart) / 1000000;
        
        // 2. Raw SQL query for user (bypassing Sequelize models)
        const queryStart = process.hrtime.bigint();
        const [results] = await sequelize.query(
            'SELECT user_id, phone_no, password, is_blocked, wallet_balance, user_name, vip_level, profile_picture_id, is_phone_verified FROM users WHERE phone_no = ? LIMIT 1',
            { 
                replacements: [phone_no],
                type: sequelize.QueryTypes.SELECT
            }
        );
        timings.userQuery = Number(process.hrtime.bigint() - queryStart) / 1000000;
        
        if (!results || results.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }
        
        const user = results[0] || results; // Handle both array and single object
        
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
        
        // 4. Session management with raw SQL transaction
        const sessionStart = process.hrtime.bigint();
        const now = new Date();
        const sessionToken = generateSessionToken();
        const deviceId = generateDeviceId(req);
        const expiresAt = new Date(now.getTime() + 5 * 60 * 60 * 1000); // 5h
        const ipAddress = req.ip || req.connection.remoteAddress;
        
        // Use Sequelize transaction but with raw SQL
        await sequelize.transaction(async (t) => {
            // Invalidate previous sessions
            await sequelize.query(
                'UPDATE user_sessions SET is_active = 0 WHERE user_id = ? AND is_active = 1',
                { 
                    replacements: [user.user_id],
                    transaction: t
                }
            );
            
            // Create new session
            await sequelize.query(
                'INSERT INTO user_sessions (user_id, session_token, device_id, device_info, ip_address, user_agent, login_time, last_activity, expires_at, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)',
                {
                    replacements: [
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
                    ],
                    transaction: t
                }
            );
            
            // Update user last login
            await sequelize.query(
                'UPDATE users SET last_login_at = ?, last_login_ip = ?, updated_at = ? WHERE user_id = ?',
                {
                    replacements: [now, ipAddress, now, user.user_id],
                    transaction: t
                }
            );
        });
        
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
        
        // Calculate total time
        const totalTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        
        // Performance logging
        console.log(`🚀 RAW SQL LOGIN: ${phone_no} - ${totalTime.toFixed(2)}ms [Conn: ${timings.connection.toFixed(2)}ms | Query: ${timings.userQuery.toFixed(2)}ms | Bcrypt: ${timings.bcrypt.toFixed(2)}ms | Session: ${timings.session.toFixed(2)}ms | JWT: ${timings.jwt.toFixed(2)}ms]`);
        
        // Alert on performance issues
        if (timings.connection > 10) console.warn(`⚠️ Connection slow: ${timings.connection.toFixed(2)}ms`);
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
                method: 'raw_sql'
            }
        });
        
    } catch (error) {
        const errorTime = Number(process.hrtime.bigint() - startTime) / 1000000;
        console.error(`❌ RAW SQL login error after ${errorTime.toFixed(2)}ms:`, error);
        
        res.status(500).json({
            success: false,
            message: 'An error occurred',
            performance: {
                errorTime,
                partialTimings: timings,
                method: 'raw_sql'
            }
        });
    }
};

module.exports = rawSqlLoginController;